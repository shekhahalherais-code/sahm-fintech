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

const incomeStatementTitlePattern =
  /^(?:بيان\s+الدخل\s+المجمع|(?:consolidated\s+)?income\s+statement|(?:consolidated\s+)?statement\s+of\s+(?:income|profit\s+or\s+loss)(?:\s+and\s+other\s+comprehensive\s+income)?)$/i;
const balanceStatementTitlePattern =
  /^(?:بيان\s+المركز\s+المالي\s+المجمع|(?:consolidated\s+)?(?:statement\s+of\s+financial\s+position|balance\s+sheet))$/i;

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
  const positionedParts: Array<{ y: number; part: PositionedTextPart }> = [];
  let fallbackIndex = 0;

  for (const item of items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const textItem = item as TextItem;
    const text = cleanLine(textItem.str);
    if (!text) continue;

    const transform = textItem.transform;
    const x = typeof transform?.[4] === "number" ? transform[4] : fallbackIndex;
    const y = typeof transform?.[5] === "number" ? transform[5] : -fallbackIndex;
    positionedParts.push({
      y,
      part: {
        x,
        width: typeof textItem.width === "number" ? textItem.width : 0,
        text,
      },
    });
    fallbackIndex += 1;
  }

  positionedParts.sort((a, b) => b.y - a.y || a.part.x - b.part.x);
  const rows: Array<{ anchorY: number; parts: PositionedTextPart[] }> = [];
  for (const { y, part } of positionedParts) {
    const row = rows.at(-1);
    if (row && Math.abs(row.anchorY - y) <= 2) {
      row.parts.push(part);
    } else {
      rows.push({ anchorY: y, parts: [part] });
    }
  }

  return rows
    .map(({ anchorY, parts }) => {
      const sortedParts = parts.sort((a, b) => a.x - b.x);
      return {
        page,
        y: anchorY,
        parts: sortedParts,
        text: cleanLine(sortedParts.map((part) => part.text).join(" ")),
      };
    })
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
    /\b(?:KWD|KD|USD|BHD|SAR|AED)\s*000\s*['’`]?\s*s\b/i.test(text) ||
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

  const titlePatterns = [
    /^(.{3,100}?)\s*\|\s*(?:annual\s+report(?:\s+20\d{2})?|التقرير\s+السنوي)\s*$/i,
    /^(.{3,100}?)\s*(?:[-–—:]\s*)?annual\s+report(?:\s+20\d{2})?\s*$/i,
    /^(.{3,100}?)\s+التقرير\s+السنوي(?:\s+20\d{2})?\s*$/i,
    /^(?:20\d{2}\s+)?التقرير\s+السنوي\s+(.{3,100}?)\s*$/i,
  ];

  function cleanCompanyCandidate(value: string): string | null {
    const candidate = cleanLine(value)
      .replace(/^\d+\s+/, "")
      .replace(/\s+\d{1,4}$/, "")
      .replace(/\s*['’]s$/i, "")
      .replace(/\s*(?:\||[-–—:])\s*$/, "")
      .trim();
    if (
      candidate.length < 3 ||
      candidate.length > 100 ||
      /^(?:19|20)\d{2}$/.test(candidate) ||
      /^\d[\d\s,.-]*$/.test(candidate) ||
      /^(?:annual\s+report|financial\s+statements|consolidated|التقرير\s+السنوي)$/i.test(candidate)
    ) {
      return null;
    }
    return candidate;
  }

  const openingLines = lines.filter((line) => line.page <= 10);
  for (let index = 0; index < openingLines.length; index += 1) {
    const line = openingLines[index];
    if (!line) continue;
    for (let offset = 0; offset <= 2; offset += 1) {
      const followingLines = openingLines.slice(index, index + offset + 1);
      if (
        followingLines.length !== offset + 1 ||
        followingLines.some((entry) => entry.page !== line.page)
      ) continue;
      const combinedText = cleanLine(
        followingLines.map((entry) => entry.text).join(" "),
      );
      const match = combinedText.match(
        /^(.{3,100}?)\s+(?:and\s+(?:its\s+)?subsidiaries|و(?:الشركات|الجهات)\s+التابعة)\s*$/i,
      );
      if (match?.[1]) {
        const candidate = cleanCompanyCandidate(match[1]);
        if (candidate) return shorten(candidate);
      }
    }
  }

  for (const line of openingLines) {
    const { page, text } = line;
    for (const pattern of companyPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const candidate = cleanCompanyCandidate(match[1]);
        if (candidate) return shorten(candidate);
      }
    }

    for (const part of [...line.parts.map(({ text: partText }) => partText), text]) {
      for (const pattern of titlePatterns) {
        const match = cleanLine(part).match(pattern);
        if (!match?.[1]) continue;
        const candidate = cleanCompanyCandidate(match[1]);
        if (candidate) return shorten(candidate);
      }
    }
  }

  for (const { text } of openingLines) {
    const groupName = text.match(
      /^(.{3,100}?)\s+(?:and\s+(?:its\s+)?subsidiaries|و(?:الشركات|الجهات)\s+التابعة)(?:\s|$)/i,
    );
    if (groupName?.[1]) {
      const candidate = cleanCompanyCandidate(groupName[1]);
      if (candidate) return shorten(candidate);
    }
  }

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

function lineMatchesPattern(line: ReportLine, pattern: RegExp): boolean {
  return (
    pattern.test(normalizeSearchText(line.text)) ||
    line.parts.some((part) => pattern.test(normalizeSearchText(part.text)))
  );
}

function findStatementPage(
  lines: ReportLine[],
  titlePattern: RegExp,
  metricPatterns: RegExp[],
): number | null {
  const candidatePages = [
    ...new Set(
      lines.filter((line) => lineMatchesPattern(line, titlePattern))
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
      const hasFinancialRow = linesOnPage.some((line) => {
        if (!/\d/.test(line.text)) return false;
        return metricPatterns.some(
          (pattern) =>
            pattern.test(normalizeSearchText(line.text)) ||
            line.parts.some((part) =>
              pattern.test(normalizeSearchText(part.text)),
            ),
        );
      });
      return hasYearColumn && hasFinancialRow;
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

function findYearColumnHeader(
  lines: ReportLine[],
  page: number,
  year: string | null,
): { line: ReportLine; part: PositionedTextPart } | null {
  if (!year) return null;
  const header = lines
    .filter((line) => line.page === page)
    .flatMap((line) =>
      line.parts
        .filter((part) => normalizeSearchText(part.text) === year)
        .map((part) => ({ line, part })),
    )
    .sort((a, b) => a.part.x - b.part.x)[0];

  return header ?? null;
}

function findYearColumnX(
  lines: ReportLine[],
  page: number,
  year: string | null,
  statementTitlePattern: RegExp,
): number | null {
  if (!year) return null;
  const pageLines = lines.filter((line) => line.page === page);
  const yearHeaders = pageLines.flatMap((line) =>
    line.parts
      .filter((part) => normalizeSearchText(part.text) === year)
      .map((part) => ({ line, part })),
  );
  const pairedHeaders = yearHeaders.filter(({ line, part }) =>
    line.parts.some(
      (other) =>
        other !== part &&
        /^20\d{2}$/.test(normalizeSearchText(other.text)) &&
        normalizeSearchText(other.text) !== year,
    ),
  );
  const candidates = pairedHeaders.length > 0 ? pairedHeaders : yearHeaders;
  if (candidates.length === 0) return null;

  const headingLine = pageLines.find((line) =>
    lineMatchesPattern(line, statementTitlePattern),
  );
  const headingPart = headingLine?.parts.find((part) =>
    statementTitlePattern.test(normalizeSearchText(part.text)),
  );
  const headingX = headingPart?.x ?? headingLine?.parts[0]?.x;
  if (headingX === undefined) {
    return candidates.sort((a, b) => a.part.x - b.part.x)[0]?.part.x ?? null;
  }

  const headingText = headingPart?.text ?? headingLine?.text ?? "";
  const isRightToLeft = /[\u0600-\u06FF]/.test(headingText);
  const sameSide = candidates.filter(({ part }) =>
    isRightToLeft ? part.x < headingX : part.x > headingX,
  );
  const preferredCandidates = sameSide.length > 0 ? sameSide : candidates;
  return (
    preferredCandidates.sort(
      (a, b) =>
        Math.abs(a.part.x - headingX) - Math.abs(b.part.x - headingX),
    )[0]?.part.x ?? null
  );
}

function isYearColumnRestated(
  lines: ReportLine[],
  page: number,
  year: string,
  columnX: number,
): boolean {
  const header = lines
    .filter((line) => line.page === page)
    .flatMap((line) =>
      line.parts
        .filter((part) => normalizeSearchText(part.text) === year)
        .map((part) => ({ line, part })),
    )
    .sort(
      (a, b) =>
        Math.abs(a.part.x - columnX) - Math.abs(b.part.x - columnX),
    )[0];
  if (!header) return false;

  const yearCenterX = header.part.x + header.part.width / 2;
  return lines
    .filter(
      (line) =>
        line.page === page && Math.abs(line.y - header.line.y) <= 24,
    )
    .flatMap((line) => line.parts)
    .some((part) => {
      if (
        !/\brestated\b|(?:معاد|معادة|أعيد|أعيدت)\s+عرض(?:ها|ه|ة)?/i.test(
          part.text,
        )
      ) return false;
      const markerCenterX = part.x + part.width / 2;
      return Math.abs(markerCenterX - yearCenterX) <= 40;
    });
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

function sourceLabelFor(
  line: ReportLine,
  definition: (typeof financialLabels)[number],
): string {
  const labelPart = line.parts.find((part) =>
    definition.statementPatterns.some((pattern) =>
      pattern.test(normalizeSearchText(part.text)),
    ),
  );
  return shorten(labelPart?.text.trim() || definition.label);
}

function sourceExcerptFor(
  line: ReportLine,
  definition: (typeof financialLabels)[number],
  value: string | null,
): string {
  const label = sourceLabelFor(line, definition);
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
    .filter((row) => row.candidates.length > 0);
  const sourceLine = rowsWithCurrentValue[0]?.line ?? matchingLines[0];
  if (!sourceLine) return null;

  const candidateValues = new Set(
    rowsWithCurrentValue.flatMap((row) =>
      row.candidates.length === 1 ? [row.candidates[0]!.value] : [],
    ),
  );
  const hasAmbiguousRow = rowsWithCurrentValue.some(
    (row) => row.candidates.length > 1,
  );
  const candidateValue =
    rowsWithCurrentValue.length > 0 &&
    rowsWithCurrentValue.every((row) => row.candidates.length === 1) &&
    candidateValues.size === 1
      ? [...candidateValues][0] ?? null
      : null;
  const ambiguous = hasAmbiguousRow || candidateValues.size > 1;
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
      label: sourceLabelFor(sourceLine, definition),
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
      incomeStatementTitlePattern,
      financialLabels
        .filter(
          (definition) =>
            definition.category === "revenue" ||
            definition.category === "net_profit",
        )
        .flatMap((definition) => definition.statementPatterns),
    );
    const balanceStatementPage = findStatementPage(
      lines,
      balanceStatementTitlePattern,
      financialLabels
        .filter(
          (definition) =>
            definition.category === "assets" ||
            definition.category === "liabilities" ||
            definition.category === "equity",
        )
        .flatMap((definition) => definition.statementPatterns),
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
      const isBalanceMetric =
        definition.category === "assets" ||
        definition.category === "liabilities" ||
        definition.category === "equity";
      const statementTitlePattern = isBalanceMetric
        ? balanceStatementTitlePattern
        : incomeStatementTitlePattern;
      const yearColumnX =
        statementPage === null
          ? null
          : findYearColumnX(
              lines,
              statementPage,
              statementYear,
              statementTitlePattern,
            );
      const metricReportingPeriod =
        isBalanceMetric ? balanceReportingPeriod : reportingPeriod;
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
      } else if (!found && statementPage !== null) {
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
    const currentYearNumber = statementYear ? Number(statementYear) : Number.NaN;
    if (Number.isInteger(currentYearNumber)) {
      const previousYear = String(currentYearNumber - 1);
      const previousMetrics: ExtractedMetric[] = [];
      for (const definition of financialLabels) {
        const isBalanceMetric =
          definition.category === "assets" ||
          definition.category === "liabilities" ||
          definition.category === "equity";
        const statementPage = isBalanceMetric
          ? balanceStatementPage
          : incomeStatementPage;
        if (statementPage === null || !statementYear) continue;

        const currentPeriod = isBalanceMetric
          ? balanceReportingPeriod
          : reportingPeriod;
        const statementTitlePattern = isBalanceMetric
          ? balanceStatementTitlePattern
          : incomeStatementTitlePattern;
        const previousYearColumnX = findYearColumnX(
          lines,
          statementPage,
          previousYear,
          statementTitlePattern,
        );
        const previousPeriodBase = currentPeriod?.replace(
          statementYear,
          previousYear,
        );
        const previousIsRestated =
          previousYearColumnX !== null &&
          isYearColumnRestated(
            lines,
            statementPage,
            previousYear,
            previousYearColumnX,
          );
        const previousPeriod = previousPeriodBase
          ? `${previousPeriodBase}${previousIsRestated ? " (Restated)" : ""}`
          : null;
        if (
          !currentPeriod ||
          !previousPeriod ||
          previousPeriod === currentPeriod ||
          previousYearColumnX === null
        ) continue;

        const found = findStatementMetric(
          lines,
          statementPage,
          previousYear,
          previousYearColumnX,
          definition,
          currency,
          unitScale,
          previousPeriod,
        );
        if (found) previousMetrics.push(found.metric);
      }
      metrics.push(...previousMetrics);
    }

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
    if (incomeStatementPage === null) {
      extractionNotes.push(
        "No income-statement page with searchable text and a reporting-year column was identified; income figures remain unverified. Image-only statement pages may require OCR.",
      );
    }
    if (balanceStatementPage === null) {
      extractionNotes.push(
        "No balance-sheet page with searchable text and a reporting-year column was identified; balance-sheet figures remain unverified. Image-only statement pages may require OCR.",
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
