import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type UnitScale = "units" | "thousands" | "millions" | "unknown";
export type MetricCategory =
  | "revenue"
  | "net_profit"
  | "assets"
  | "liabilities"
  | "equity"
  | "other";
export type VerificationStatus = "verified" | "unverified" | "unavailable";

export interface ExtractedMetric {
  label: string;
  category: MetricCategory;
  reportedValue: string | null;
  currency: string | null;
  unitScale: UnitScale;
  reportingPeriod: string | null;
  sourcePage: number | null;
  sourceExcerpt: string | null;
  verificationStatus: VerificationStatus;
}

export interface ExtractedReport {
  companyName: string | null;
  reportingPeriod: string | null;
  currency: string | null;
  unitScale: UnitScale;
  metrics: ExtractedMetric[];
  extractionNotes: string[];
}

interface TextItem {
  str: string;
  transform?: ArrayLike<number>;
}

interface ReportLine {
  page: number;
  text: string;
}

const MAX_PDF_PAGES = 250;
const MAX_EXCERPT_LENGTH = 240;

const financialLabels: Array<{
  category: Exclude<MetricCategory, "other">;
  label: string;
  patterns: RegExp[];
}> = [
  {
    category: "revenue",
    label: "Revenue",
    patterns: [
      /\btotal\s+revenue\b/i,
      /\brevenue\b/i,
      /\btotal\s+operating\s+income\b/i,
      /\boperating\s+income\b/i,
      /الإيرادات/,
      /الإيراد/,
      /إيرادات/,
      /إيراد/,
    ],
  },
  {
    category: "net_profit",
    label: "Net profit",
    patterns: [
      /\bnet\s+profit\b/i,
      /\bprofit\s+for\s+the\s+(?:year|period)\b/i,
      /\bprofit\s+attributable\b/i,
      /\bnet\s+income\b/i,
      /صافي\s+الربح/,
      /صافي\s+ربح/,
      /ربح\s+(?:السنة|الفترة)/,
    ],
  },
  {
    category: "assets",
    label: "Total assets",
    patterns: [/\btotal\s+assets\b/i, /إجمالي\s+الأصول/, /مجموع\s+الأصول/],
  },
  {
    category: "liabilities",
    label: "Total liabilities",
    patterns: [
      /\btotal\s+liabilities\b/i,
      /إجمالي\s+الالتزامات/,
      /مجموع\s+الالتزامات/,
      /إجمالي\s+المطلوبات/,
    ],
  },
  {
    category: "equity",
    label: "Total equity",
    patterns: [
      /\btotal\s+(?:shareholders['’]?\s+)?equity\b/i,
      /\btotal\s+equity\b/i,
      /إجمالي\s+حقوق\s+الملكية/,
      /مجموع\s+حقوق\s+الملكية/,
    ],
  },
];

const numberPattern =
  /(?:\(\s*)?-?[0-9٠-٩][0-9٠-٩,٬.٫]*(?:\s*\))?/gu;

function normalizeArabicDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/٬/g, ",")
    .replace(/٫/g, ".");
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function shorten(value: string): string {
  const line = cleanLine(value);
  return line.length > MAX_EXCERPT_LENGTH
    ? `${line.slice(0, MAX_EXCERPT_LENGTH - 1)}…`
    : line;
}

function linesFromTextContent(items: unknown[], page: number): ReportLine[] {
  const rows = new Map<number, Array<{ x: number; text: string }>>();
  let fallbackIndex = 0;

  for (const item of items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const textItem = item as TextItem;
    const text = cleanLine(textItem.str);
    if (!text) continue;

    const transform = textItem.transform;
    const x = typeof transform?.[4] === "number" ? transform[4] : fallbackIndex;
    const y = typeof transform?.[5] === "number" ? transform[5] : -fallbackIndex;
    const rowKey = Math.round(y / 2);
    const row = rows.get(rowKey) ?? [];
    row.push({ x, text });
    rows.set(rowKey, row);
    fallbackIndex += 1;
  }

  return [...rows.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, row]) => ({
      page,
      text: cleanLine(
        row
          .sort((a, b) => a.x - b.x)
          .map((part) => part.text)
          .join(" "),
      ),
    }))
    .filter((line) => line.text.length > 0);
}

function detectCurrency(text: string): string | null {
  const matches = new Set<string>();
  const candidates: Array<[RegExp, string]> = [
    [/\bKWD\b|Kuwaiti\s+Dinar|دينار\s+كويتي|الدينار\s+الكويتي/gi, "KWD"],
    [/\bUSD\b|US\s+Dollars?/gi, "USD"],
    [/\bBHD\b|Bahraini\s+Dinar/gi, "BHD"],
    [/\bSAR\b|Saudi\s+Riyals?/gi, "SAR"],
    [/\bAED\b|UAE\s+Dirhams?/gi, "AED"],
    [/د\.\s*ك/gi, "KWD"],
  ];

  for (const [pattern, currency] of candidates) {
    if (pattern.test(text)) matches.add(currency);
    pattern.lastIndex = 0;
  }

  return matches.size === 1 ? [...matches][0] ?? null : null;
}

function detectUnitScale(text: string): UnitScale {
  const scaleMatches = new Set<UnitScale>();
  if (
    /\b(thousands?|000s|in\s+000)\b/i.test(text) ||
    /بالآلاف|بالألف|ألف\s+دينار/.test(text)
  ) {
    scaleMatches.add("thousands");
  }
  if (
    /\b(millions?|in\s+millions)\b/i.test(text) ||
    /بالملايين|مليون\s+دينار/.test(text)
  ) {
    scaleMatches.add("millions");
  }
  if (/\bin\s+units\b|بالدينار\b/.test(text)) {
    scaleMatches.add("units");
  }
  return scaleMatches.size === 1 ? [...scaleMatches][0] ?? "unknown" : "unknown";
}

function detectReportingPeriod(lines: ReportLine[]): string | null {
  const periodLabels =
    /(?:for\s+the\s+)?(?:financial\s+)?(?:year|period)\s+(?:ended|ending)\s+.{0,50}/i;
  const arabicPeriodLabels = /(?:للسنة|للفترة)\s+(?:المالية\s+)?المنتهية\s+.{0,50}/;

  for (const { text } of lines) {
    const match = text.match(periodLabels) ?? text.match(arabicPeriodLabels);
    if (match?.[0]) return shorten(match[0]);
  }
  return null;
}

function detectCompanyName(lines: ReportLine[]): string | null {
  const companyPatterns = [
    /(?:company\s+name|name\s+of\s+the\s+company)\s*[:：-]\s*(.{3,100})/i,
    /(?:اسم\s+الشركة|اسم\s+الشركه)\s*[:：-]\s*(.{3,100})/,
  ];
  for (const { page, text } of lines) {
    if (page > 3) break;
    for (const pattern of companyPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) return shorten(match[1]);
    }
  }
  return null;
}

function numericTokens(text: string): string[] {
  const matches = text.match(numberPattern) ?? [];
  return matches
    .map((match) => cleanLine(match))
    .filter((match) => normalizeArabicDigits(match).replace(/[,.()-]/g, "").length > 0);
}

function findMetricLine(
  lines: ReportLine[],
  metric: (typeof financialLabels)[number],
  currency: string | null,
  unitScale: UnitScale,
  reportingPeriod: string | null,
): { metric: ExtractedMetric; ambiguous: boolean } | null {
  const match = lines.find(({ text }) =>
    metric.patterns.some((pattern) => pattern.test(text)),
  );
  if (!match) return null;

  const values = numericTokens(match.text);
  const sourceExcerpt = shorten(match.text);
  if (values.length === 1) {
    return {
      metric: {
        label: metric.label,
        category: metric.category,
        reportedValue: values[0] ?? null,
        currency,
        unitScale,
        reportingPeriod,
        sourcePage: match.page,
        sourceExcerpt,
        verificationStatus: "verified",
      },
      ambiguous: false,
    };
  }

  return {
    metric: {
      label: metric.label,
      category: metric.category,
      reportedValue: null,
      currency,
      unitScale,
      reportingPeriod,
      sourcePage: match.page,
      sourceExcerpt,
      verificationStatus: "unverified",
    },
    ambiguous: values.length > 1,
  };
}

export async function extractFinancialReport(
  pdfBuffer: Buffer,
): Promise<ExtractedReport> {
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    verbosity: 0,
  });

  try {
    const document = await loadingTask.promise;
    if (document.numPages > MAX_PDF_PAGES) {
      throw new Error(
        `This PDF has ${document.numPages} pages. The current limit is ${MAX_PDF_PAGES} pages.`,
      );
    }

    const lines: ReportLine[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      lines.push(...linesFromTextContent(content.items, pageNumber));
      page.cleanup();
    }

    const documentText = lines.map((line) => line.text).join("\n");
    if (documentText.trim().length < 20) {
      throw new Error(
        "No usable text was found. This may be a scanned PDF; Phase 1 supports text-based PDFs only.",
      );
    }

    const currency = detectCurrency(documentText);
    const unitScale = detectUnitScale(documentText);
    const reportingPeriod = detectReportingPeriod(lines);
    const extractionNotes: string[] = [];
    const metrics: ExtractedMetric[] = financialLabels.map((definition) => {
      const found = findMetricLine(
        lines,
        definition,
        currency,
        unitScale,
        reportingPeriod,
      );
      if (found?.ambiguous) {
        extractionNotes.push(
          `${definition.label} appears alongside multiple figures on page ${found.metric.sourcePage}; no value was selected.`,
        );
      }
      return (
        found?.metric ?? {
          label: definition.label,
          category: definition.category,
          reportedValue: null,
          currency,
          unitScale,
          reportingPeriod,
          sourcePage: null,
          sourceExcerpt: null,
          verificationStatus: "unavailable",
        }
      );
    });

    if (!currency) {
      extractionNotes.push(
        "Currency was not uniquely identifiable from the report text.",
      );
    }
    if (unitScale === "unknown") {
      extractionNotes.push(
        "The report's unit scale could not be confirmed; values are not converted.",
      );
    }
    if (!reportingPeriod) {
      extractionNotes.push(
        "A reporting period could not be confidently identified.",
      );
    }
    if (!detectCompanyName(lines)) {
      extractionNotes.push(
        "A company name could not be confidently identified from a labeled field.",
      );
    }
    if (metrics.every((metric) => metric.verificationStatus === "unavailable")) {
      extractionNotes.push(
        "No supported financial metric labels were confidently identified.",
      );
    }

    return {
      companyName: detectCompanyName(lines),
      reportingPeriod,
      currency,
      unitScale,
      metrics,
      extractionNotes,
    };
  } finally {
    await loadingTask.destroy();
  }
}
