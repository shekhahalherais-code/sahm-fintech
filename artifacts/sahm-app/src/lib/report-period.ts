import type { SahmLanguage } from "./language";

type Month = { english: string; arabic: string; aliases: string[] };

const MONTHS: Month[] = [
  { english: "January", arabic: "يناير", aliases: ["january", "jan", "يناير", "كانون الثاني"] },
  { english: "February", arabic: "فبراير", aliases: ["february", "feb", "فبراير", "شباط"] },
  { english: "March", arabic: "مارس", aliases: ["march", "mar", "مارس", "آذار"] },
  { english: "April", arabic: "أبريل", aliases: ["april", "apr", "أبريل", "ابريل", "نيسان"] },
  { english: "May", arabic: "مايو", aliases: ["may", "مايو", "أيار", "ايار"] },
  { english: "June", arabic: "يونيو", aliases: ["june", "jun", "يونيو", "حزيران"] },
  { english: "July", arabic: "يوليو", aliases: ["july", "jul", "يوليو", "تموز"] },
  { english: "August", arabic: "أغسطس", aliases: ["august", "aug", "أغسطس", "اغسطس", "آب"] },
  { english: "September", arabic: "سبتمبر", aliases: ["september", "sept", "sep", "سبتمبر", "أيلول", "ايلول"] },
  { english: "October", arabic: "أكتوبر", aliases: ["october", "oct", "أكتوبر", "اكتوبر", "تشرين الأول", "تشرين الاول"] },
  { english: "November", arabic: "نوفمبر", aliases: ["november", "nov", "نوفمبر", "تشرين الثاني"] },
  { english: "December", arabic: "ديسمبر", aliases: ["december", "dec", "ديسمبر", "كانون الأول", "كانون الاول"] },
];

function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[\u200e\u200f]/g, "")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPeriodType(period: string): "as-at" | "year" | "quarter" | "half-year" | "period" {
  if (/\b(?:as\s+at|as\s+of|as\s+on)\b|كما\s+في/i.test(period)) return "as-at";
  if (/\b(?:quarter|quarterly|q[1-4])\b|الربع|للربع|ربع سنوي/i.test(period)) return "quarter";
  if (/\b(?:half[-\s]?year|six[-\s]?months?)\b|نصف السنة|للأشهر الستة|الأشهر الستة|الاشهر الستة/i.test(period)) return "half-year";
  if (/\b(?:year|annual|fiscal|financial)\b|السنة|للسنة|سنوي/i.test(period)) return "year";
  return "period";
}

function dateParts(period: string): { day?: number; month?: Month; year?: number; raw?: string } {
  const normalized = normalizeDigits(period);
  const iso = normalized.match(/\b((?:19|20)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    const [, yearText, monthText, dayText] = iso;
    const monthIndex = Number(monthText) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return { day: Number(dayText), month: MONTHS[monthIndex], year: Number(yearText) };
    }
  }

  const aliases = MONTHS.flatMap((month) =>
    month.aliases.map((alias) => ({ month, alias })),
  ).sort((left, right) => right.alias.length - left.alias.length);

  for (const { month, alias } of aliases) {
    const escaped = escapeRegExp(alias);
    const flags = /[a-z]/i.test(alias) ? "i" : "";
    const dayFirst = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])(\\d{1,2})(?:st|nd|rd|th)?[\\s,،]+${escaped}[\\s,،]+((?:19|20)\\d{2})(?!\\d)`,
      `${flags}u`,
    ).exec(normalized);
    if (dayFirst) return { day: Number(dayFirst[1]), month, year: Number(dayFirst[2]) };

    const monthFirst = new RegExp(
      `${escaped}[\\s,،]+(\\d{1,2})(?:st|nd|rd|th)?[\\s,،]+((?:19|20)\\d{2})(?!\\d)`,
      `${flags}u`,
    ).exec(normalized);
    if (monthFirst) return { day: Number(monthFirst[1]), month, year: Number(monthFirst[2]) };

    const monthAndYear = new RegExp(`${escaped}[\\s,،]+((?:19|20)\\d{2})(?!\\d)`, `${flags}u`).exec(normalized);
    if (monthAndYear) return { month, year: Number(monthAndYear[1]) };
  }

  const year = normalized.match(/(?:19|20)\d{2}/g)?.map(Number).at(-1);
  const numericDate = normalized.match(/\b\d{1,2}[/.]\d{1,2}[/.](?:19|20)\d{2}\b/);
  return { year, raw: numericDate?.[0] };
}

function formatDate(parts: ReturnType<typeof dateParts>, language: SahmLanguage): string | null {
  if (parts.raw) return parts.raw;
  if (!parts.year) return null;
  if (!parts.month) return String(parts.year);
  const month = language === "en" ? parts.month.english : parts.month.arabic;
  if (!parts.day) return language === "en" ? `${month} ${parts.year}` : `${month} ${parts.year}`;
  return language === "en"
    ? `${month} ${parts.day}, ${parts.year}`
    : `${parts.day} ${month} ${parts.year}`;
}

export function localizeReportingPeriod(
  value: string | null | undefined,
  language: SahmLanguage,
): string | null {
  if (!value?.trim()) return null;
  const period = normalizeDigits(value);
  const type = getPeriodType(period);
  const date = formatDate(dateParts(period), language);
  const restatedSuffix =
    /\brestated\b|(?:معاد|معادة|أعيد|أعيدت)\s+عرض(?:ها|ه|ة)?/i.test(period)
    ? language === "en"
      ? " (restated)"
      : " (معاد عرضها)"
    : "";

  if (language === "en") {
    const prefix = type === "as-at" ? "As at"
      : type === "year" ? "Year ended"
      : type === "quarter" ? "Quarter ended"
        : type === "half-year" ? "Six months ended"
          : "Period ended";
    return date
      ? `${prefix} ${date}${restatedSuffix}`
      : `${prefix} — date unavailable in source${restatedSuffix}`;
  }

  const prefix = type === "as-at" ? "كما في"
    : type === "year" ? "للسنة المنتهية في"
    : type === "quarter" ? "للربع المنتهي في"
      : type === "half-year" ? "للأشهر الستة المنتهية في"
        : "للفترة المنتهية في";
  return date
    ? `${prefix} ${date}${restatedSuffix}`
    : `${prefix} تاريخ غير متوفر في المصدر${restatedSuffix}`;
}
