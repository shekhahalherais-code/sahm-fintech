import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import mongoose from "mongoose";
import {
  AskFinancialReportQuestionBody,
  AskFinancialReportQuestionParams,
  AskFinancialReportQuestionResponse,
  GenerateReportExplanationsParams,
  GenerateReportExplanationsResponse,
  ExtractReportResponse,
  GetFinancialReportParams,
  GetFinancialReportResponse,
} from "@workspace/api-zod";
import { FinancialAnalysis } from "../models/FinancialAnalysis";
import { extractFinancialReport } from "../services/financial-extractor";
import { answerFinancialReportQuestion } from "../services/financial-chat";
import {
  createBilingualFinancialExplanations,
  getMissingExplanationIndexes,
  hasCompleteExplanationBundle,
  mergeExplanationBundles,
  type BilingualExplanationBundle,
} from "../services/financial-explainer";
import { connectMongo, MongoConfigurationError } from "../services/mongodb";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 0 },
});
const router: IRouter = Router();
const explanationGenerationJobs = new Map<
  string,
  Promise<BilingualExplanationBundle | null>
>();

function safeExplanationErrorFields(error: unknown): Record<string, string | number> {
  if (!(error instanceof Error)) return { errorType: typeof error };

  const details = error as Error & { status?: unknown; code?: unknown };
  const fields: Record<string, string | number> = {
    errorName: error.name.slice(0, 80),
  };
  if (typeof details.status === "number" && Number.isInteger(details.status)) {
    fields.providerStatus = details.status;
  }
  if (
    typeof details.code === "string" &&
    /^[A-Za-z0-9_.-]{1,64}$/.test(details.code)
  ) {
    fields.errorCode = details.code;
  }
  return fields;
}

function getOrGenerateExplanations(
  reportId: string,
): Promise<BilingualExplanationBundle | null> {
  const currentJob = explanationGenerationJobs.get(reportId);
  if (currentJob) return currentJob;

  const job = (async (): Promise<BilingualExplanationBundle | null> => {
    await connectMongo();
    const saved = await FinancialAnalysis.findById(reportId);
    if (!saved) return null;

    const existing = saved.explanations as BilingualExplanationBundle | null;
    if (hasCompleteExplanationBundle(saved.metrics, existing)) {
      return GenerateReportExplanationsResponse.parse(existing);
    }

    const missingIndexes = getMissingExplanationIndexes(saved.metrics, existing);
    const generated = await createBilingualFinancialExplanations(
      saved.metrics,
      missingIndexes,
    );
    const merged = mergeExplanationBundles(saved.metrics, existing, generated);
    const validated = GenerateReportExplanationsResponse.parse(merged);
    saved.explanations = {
      ...validated,
      generatedAt: validated.generatedAt.toISOString(),
    };
    await saved.save();
    return validated;
  })();

  explanationGenerationJobs.set(reportId, job);
  const cleanup = () => {
    if (explanationGenerationJobs.get(reportId) === job) {
      explanationGenerationJobs.delete(reportId);
    }
  };
  void job.then(cleanup, cleanup);
  return job;
}

function handlePdfUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "PDF files must be 15 MB or smaller." });
        return;
      }
      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        res.status(400).json({ error: "Upload one PDF using the file field." });
        return;
      }
      res.status(400).json({ error: "The PDF upload could not be read." });
      return;
    }

    req.log.error({ err: error }, "Unexpected PDF upload error");
    res.status(500).json({ error: "The PDF upload could not be processed." });
  });
}

function safeFileName(fileName: string): string {
  const basename = fileName.split(/[\\/]/).pop() ?? "financial-report.pdf";
  return basename.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 160);
}

router.post(
  "/reports/extract",
  handlePdfUpload,
  async (req, res): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Choose a PDF file to upload." });
      return;
    }

    const hasPdfSignature = file.buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    if (!hasPdfSignature) {
      res.status(400).json({ error: "The selected file is not a valid PDF." });
      return;
    }

    let extracted: Awaited<ReturnType<typeof extractFinancialReport>>;
    try {
      extracted = await extractFinancialReport(file.buffer);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";
      const message =
        rawMessage.startsWith("This PDF has ") ||
        rawMessage.startsWith("No usable text was found.")
          ? rawMessage
          : "The PDF could not be read. It may be damaged, password-protected, or scanned. Phase 1 supports text-based PDFs only.";
      req.log.warn({ err: error }, "Financial PDF extraction failed");
      res.status(422).json({ error: message });
      return;
    }

    try {
      await connectMongo();
      const originalFileName = safeFileName(file.originalname);
      const saved = await FinancialAnalysis.create({
        originalFileName,
        companyName: extracted.companyName,
        reportingPeriod: extracted.reportingPeriod,
        currency: extracted.currency,
        unitScale: extracted.unitScale,
        metrics: extracted.metrics,
        extractionNotes: extracted.extractionNotes,
      });

      const response = ExtractReportResponse.parse({
        id: saved._id.toString(),
        originalFileName: saved.originalFileName,
        companyName: saved.companyName,
        reportingPeriod: saved.reportingPeriod,
        currency: saved.currency,
        unitScale: saved.unitScale,
        metrics: saved.metrics,
        extractionNotes: saved.extractionNotes,
        explanations: saved.explanations ?? null,
        createdAt: saved.createdAt,
      });
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof MongoConfigurationError) {
        res.status(503).json({ error: error.message });
        return;
      }
      req.log.error({ err: error }, "Could not save extracted financial report");
      res.status(503).json({
        error:
          "The report was read, but could not be saved. Check that the MongoDB Atlas cluster is running and that its Network Access list allows this runtime.",
      });
    }
  },
);

router.get(
  "/reports/:reportId",
  async (req, res): Promise<void> => {
    const parsedParams = GetFinancialReportParams.safeParse(req.params);
    if (!parsedParams.success || !mongoose.isValidObjectId(parsedParams.data.reportId)) {
      res.status(404).json({ error: "Saved report not found." });
      return;
    }

    try {
      await connectMongo();
      const saved = await FinancialAnalysis.findById(parsedParams.data.reportId).lean();
      if (!saved) {
        res.status(404).json({ error: "Saved report not found." });
        return;
      }

      const response = GetFinancialReportResponse.parse({
        id: saved._id.toString(),
        originalFileName: saved.originalFileName,
        companyName: saved.companyName,
        reportingPeriod: saved.reportingPeriod,
        currency: saved.currency,
        unitScale: saved.unitScale,
        metrics: saved.metrics,
        extractionNotes: saved.extractionNotes,
        explanations: saved.explanations ?? null,
        createdAt: saved.createdAt,
      });
      res.json(response);
    } catch (error) {
      if (error instanceof MongoConfigurationError) {
        res.status(503).json({ error: error.message });
        return;
      }
      req.log.error({ err: error }, "Could not retrieve financial report");
      res.status(503).json({
        error: "Saved reports are temporarily unavailable. Check that the MongoDB Atlas cluster is running and that its Network Access list allows this runtime.",
      });
    }
  },
);

router.post(
  "/reports/:reportId/explanations",
  async (req, res): Promise<void> => {
    const parsedParams = GenerateReportExplanationsParams.safeParse(req.params);
    if (!parsedParams.success || !mongoose.isValidObjectId(parsedParams.data.reportId)) {
      res.status(404).json({ error: "Saved report not found." });
      return;
    }

    try {
      const explanations = await getOrGenerateExplanations(
        parsedParams.data.reportId,
      );
      if (!explanations) {
        res.status(404).json({ error: "Saved report not found." });
        return;
      }

      res.json(GenerateReportExplanationsResponse.parse(explanations));
    } catch (error) {
      if (error instanceof MongoConfigurationError) {
        res.status(503).json({ error: error.message });
        return;
      }
      req.log.error(
        {
          reportId: parsedParams.data.reportId,
          ...safeExplanationErrorFields(error),
        },
        "Could not generate bilingual financial explanations",
      );
      res.status(503).json({
        error: "The explanation service is temporarily unavailable. Please try again.",
      });
    }
  },
);

router.post(
  "/reports/:reportId/chat",
  async (req, res): Promise<void> => {
    const parsedParams = AskFinancialReportQuestionParams.safeParse(req.params);
    if (!parsedParams.success || !mongoose.isValidObjectId(parsedParams.data.reportId)) {
      res.status(404).json({ error: "Saved report not found." });
      return;
    }

    const parsedBody = AskFinancialReportQuestionBody.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "Enter a question of up to 1,000 characters." });
      return;
    }

    try {
      await connectMongo();
      const saved = await FinancialAnalysis.findById(parsedParams.data.reportId).lean();
      if (!saved) {
        res.status(404).json({ error: "Saved report not found." });
        return;
      }

      const response = await answerFinancialReportQuestion(
        saved.metrics,
        parsedBody.data.question,
        parsedBody.data.history ?? [],
      );
      res.json(AskFinancialReportQuestionResponse.parse(response));
    } catch (error) {
      if (error instanceof MongoConfigurationError) {
        res.status(503).json({ error: error.message });
        return;
      }
      req.log.error(
        {
          reportId: parsedParams.data.reportId,
          ...safeExplanationErrorFields(error),
        },
        "Could not answer financial report question",
      );
      res.status(503).json({
        error: "The report chat is temporarily unavailable. Please try again.",
      });
    }
  },
);

export default router;
