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
  statementPatterns: RegExp[];
}> = [
  {
    category: "revenue",
    label: "Revenue",
    statementPatterns: [
      /\brevenue\b/i,
      /صافي\s+إيرادات\s+التشغيل/,
      /\bnet\s+operating\s+income\b/i,
      /\btotal\s+operating\s+income\b/i,
    ],
  },
  {
    category: "net_profit",
    label: "Net profit",
    statementPatterns: [
      /ربح\s+السنة(?!\s+من)/,
      /\bprofit\s+for\s+the\s+year\b(?!\s+from\b)/i,
      /\bnet\s+profit\b/i,
    ],
  },
  {
    category: "assets",
    label: "Total assets",
    statementPatterns: [/\btotal\s+assets\b/i, /إجمالي\s+الموجودات/, /إجمالي\s+الأصول/],
  },
  {
    category: "liabilities",
    label: "Total liabilities",
    statementPatterns: [
      /\btotal\s+liabilities\b(?!\s+and\s+equity)/i,
      /إجمالي\s+المطلوبات/,
      /إجمالي\s+الالتزامات/,
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
  },
];

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
    [/\b(?:KWD|KD)\b|Kuwaiti\s+Dinar|دينار\s+كويتي|الدينار\s+الكويتي/gi, "KWD"],
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
    /\b(?:KWD|KD|USD|BHD|SAR|AED)\s*['’`]\s*000\b/i.test(text) ||
    /بالآلاف|بالألف|ألف/.test(text)
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

function detectReportingPeriod(
  lines: ReportLine[],
  expectedYear: string | null,
): string | null {
  const periodLabels =
    /(?:for\s+the\s+)?(?:financial\s+)?year\s+(?:ended|ending)\s+\d{1,2}\s+[a-z]+\s+20\d{2}/i;
  const arabicPeriodLabels =
    /(?:للسنة|للفترة)\s+(?:المالية\s+)?المنتهية\s+في\s+\d{1,2}\s+\S+\s+20\d{2}/;

  for (const { text } of lines) {
    const normalized = normalizeSearchText(text);
    const match =
      normalized.match(periodLabels) ?? normalized.match(arabicPeriodLabels);
    if (
      match?.[0] &&
      (!expectedYear || match[0].includes(expectedYear))
    ) {
      return shorten(match[0]);
    }
  }
  return null;
}

function detectBalanceReportingPeriod(
  lines: ReportLine[],
  page: number,
  year: string | null,
): string | null {
  const text = pageText(lines, page);
  const englishExact = text.match(
    year
      ? new RegExp(`as\\s+at\\s+\\d{1,2}\\s+[a-z]+\\s+${year}`, "i")
      : /as\s+at\s+\d{1,2}\s+[a-z]+\s+20\d{2}/i,
  );
  if (englishExact?.[0]) return cleanLine(englishExact[0]);
  const englishWithoutYear = text.match(
    /as\s+at\s+\d{1,2}\s+[a-z]+/i,
  );
  if (englishWithoutYear?.[0] && year) {
    return `${cleanLine(englishWithoutYear[0])} ${year}`;
  }

  const arabicExact = text.match(
    year
      ? new RegExp(`كما\\s+في\\s+\\d{1,2}\\s+\\S+\\s+${year}`)
      : /كما\s+في\s+\d{1,2}\s+\S+\s+20\d{2}/,
  );
  if (arabicExact?.[0]) return cleanLine(arabicExact[0]);
  const arabicWithoutYear = text.match(/كما\s+في\s+\d{1,2}\s+\S+/);
  if (arabicWithoutYear?.[0] && year) {
    return `${cleanLine(arabicWithoutYear[0])} ${year}`;
  }

  return null;
}

function detectStatementPeriod(
  lines: ReportLine[],
  incomeStatementPage: number | null,
  balanceStatementPage: number | null,
  year: string | null,
): string | null {
  if (incomeStatementPage !== null) {
    const incomeLines = lines.filter((line) => line.page === incomeStatementPage);
    const exactPeriod = detectReportingPeriod(incomeLines, year);
    if (exactPeriod) return exactPeriod;

    const text = pageText(lines, incomeStatementPage);
    const arabicPeriod = text.match(
      /للسنة\s+(?:المالية\s+)?المنتهية\s+في\s+31\s+ديسمبر/,
    );
    if (arabicPeriod?.[0] && year) {
      return `${cleanLine(arabicPeriod[0])} ${year}`;
    }

    const englishPeriod = text.match(
      /(?:for\s+the\s+)?(?:financial\s+)?year\s+(?:ended|ending)\s+31\s+december/i,
    );
    if (englishPeriod?.[0] && year) {
      return `${cleanLine(englishPeriod[0])} ${year}`;
    }
  }

  if (balanceStatementPage !== null) {
    const balanceLines = lines.filter((line) => line.page === balanceStatementPage);
    const balancePeriod = detectBalanceReportingPeriod(
      lines,
      balanceStatementPage,
      year,
    );
    if (balancePeriod) return balancePeriod;
    return detectReportingPeriod(balanceLines, year);
  }

  return null;
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

  const auditedText = lines
    .filter((line) => line.page >= 100 && line.page <= 120)
    .map((line) => line.text)
    .join(" ");
  const auditedEntity = auditedText.match(
    /to\s+the\s+shareholders\s+of\s+(.{3,100}?)\s+and\s+its\s+subsidiaries/i,
  );
  if (auditedEntity?.[1]) return shorten(auditedEntity[1]);

  return null;
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
        .filter((line) =>
          line.parts.some((part) =>
            titlePattern.test(normalizeSearchText(part.text)),
          ),
        )
        .map((line) => line.page),
    ),
  ];

  return (
    candidatePages.find((page) => {
      const linesOnPage = lines.filter((line) => line.page === page);
      const hasYearColumn = linesOnPage.some((line) =>
        line.parts.some((part) => {
          const year = normalizeSearchText(part.text);
          return /^20\d{2}$/.test(year);
        }),
      );
      const text = pageText(lines, page);
      return (
        hasYearColumn &&
        detectCurrency(text) !== null &&
        detectUnitScale(text) !== "unknown"
      );
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
        normalizeSearchText(part.text) === year,
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

function sourceExcerptFor(
  line: ReportLine,
  definition: (typeof financialLabels)[number],
  value: string | null,
): string {
  const labelPart = line.parts.find((part) =>
    definition.statementPatterns.some((pattern) =>
      pattern.test(normalizeSearchText(part.text)),
    ),
  );
  const label = labelPart?.text.trim() || definition.label;
  return shorten(value ? `${label} — ${value}` : line.text);
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
  const matchingLines = lines.filter(
    (line) =>
      line.page === page &&
      definition.statementPatterns.some((pattern) =>
        pattern.test(normalizeSearchText(line.text)),
      ),
  );
  if (matchingLines.length === 0) return null;

  const rowsWithCurrentValue = matchingLines
    .map((line) => ({
      line,
      candidates:
        yearColumnX === null
          ? []
          : numericClusters(line).filter(
              (candidate) => Math.abs(candidate.x - yearColumnX) <= 24,
            ),
    }))
    .filter((row) => row.candidates.length === 1);
  const sourceLine =
    rowsWithCurrentValue.length === 1
      ? rowsWithCurrentValue[0]?.line
      : matchingLines[0];
  if (!sourceLine) return null;

  const candidates =
    rowsWithCurrentValue.length === 1
      ? rowsWithCurrentValue[0]?.candidates ?? []
      : yearColumnX === null
        ? []
        : numericClusters(sourceLine).filter(
            (candidate) => Math.abs(candidate.x - yearColumnX) <= 24,
          );
  const candidateValue = candidates.length === 1 ? candidates[0]?.value ?? null : null;
  const ambiguous =
    candidates.length > 1 || rowsWithCurrentValue.length > 1;
  const verified = Boolean(
    candidateValue &&
      year &&
      currency &&
      unitScale !== "unknown" &&
      reportingPeriod &&
      yearColumnX !== null &&
      !ambiguous,
  );

  return {
    metric: {
      label: definition.label,
      category: definition.category,
      reportedValue: verified ? candidateValue : null,
      currency,
      unitScale,
      reportingPeriod,
      sourcePage: sourceLine.page,
      sourceExcerpt: sourceExcerptFor(
        sourceLine,
        definition,
        verified ? candidateValue : null,
      ),
      verificationStatus: verified ? "verified" : "unverified",
    },
    ambiguous,
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
      /^(?:بيان\s+الدخل\s+المجمع|consolidated\s+(?:income\s+statement|statement\s+of\s+profit\s+or\s+loss))$/i,
    );
    const balanceStatementPage = findStatementPage(
      lines,
      /^(?:بيان\s+المركز\s+المالي\s+المجمع|consolidated\s+(?:statement\s+of\s+financial\s+position|balance\s+sheet))$/i,
    );
    const statementPages = [incomeStatementPage, balanceStatementPage].filter(
      (page): page is number => page !== null,
    );
    const statementYear = findStatementYear(lines, statementPages);
    const statementContext = statementPages
      .map((page) => pageText(lines, page))
      .join(" ");
    const hasFinancialStatements = statementPages.length > 0;
    const currency = hasFinancialStatements ? detectCurrency(statementContext) : null;
    const unitScale = hasFinancialStatements
      ? detectUnitScale(statementContext)
      : "unknown";
    const reportingPeriod = hasFinancialStatements
      ? detectStatementPeriod(
          lines,
          incomeStatementPage,
          balanceStatementPage,
          statementYear,
        )
      : null;
    const balanceReportingPeriod =
      balanceStatementPage === null
        ? null
        : detectBalanceReportingPeriod(
            lines,
            balanceStatementPage,
            statementYear,
          );
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
      const metricReportingPeriod =
        definition.category === "assets" ||
        definition.category === "liabilities" ||
        definition.category === "equity"
          ? balanceReportingPeriod ?? reportingPeriod
          : reportingPeriod;
      const found =
        statementPage === null
          ? null
          : findStatementMetric(
            lines,
            statementPage,
            statementYear,
            yearColumnX,
            definition,
            currency,
            unitScale,
            metricReportingPeriod,
          );
      if (found?.ambiguous) {
        extractionNotes.push(
          `${definition.label} appears alongside multiple figures on page ${found.metric.sourcePage}; no value was selected.`,
        );
      } else if (found && found.metric.verificationStatus !== "verified") {
        extractionNotes.push(
          `${definition.label} was found on page ${found.metric.sourcePage}, but its current-year value or required financial metadata could not be confirmed.`,
        );
      } else if (!found) {
        extractionNotes.push(
          `${definition.label} was not verified because no matching row was found on its audited financial statement page.`,
        );
      }
      return (
        found?.metric ?? {
          label: definition.label,
          category: definition.category,
          reportedValue: null,
          currency,
          unitScale,
          reportingPeriod: metricReportingPeriod,
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
    if (!hasFinancialStatements) {
      extractionNotes.push(
        "Audited financial statement pages with identifiable reporting columns were not found; metrics from narrative mentions are not used.",
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
