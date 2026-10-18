import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import mongoose from "mongoose";
import {
  GenerateReportExplanationsParams,
  GenerateReportExplanationsResponse,
  ExtractReportResponse,
  GetFinancialReportParams,
  GetFinancialReportResponse,
} from "@workspace/api-zod";
import { FinancialAnalysis } from "../models/FinancialAnalysis";
import { extractFinancialReport } from "../services/financial-extractor";
import { createBilingualFinancialExplanations } from "../services/financial-explainer";
import { connectMongo, MongoConfigurationError } from "../services/mongodb";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 0 },
});
const router: IRouter = Router();

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
      await connectMongo();
      const saved = await FinancialAnalysis.findById(parsedParams.data.reportId);
      if (!saved) {
        res.status(404).json({ error: "Saved report not found." });
        return;
      }

      if (saved.explanations) {
        res.json(GenerateReportExplanationsResponse.parse(saved.explanations));
        return;
      }

      const generated = await createBilingualFinancialExplanations(saved.metrics);
      const validated = GenerateReportExplanationsResponse.parse(generated);
      saved.explanations = validated;
      await saved.save();
      res.json(validated);
    } catch (error) {
      if (error instanceof MongoConfigurationError) {
        res.status(503).json({ error: error.message });
        return;
      }
      req.log.error(
        { reportId: parsedParams.data.reportId },
        "Could not generate bilingual financial explanations",
      );
      res.status(503).json({
        error: "The explanation service is temporarily unavailable. Please try again.",
      });
    }
  },
);

export default router;
