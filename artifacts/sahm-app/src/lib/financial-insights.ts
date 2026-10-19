export type FinancialInsightCategory =
  | "revenue"
  | "net_profit"
  | "assets"
  | "liabilities"
  | "equity"
  | "other";

export type FinancialInsightMetric = {
  label: string;
  category: FinancialInsightCategory;
  reportedValue: string | null;
  currency: string | null;
  unitScale: "units" | "thousands" | "millions" | "unknown";
  reportingPeriod: string | null;
  sourcePage: number | null;
  sourceExcerpt: string | null;
  verificationStatus: "verified" | "unverified" | "unavailable";
};

export type FinancialComparison = {
  currentYear: number;
  previousYear: number;
  direction: "increased" | "decreased" | "unchanged";
  percentageChange: number | null;
  currentSourcePage: number;
  previousSourcePage: number;
};

export type FinancialSignal = {
  id:
    | "insufficient_data"
    | "revenue_increased"
    | "revenue_decreased"
    | "revenue_unchanged"
    | "profit_increased"
    | "profit_decreased"
    | "profit_unchanged"
    | "liabilities_share_increased"
    | "liabilities_share_decreased"
    | "liabilities_share_unchanged";
  tone: "positive" | "watch" | "neutral";
  category: FinancialInsightCategory | null;
  direction: "increased" | "decreased" | "unchanged" | null;
  percentageChange: number | null;
  sourcePages: number[];
  currentYear: number | null;
  previousYear: number | null;
};

function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

export function parseReportedFinancialValue(value: string | null): number | null {
  if (!value) return null;
  let candidate = normalizeDigits(value.trim())
    .replace(/[\u200e\u200f]/g, "")
    .replace(/[−–]/g, "-")
    .replace(/٫/g, ".")
    .replace(/٬/g, ",")
    .replace(/\s/g, "");
  const parentheticalNegative = /^\(.+\)$/.test(candidate);
  if (parentheticalNegative) candidate = candidate.slice(1, -1);

  const numeric = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
  if (!numeric.test(candidate)) return null;

  const parsed = Number(candidate.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return parentheticalNegative ? -Math.abs(parsed) : parsed;
}

function fullYear(period: string | null): number | null {
  if (!period) return null;
  const normalized = normalizeDigits(period).toLowerCase();
  if (
    /\b(?:q[1-4]|quarter(?:ly)?|interim|half[-\s]?year|six[-\s]?months?)\b|ربع|نصف\s*(?:السنة|سنوي)/i.test(
      normalized,
    )
  ) return null;
  if (
    !/\b(?:year\s+ended|year\s+ending|for\s+the\s+year|financial\s+year|fiscal\s+year|annual|fy\s*[-:/]?\s*(?:19|20)\d{2}|as\s+(?:at|of))\b|السنة\s+المنتهية|السنة\s+المالية|للسنة\s+المنتهية|للسنة\s+المالية|عن\s+السنة|كما\s+في/i.test(
      normalized,
    )
  ) return null;

  const years = normalized.match(/(?:19|20)\d{2}/g);
  return years?.length ? Number(years[years.length - 1]) : null;
}

function periodSignature(period: string | null): string | null {
  if (fullYear(period) === null || !period) return null;
  return normalizeDigits(period)
    .toLowerCase()
    .replace(/(?:19|20)\d{2}/g, "{year}")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizedLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasSourceEvidence(metric: FinancialInsightMetric): boolean {
  return metric.verificationStatus === "verified"
    && parseReportedFinancialValue(metric.reportedValue) !== null
    && Boolean(metric.currency?.trim())
    && metric.unitScale !== "unknown"
    && typeof metric.sourcePage === "number"
    && Number.isInteger(metric.sourcePage)
    && metric.sourcePage > 0
    && Boolean(metric.sourceExcerpt?.trim())
    && fullYear(metric.reportingPeriod) !== null;
}

function sameMetricLine(left: FinancialInsightMetric, right: FinancialInsightMetric): boolean {
  return left.category === right.category
    && normalizedLabel(left.label) === normalizedLabel(right.label)
    && left.currency === right.currency
    && left.unitScale === right.unitScale;
}

export function getYearOverYearComparison(
  metrics: FinancialInsightMetric[],
  currentIndex: number,
): FinancialComparison | null {
  const current = metrics[currentIndex];
  if (!current || !hasSourceEvidence(current)) return null;
  const currentYear = fullYear(current.reportingPeriod);
  const currentSignature = periodSignature(current.reportingPeriod);
  const currentAmount = parseReportedFinancialValue(current.reportedValue);
  if (currentYear === null || !currentSignature || currentAmount === null) return null;

  const matchingCurrent = metrics.filter((metric) =>
    hasSourceEvidence(metric)
    && sameMetricLine(metric, current)
    && fullYear(metric.reportingPeriod) === currentYear
    && periodSignature(metric.reportingPeriod) === currentSignature,
  );
  if (matchingCurrent.length !== 1) return null;

  const matchingPrevious = metrics.filter((metric) =>
    hasSourceEvidence(metric)
    && sameMetricLine(metric, current)
    && fullYear(metric.reportingPeriod) === currentYear - 1
    && periodSignature(metric.reportingPeriod) === currentSignature,
  );
  if (matchingPrevious.length !== 1) return null;

  const previous = matchingPrevious[0];
  const previousAmount = parseReportedFinancialValue(previous.reportedValue);
  if (
    previousAmount === null
    || typeof current.sourcePage !== "number"
    || typeof previous.sourcePage !== "number"
  ) return null;

  const direction = currentAmount > previousAmount
    ? "increased"
    : currentAmount < previousAmount
      ? "decreased"
      : "unchanged";
  const percentageChange = previousAmount > 0
    ? Number((((currentAmount - previousAmount) / previousAmount) * 100).toFixed(1))
    : null;

  return {
    currentYear,
    previousYear: currentYear - 1,
    direction,
    percentageChange,
    currentSourcePage: current.sourcePage,
    previousSourcePage: previous.sourcePage,
  };
}

function categoryMetricForPeriod(
  metrics: FinancialInsightMetric[],
  category: "assets" | "liabilities",
  year: number,
  signature: string,
): FinancialInsightMetric | null {
  const matches = metrics.filter((metric) =>
    metric.category === category
    && hasSourceEvidence(metric)
    && fullYear(metric.reportingPeriod) === year
    && periodSignature(metric.reportingPeriod) === signature,
  );
  return matches.length === 1 ? matches[0] : null;
}

function latestBalanceSheetPair(
  metrics: FinancialInsightMetric[],
): {
  currentYear: number;
  previousYear: number;
  currentAssets: number;
  currentLiabilities: number;
  previousAssets: number;
  previousLiabilities: number;
  sourcePages: number[];
} | null {
  const years = [...new Set(
    metrics
      .filter(hasSourceEvidence)
      .map((metric) => fullYear(metric.reportingPeriod))
      .filter((year): year is number => year !== null),
  )].sort((left, right) => right - left);

  for (const year of years) {
    const candidateAssets = metrics.filter((metric) =>
      metric.category === "assets" && hasSourceEvidence(metric)
      && fullYear(metric.reportingPeriod) === year,
    );
    const candidateLiabilities = metrics.filter((metric) =>
      metric.category === "liabilities" && hasSourceEvidence(metric)
      && fullYear(metric.reportingPeriod) === year,
    );
    if (candidateAssets.length !== 1 || candidateLiabilities.length !== 1) continue;

    const currentAssetsMetric = candidateAssets[0];
    const currentLiabilitiesMetric = candidateLiabilities[0];
    if (
      !currentAssetsMetric.currency
      || currentAssetsMetric.currency !== currentLiabilitiesMetric.currency
      || currentAssetsMetric.unitScale !== currentLiabilitiesMetric.unitScale
    ) continue;
    const signature = periodSignature(currentAssetsMetric.reportingPeriod);
    if (!signature || periodSignature(currentLiabilitiesMetric.reportingPeriod) !== signature) continue;

    const previousAssetsMetric = categoryMetricForPeriod(metrics, "assets", year - 1, signature);
    const previousLiabilitiesMetric = categoryMetricForPeriod(metrics, "liabilities", year - 1, signature);
    if (
      !previousAssetsMetric
      || !previousLiabilitiesMetric
      || previousAssetsMetric.currency !== currentAssetsMetric.currency
      || previousLiabilitiesMetric.currency !== currentAssetsMetric.currency
      || previousAssetsMetric.unitScale !== currentAssetsMetric.unitScale
      || previousLiabilitiesMetric.unitScale !== currentAssetsMetric.unitScale
    ) continue;

    const currentAssets = parseReportedFinancialValue(currentAssetsMetric.reportedValue);
    const currentLiabilities = parseReportedFinancialValue(currentLiabilitiesMetric.reportedValue);
    const previousAssets = parseReportedFinancialValue(previousAssetsMetric.reportedValue);
    const previousLiabilities = parseReportedFinancialValue(previousLiabilitiesMetric.reportedValue);
    if (
      currentAssets === null || currentAssets <= 0
      || currentLiabilities === null
      || previousAssets === null || previousAssets <= 0
      || previousLiabilities === null
    ) continue;

    return {
      currentYear: year,
      previousYear: year - 1,
      currentAssets,
      currentLiabilities,
      previousAssets,
      previousLiabilities,
      sourcePages: [
        currentAssetsMetric.sourcePage!,
        currentLiabilitiesMetric.sourcePage!,
        previousAssetsMetric.sourcePage!,
        previousLiabilitiesMetric.sourcePage!,
      ],
    };
  }
  return null;
}

export function deriveFinancialSignals(metrics: FinancialInsightMetric[]): FinancialSignal[] {
  const signals: FinancialSignal[] = [];
  const trendCategories = ["revenue", "net_profit"] as const;

  for (const category of trendCategories) {
    const candidates = metrics
      .map((metric, index) => ({ metric, index, year: fullYear(metric.reportingPeriod) }))
      .filter(({ metric, year }) =>
        metric.category === category && year !== null && hasSourceEvidence(metric),
      )
      .sort((left, right) => (right.year ?? 0) - (left.year ?? 0));
    if (!candidates.length) continue;
    const latestYear = candidates[0].year!;
    const latest = candidates.filter((candidate) => candidate.year === latestYear);
    if (latest.length !== 1) continue;

    const comparison = getYearOverYearComparison(metrics, latest[0].index);
    if (!comparison) continue;
    const prefix = category === "net_profit" ? "profit" : "revenue";
    signals.push({
      id: `${prefix}_${comparison.direction}` as FinancialSignal["id"],
      tone: comparison.direction === "increased"
        ? "positive"
        : comparison.direction === "decreased"
          ? "watch"
          : "neutral",
      category,
      direction: comparison.direction,
      percentageChange: comparison.percentageChange,
      sourcePages: [comparison.currentSourcePage, comparison.previousSourcePage],
      currentYear: comparison.currentYear,
      previousYear: comparison.previousYear,
    });
  }

  const balancePair = latestBalanceSheetPair(metrics);
  if (balancePair) {
    const currentRatio = balancePair.currentLiabilities / balancePair.currentAssets;
    const previousRatio = balancePair.previousLiabilities / balancePair.previousAssets;
    const ratioDirection = currentRatio > previousRatio + 0.0005
      ? "increased"
      : currentRatio < previousRatio - 0.0005
        ? "decreased"
        : "unchanged";
    signals.push({
      id: `liabilities_share_${ratioDirection}` as FinancialSignal["id"],
      tone: ratioDirection === "increased" ? "watch" : "neutral",
      category: "liabilities",
      direction: ratioDirection,
      percentageChange: null,
      sourcePages: [...new Set(balancePair.sourcePages)],
      currentYear: balancePair.currentYear,
      previousYear: balancePair.previousYear,
    });
  }

  return signals.length ? signals : [{
    id: "insufficient_data",
    tone: "neutral",
    category: null,
    direction: null,
    percentageChange: null,
    sourcePages: [],
    currentYear: null,
    previousYear: null,
  }];
}
