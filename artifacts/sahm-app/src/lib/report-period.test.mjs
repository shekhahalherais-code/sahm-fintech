import assert from "node:assert/strict";
import test from "node:test";
import { localizeReportingPeriod } from "./report-period.ts";

test("translates Arabic annual reporting periods to English without changing the date", () => {
  assert.equal(
    localizeReportingPeriod("للسنة المنتهية في 31 ديسمبر 2025", "en"),
    "Year ended December 31, 2025",
  );
});

test("translates English annual reporting periods to Arabic without changing the date", () => {
  assert.equal(
    localizeReportingPeriod("For the year ended 31 December 2025", "ar"),
    "للسنة المنتهية في 31 ديسمبر 2025",
  );
});

test("keeps balance-sheet as-at dates distinct and translates them in both languages", () => {
  assert.equal(
    localizeReportingPeriod("as at 31 December 2025", "ar"),
    "كما في 31 ديسمبر 2025",
  );
  assert.equal(
    localizeReportingPeriod("كما في 31 ديسمبر 2025", "en"),
    "As at December 31, 2025",
  );
});

test("preserves restated comparative-period status in English and Arabic", () => {
  assert.equal(
    localizeReportingPeriod("for the year ended 31 December 2024 (Restated)", "en"),
    "Year ended December 31, 2024 (restated)",
  );
  assert.equal(
    localizeReportingPeriod("as at 31 December 2024 (Restated)", "ar"),
    "كما في 31 ديسمبر 2024 (معاد عرضها)",
  );
});

test("translates quarter and half-year periods and supports Arabic-Indic digits", () => {
  assert.equal(
    localizeReportingPeriod("For the quarter ended 30 June 2025", "ar"),
    "للربع المنتهي في 30 يونيو 2025",
  );
  assert.equal(
    localizeReportingPeriod("للفترة المنتهية في ٣١ ديسمبر ٢٠٢٥", "en"),
    "Period ended December 31, 2025",
  );
});

test("keeps unknown dates explicit instead of inventing a date", () => {
  assert.equal(
    localizeReportingPeriod("For the year ended", "en"),
    "Year ended — date unavailable in source",
  );
  assert.equal(localizeReportingPeriod(null, "ar"), null);
});
