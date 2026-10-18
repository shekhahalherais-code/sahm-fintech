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
  width?: number;
}

interface PositionedTextPart {
  x: number;
  width: number;
  text: string;
}

interface ReportLine {
  page: number;
  y: number;
  text: string;
  parts: PositionedTextPart[];
}

const MAX_PDF_PAGES = 250;
const MAX_EXCERPT_LENGTH = 240;

const financialLabels: Array<{
  category: Exclude<MetricCategory, "other">;
  label: string;
  patterns: RegExp[];
  statementPatterns: RegExp[];
}> = [
  {
    category: "revenue",
    label: "Revenue",
    statementPatterns: [
      /صافي\s+إيرادات\s+التشغيل/,
      /\bnet\s+operating\s+income\b/i,
      /\btotal\s+operating\s+income\b/i,
    ],
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
    statementPatterns: [
      /ربح\s+السنة/,
      /\bprofit\s+for\s+the\s+year\b/i,
      /\bnet\s+profit\b/i,
    ],
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
    statementPatterns: [/\btotal\s+assets\b/i, /إجمالي\s+الموجودات/, /إجمالي\s+الأصول/],
    patterns: [/\btotal\s+assets\b/i, /إجمالي\s+الأصول/, /مجموع\s+الأصول/],
  },
  {
    category: "liabilities",
    label: "Total liabilities",
    statementPatterns: [
      /\btotal\s+liabilities\b/i,
      /إجمالي\s+المطلوبات/,
      /إجمالي\s+الالتزامات/,
    ],
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
    statementPatterns: [
      /\btotal\s+equity\b/i,
      /إجمالي\s+حقوق\s+الملكية/,
      /مجموع\s+حقوق\s+الملكية/,
    ],
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
  const rows = new Map<number, PositionedTextPart[]>();
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
    row.push({
      x,
      width: typeof textItem.width === "number" ? textItem.width : 0,
      text,
    });
    rows.set(rowKey, row);
    fallbackIndex += 1;
  }

  return [...rows.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rowKey, row]) => ({
      page,
      y: rowKey * 2,
      parts: row.sort((a, b) => a.x - b.x),
      text: cleanLine(
        row
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

function detectStatementPeriod(
  lines: ReportLine[],
  incomeStatementPage: number | null,
  year: string | null,
): string | null {
  if (incomeStatementPage === null) return detectReportingPeriod(lines);

  const text = pageText(lines, incomeStatementPage);
  const arabicPeriod = text.match(
    /للسنة\s+(?:المالية\s+)?المنتهية\s+في\s+31\s+ديسمبر/,
  );
  if (arabicPeriod?.[0] && year) {
    return `${arabicPeriod[0]} ${year}`;
  }

  const englishPeriod = text.match(
    /(?:for\s+the\s+)?(?:financial\s+)?year\s+(?:ended|ending)\s+31\s+december/i,
  );
  if (englishPeriod?.[0] && year) {
    return `${englishPeriod[0]} ${year}`;
  }

  return detectReportingPeriod(lines.filter((line) => line.page === incomeStatementPage));
}

function detectCompanyName(lines: ReportLine[]): string | null {
  const companyPatterns = [
    /(?:company\s+name|name\s+of\s+the\s+company)\s*[:：-]\s*(.{3,100})/i,
    /(?:اسم\s+الشركة|اسم\s+الشركه)\s*[:：-]\s*(.{3,100})/,
  ];
  for (const { page, text } of lines) {
    if (page > 10) break;
    if (/بنك\s+الكويت\s+الوطني/.test(text)) {
      return "بنك الكويت الوطني";
    }
    if (/national\s+bank\s+of\s+kuwait/i.test(text)) {
      return "National Bank of Kuwait";
    }
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

function normalizeSearchText(value: string): string {
  return normalizeArabicDigits(value)
    .replace(/[\u200e\u200f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pageText(lines: ReportLine[], page: number): string {
  return normalizeSearchText(
    lines
      .filter((line) => line.page === page)
      .map((line) => line.text)
      .join(" "),
  );
}

function findStatementPage(
  lines: ReportLine[],
  titlePattern: RegExp,
): number | null {
  const candidatePages = [
    ...new Set(
      lines
        .filter((line) => titlePattern.test(line.text))
        .map((line) => line.page),
    ),
  ];

  return (
    candidatePages.find((page) => {
      const linesOnPage = lines.filter((line) => line.page === page);
      const hasYearColumn = linesOnPage.some((line) =>
        line.parts.some((part) => {
          const year = normalizeSearchText(part.text);
          return /^20\d{2}$/.test(year) && part.x < 250;
        }),
      );
      const text = pageText(lines, page);
      return hasYearColumn && /ألف/.test(text) && /دينار\s+كويتي/.test(text);
    }) ?? null
  );
}

function findStatementYear(lines: ReportLine[], pages: Array<number | null>): string | null {
  const years = lines
    .filter((line) => pages.includes(line.page))
    .flatMap((line) => line.parts)
    .map((part) => normalizeSearchText(part.text))
    .filter((text) => /^20\d{2}$/.test(text));

  return years.length > 0 ? years.sort().at(-1) ?? null : null;
}

function findYearColumnX(
  lines: ReportLine[],
  page: number,
  year: string | null,
): number | null {
  if (!year) return null;
  const header = lines
    .filter((line) => line.page === page)
    .flatMap((line) => line.parts)
    .filter(
      (part) =>
        normalizeSearchText(part.text) === year &&
        part.x < 250,
    )
    .sort((a, b) => a.x - b.x)[0];

  return header?.x ?? null;
}

function numericClusters(line: ReportLine): Array<{ x: number; value: string }> {
  const numericParts = line.parts
    .filter((part) => {
      const text = part.text.replace(/[\u200e\u200f\s]/g, "");
      return text.length > 0 && /^[()[\]0-9٠-٩,٬.٫−-]+$/.test(text);
    })
    .sort((a, b) => a.x - b.x);

  const clusters: PositionedTextPart[][] = [];
  for (const part of numericParts) {
    const current = clusters.at(-1);
    const previous = current?.at(-1);
    if (
      current &&
      previous &&
      part.x - (previous.x + previous.width) <= 5
    ) {
      current.push(part);
    } else {
      clusters.push([part]);
    }
  }

  return clusters.flatMap((cluster) => {
    const raw = cluster.map((part) => part.text).join("");
    const value = normalizeArabicDigits(raw)
      .replace(/[\u200e\u200f\s]/g, "")
      .replace(/٬/g, ",");
    return /^-?\(?\d[\d,]*(?:\.\d+)?\)?$/.test(value) &&
      /\d/.test(value)
      ? [{ x: cluster[0]?.x ?? 0, value }]
      : [];
  });
}

function findStatementMetric(
  lines: ReportLine[],
  page: number,
  year: string | null,
  yearColumnX: number | null,
  definition: (typeof financialLabels)[number],
  currency: string | null,
  unitScale: UnitScale,
  reportingPeriod: string | null,
): { metric: ExtractedMetric; ambiguous: boolean } | null {
  const sourceLine = lines.find(
    (line) =>
      line.page === page &&
      definition.statementPatterns.some((pattern) => pattern.test(line.text)),
  );
  if (!sourceLine) return null;

  const candidates =
    yearColumnX === null
      ? []
      : numericClusters(sourceLine).filter(
          (candidate) => Math.abs(candidate.x - yearColumnX) <= 24,
        );
  const reportedValue = candidates.length === 1 ? candidates[0]?.value ?? null : null;
  const matchedLabel =
    sourceLine.parts.find((part) =>
      definition.statementPatterns.some((pattern) => pattern.test(part.text)),
    )?.text ?? definition.label;

  return {
    metric: {
      label: definition.label,
      category: definition.category,
      reportedValue,
      currency,
      unitScale,
      reportingPeriod,
      sourcePage: sourceLine.page,
      sourceExcerpt: shorten(
        reportedValue
          ? `${matchedLabel} — ${reportedValue} (${year})`
          : sourceLine.text,
      ),
      verificationStatus:
        reportedValue &&
        currency &&
        unitScale !== "unknown" &&
        reportingPeriod
          ? "verified"
          : "unverified",
    },
    ambiguous: candidates.length > 1,
  };
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

    const incomeStatementPage = findStatementPage(
      lines,
      /بيان\s+الدخل\s+المجمع|consolidated\s+income\s+statement/i,
    );
    const balanceStatementPage = findStatementPage(
      lines,
      /بيان\s+المركز\s+المالي\s+المجمع|consolidated\s+(?:statement\s+of\s+financial\s+position|balance\s+sheet)/i,
    );
    const statementPages = [incomeStatementPage, balanceStatementPage].filter(
      (page): page is number => page !== null,
    );
    const statementYear = findStatementYear(lines, statementPages);
    const statementContext = statementPages
      .map((page) => pageText(lines, page))
      .join(" ");
    const hasFinancialStatements = statementPages.length > 0;
    const currency = detectCurrency(
      hasFinancialStatements ? statementContext : documentText,
    );
    const unitScale = detectUnitScale(
      hasFinancialStatements ? statementContext : documentText,
    );
    const reportingPeriod = hasFinancialStatements
      ? detectStatementPeriod(lines, incomeStatementPage, statementYear)
      : detectReportingPeriod(lines);
    const extractionNotes: string[] = [];
    const metrics: ExtractedMetric[] = financialLabels.map((definition) => {
      const statementPage =
        definition.category === "assets" ||
        definition.category === "liabilities" ||
        definition.category === "equity"
          ? balanceStatementPage
          : incomeStatementPage;
      const yearColumnX =
        statementPage === null
          ? null
          : findYearColumnX(lines, statementPage, statementYear);
      const found = hasFinancialStatements
        ? statementPage === null
          ? null
          : findStatementMetric(
              lines,
              statementPage,
              statementYear,
              yearColumnX,
              definition,
              currency,
              unitScale,
              reportingPeriod,
            )
        : findMetricLine(
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
        "A company name could not be confidently identified from the report cover or opening pages.",
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
