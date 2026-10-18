type UnitScale = "units" | "thousands" | "millions" | "unknown";
type MetricCategory = "revenue" | "net_profit" | "assets" | "liabilities" | "equity" | "other";

type BaselineMetric = {
  label: string;
  category: MetricCategory;
  reportedValue: string | null;
  currency: string | null;
  unitScale: UnitScale;
  reportingPeriod: string | null;
  sourcePage: number | null;
  sourceExcerpt: string | null;
  verificationStatus: "verified" | "unverified" | "unavailable";
};

type BaselineReport = {
  id: string;
  originalFileName: string;
  companyName: string | null;
  reportingPeriod: string | null;
  currency: string | null;
  unitScale: UnitScale;
  metrics: BaselineMetric[];
  extractionNotes: string[];
  explanations: {
    summaryEnglish: string;
    summaryArabic: string;
    items: Array<{
      metricIndex: number;
      category: MetricCategory;
      meaningEnglish: string;
      meaningArabic: string;
      contextEnglish: string;
      contextArabic: string;
      sourcePage: number | null;
    }>;
    generatedAt: string;
  } | null;
  createdAt: string;
};

const baselineReport: BaselineReport = {
  id: "baseline-preview",
  originalFileName: "No report uploaded",
  companyName: null,
  reportingPeriod: null,
  currency: null,
  unitScale: "unknown" as const,
  metrics: [],
  extractionNotes: [],
  explanations: null,
  createdAt: new Date(0).toISOString(),
};

export function useExtractReport() {
  return {
    isPending: false,
    mutate: (
      _input: { data: { file: File } },
      _options?: {
        onSuccess?: (report: BaselineReport) => void;
        onError?: (error: { status?: number; message: string }) => void;
      },
    ) => undefined,
  };
}

export function getGetFinancialReportQueryKey(reportId: string) {
  return ["/reports", reportId] as const;
}

export function useGetFinancialReport(
  _reportId: string,
  _options?: unknown,
) {
  return {
    data: baselineReport,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null as Error | null,
    refetch: async () => ({ data: baselineReport }),
  };
}

export function useGenerateReportExplanations() {
  return {
    isPending: false,
    isError: false,
    mutate: (
      _input: { reportId: string },
      _options?: {
        onSuccess?: () => void;
        onError?: (error: Error) => void;
      },
    ) => undefined,
  };
}
