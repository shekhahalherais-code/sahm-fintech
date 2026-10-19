import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveFinancialSignals,
  getYearOverYearComparison,
  parseReportedFinancialValue,
} from "./financial-insights.ts";

function metric(overrides = {}) {
  return {
    label: "Net profit",
    category: "net_profit",
    reportedValue: "100",
    currency: "KWD",
    unitScale: "millions",
    reportingPeriod: "For the year ended 31 December 2024",
    sourcePage: 10,
    sourceExcerpt: "Net profit — 100",
    verificationStatus: "verified",
    ...overrides,
  };
}

test("parses only strict financial numeric text, including Arabic digits", () => {
  assert.equal(parseReportedFinancialValue("١٬٢٣٤٫٥"), 1234.5);
  assert.equal(parseReportedFinancialValue("(1,234.5)"), -1234.5);
  assert.equal(parseReportedFinancialValue("1,23"), null);
  assert.equal(parseReportedFinancialValue("about 100"), null);
});

test("calculates a YoY change only for sourced, verified, matching annual metrics", () => {
  const metrics = [
    metric({ reportedValue: "100", reportingPeriod: "For the year ended 31 December 2024", sourcePage: 8 }),
    metric({ reportedValue: "125", reportingPeriod: "For the year ended 31 December 2025", sourcePage: 9 }),
  ];
  assert.deepEqual(getYearOverYearComparison(metrics, 1), {
    currentYear: 2025,
    previousYear: 2024,
    direction: "increased",
    percentageChange: 25,
    currentSourcePage: 9,
    previousSourcePage: 8,
  });
});

test("rejects comparisons across mismatched units, currencies, incomplete evidence, and non-adjacent years", () => {
  const current = metric({ reportingPeriod: "For the year ended 31 December 2025" });
  assert.equal(getYearOverYearComparison([
    metric({ reportingPeriod: "For the year ended 31 December 2024", unitScale: "thousands" }),
    current,
  ], 1), null);
  assert.equal(getYearOverYearComparison([
    metric({ reportingPeriod: "For the year ended 31 December 2024", currency: "USD" }),
    current,
  ], 1), null);
  assert.equal(getYearOverYearComparison([
    metric({ reportingPeriod: "For the year ended 31 December 2024", verificationStatus: "unverified" }),
    current,
  ], 1), null);
  assert.equal(getYearOverYearComparison([
    metric({ reportingPeriod: "For the year ended 31 December 2023" }),
    current,
  ], 1), null);
  assert.equal(getYearOverYearComparison([
    metric({ reportingPeriod: "For the quarter ended 31 December 2024" }),
    metric({ reportingPeriod: "For the quarter ended 31 December 2025" }),
  ], 1), null);
});

test("returns cautious evidence-based signals and a neutral result when comparisons are absent", () => {
  const metrics = [
    metric({ label: "Revenue", category: "revenue", reportedValue: "100" }),
    metric({ label: "Revenue", category: "revenue", reportedValue: "120", reportingPeriod: "For the year ended 31 December 2025", sourcePage: 11 }),
    metric({ label: "Net profit", category: "net_profit", reportedValue: "20" }),
    metric({ label: "Net profit", category: "net_profit", reportedValue: "15", reportingPeriod: "For the year ended 31 December 2025", sourcePage: 12 }),
  ];
  const signals = deriveFinancialSignals(metrics);
  assert.deepEqual(signals.map(({ id, tone, percentageChange }) => ({ id, tone, percentageChange })), [
    { id: "revenue_increased", tone: "positive", percentageChange: 20 },
    { id: "profit_decreased", tone: "watch", percentageChange: -25 },
  ]);
  assert.deepEqual(deriveFinancialSignals([metric()]).map(({ id, tone }) => ({ id, tone })), [
    { id: "insufficient_data", tone: "neutral" },
  ]);
});

test("liabilities-to-assets changes are watch-level rather than automatic red flags", () => {
  const metrics = [
    metric({ label: "Total assets", category: "assets", reportedValue: "100", reportingPeriod: "For the year ended 31 December 2024", sourcePage: 20 }),
    metric({ label: "Total liabilities", category: "liabilities", reportedValue: "80", reportingPeriod: "For the year ended 31 December 2024", sourcePage: 21 }),
    metric({ label: "Total assets", category: "assets", reportedValue: "110", reportingPeriod: "For the year ended 31 December 2025", sourcePage: 22 }),
    metric({ label: "Total liabilities", category: "liabilities", reportedValue: "100", reportingPeriod: "For the year ended 31 December 2025", sourcePage: 23 }),
  ];
  const ratioSignal = deriveFinancialSignals(metrics).find((signal) => signal.category === "liabilities");
  assert.equal(ratioSignal?.id, "liabilities_share_increased");
  assert.equal(ratioSignal?.tone, "watch");
  assert.deepEqual(ratioSignal?.sourcePages, [22, 23, 20, 21]);
});
