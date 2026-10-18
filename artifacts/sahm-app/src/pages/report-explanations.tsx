import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, BookOpen, Download, FileText, Lightbulb, Printer, Sparkles } from 'lucide-react';
import {
  getGetFinancialReportQueryKey,
  useGenerateReportExplanations,
  useGetFinancialReport,
} from '@workspace/api-client-react';
import { Brand } from '@/components/brand';

const copy = {
  en: {
    overline: 'PLAIN-LANGUAGE GUIDE', title: 'Understand your report',
    subtitle: 'Read the reported figures, their explanations, and the source evidence together.',
    report: 'Report', back: 'Back to dashboard', home: 'SAHM home', switch: 'العربية', print: 'Download summary',
    summary: 'The short version', figures: 'Choose a figure', source: 'Reference in the original report',
    page: 'Page', previousSource: 'Earlier-period reference', noExcerpt: 'No source excerpt is available for this figure.',
    value: 'Reported value', meaning: 'What Does This Number Mean?', context: 'How Should I Interpret This Number as an Investor?',
    period: 'Reporting period', currency: 'Currency', unit: 'Unit scale',
    unavailable: 'Unavailable in report', unitScales: { units: 'Units', thousands: 'Thousands', millions: 'Millions', unknown: 'Unknown' },
    meaningUnavailable: 'A source-grounded explanation is not saved for this figure yet.',
    contextUnavailable: 'A source-grounded investor context is not saved for this figure yet.',
    evidenceUnavailable: 'No explanation is generated because this figure lacks a verified value, source page, or source excerpt.',
    summaryUnavailable: 'No saved report summary is available.',
    metricLabels: { revenue: 'Revenue', net_profit: 'Net profit', assets: 'Total assets', liabilities: 'Total liabilities', equity: 'Total equity', other: 'Other' },
    generate: 'Prepare plain-language guide', generating: 'Preparing your guide…',
    notReady: 'Some explanations are not saved for this report yet.',
    generationHelp: 'SAHM will use only verified figures and their cited report excerpts.',
    preparingMetric: 'Preparing a source-grounded explanation…',
    loading: 'Opening your saved report…', error: 'We couldn’t open this report',
    errorSub: 'Try again, or return to the dashboard and open the saved report again.',
    retry: 'Try again', missing: 'This report could not be found.',
    generateError: 'AI explanations could not be saved. A general educational fallback is shown below; it is not a company-specific conclusion. Retry to prepare the report-specific interpretation.',
    fallbackLabel: 'Educational fallback — not a company-specific conclusion:',
    disclaimer: 'For learning only. SAHM reproduces information from the uploaded report and does not provide investment advice.',
    noItems: 'No figure-specific notes were saved for this report.',
    noMetrics: 'No figures were extracted from this report.',
    verified: 'Verified', unverified: 'Unverified', statusUnavailable: 'Unavailable',
  },
  ar: {
    overline: 'قراءة مبسطة', title: 'افهم تقريرك',
    subtitle: 'اقرأ الأرقام المنشورة وشروحاتها ومراجعها في التقرير الأصلي معاً.',
    report: 'التقرير', back: 'العودة إلى لوحة التقرير', home: 'الصفحة الرئيسية لسهم', switch: 'English', print: 'تنزيل الملخص',
    summary: 'ملخص سريع', figures: 'اختر رقماً', source: 'مرجع الرقم في التقرير الأصلي',
    page: 'الصفحة', previousSource: 'مرجع الفترة السابقة', noExcerpt: 'لا يتوفر مقتطف من المصدر لهذا الرقم.',
    value: 'القيمة المنشورة', meaning: 'ما هو هذا الرقم؟', context: 'كيف أقرأ هذا الرقم كمستثمر؟',
    period: 'الفترة المالية', currency: 'العملة', unit: 'مقياس الوحدة',
    unavailable: 'غير متوفر في التقرير', unitScales: { units: 'وحدات', thousands: 'آلاف', millions: 'ملايين', unknown: 'غير معروف' },
    meaningUnavailable: 'لم يُحفظ شرح مستند إلى المصدر لهذا الرقم بعد.',
    contextUnavailable: 'لم يُحفظ سياق مستند إلى المصدر لهذا الرقم بعد.',
    evidenceUnavailable: 'لا يتوفر شرح لأن الرقم يفتقر إلى قيمة مؤكدة أو صفحة مصدر أو مقتطف موثق.',
    summaryUnavailable: 'لا يتوفر ملخص محفوظ للتقرير.',
    metricLabels: { revenue: 'الإيرادات', net_profit: 'صافي الربح', assets: 'إجمالي الأصول', liabilities: 'إجمالي الالتزامات', equity: 'إجمالي حقوق الملكية', other: 'أخرى' },
    generate: 'إعداد قراءة مبسطة', generating: 'جارٍ إعداد القراءة…',
    notReady: 'لم تُحفظ بعض الشروحات لهذا التقرير بعد.',
    generationHelp: 'يستخدم سهم الأرقام التي تم التحقق منها ومقتطفات التقرير الموثقة فقط.',
    preparingMetric: 'جارٍ إعداد شرح مستند إلى المصدر…',
    loading: 'جارٍ فتح التقرير المحفوظ…', error: 'تعذّر فتح هذا التقرير',
    errorSub: 'حاول مرة أخرى، أو ارجع إلى لوحة التقرير وافتح التقرير المحفوظ.',
    retry: 'حاول مرة أخرى', missing: 'لم يتم العثور على هذا التقرير.',
    generateError: 'تعذّر حفظ شروحات الذكاء الاصطناعي. تظهر أدناه ملاحظة تعليمية عامة وليست استنتاجاً خاصاً بالشركة. حاول مرة أخرى لإعداد قراءة خاصة بالتقرير.',
    fallbackLabel: 'ملاحظة تعليمية عامة، وليست استنتاجاً خاصاً بالشركة:',
    disclaimer: 'للتثقيف فقط. يعرض سهم معلومات من التقرير المرفوع ولا يقدم نصيحة استثمارية.',
    noItems: 'لا توجد شروحات محفوظة خاصة بأرقام هذا التقرير.',
    noMetrics: 'لم يتم استخراج أرقام من هذا التقرير.',
    verified: 'تم التحقق', unverified: 'غير متحقق', statusUnavailable: 'غير متاح',
  },
};

function unavailable(value: string | null | undefined, empty: string) {
  return value ? value : empty;
}

function hasUsableText(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.length > 0 && ![
    'no saved plain-language meaning',
    'no saved investor context',
    'no saved report summary',
    'لا يتوفر شرح مبسط محفوظ',
    'لا يتوفر سياق محفوظ للمستثمر',
    'لا يتوفر ملخص محفوظ',
  ].some(marker => normalized.includes(marker));
}

function hasSubstantiveContext(value: string | null | undefined): boolean {
  if (!hasUsableText(value)) return false;
  const normalized = value!.trim().toLowerCase();
  const englishCitationOnly = /^this figure (?:is for|is reported for) the year ended\b.*\b(?:source page|page)\s+\d+\s*\.?$/.test(normalized);
  const arabicCitationOnly = /^(?:يتعلق|يخص|يظهر|يُبلغ عن) هذا الرقم.*السنة المنتهية.*(?:الصفحة|صفحة)\s*[0-9٠-٩]+.*(?:المصدر)?\s*[.،۔]?$/.test(normalized);
  return !englishCitationOnly && !arabicCitationOnly;
}

function hasSourceEvidence(metric: {
  verificationStatus: string;
  reportedValue: string | null;
  sourcePage: number | null;
  sourceExcerpt: string | null;
}) {
  return metric.verificationStatus === 'verified'
    && hasUsableText(metric.reportedValue)
    && typeof metric.sourcePage === 'number'
    && Number.isFinite(metric.sourcePage)
    && metric.sourcePage > 0
    && hasUsableText(metric.sourceExcerpt);
}

function isExplanationItemComplete(item: {
  meaningEnglish: string;
  meaningArabic: string;
  contextEnglish: string;
  contextArabic: string;
  sourcePage: number | null;
}, metric: FallbackMetric, metrics: FallbackMetric[]) {
  const previous = verifiedEarlierPeriod(metric, metrics);
  return isMetricExplanationText(item.meaningEnglish, metric, previous)
    && isMetricExplanationText(item.meaningArabic, metric, previous)
    && hasSubstantiveContext(item.contextEnglish)
    && isMetricExplanationText(item.contextEnglish, metric, previous)
    && hasSubstantiveContext(item.contextArabic)
    && isMetricExplanationText(item.contextArabic, metric, previous)
    && typeof item.sourcePage === 'number'
    && Number.isFinite(item.sourcePage)
    && item.sourcePage > 0;
}

function needsExplanationGeneration(
  metrics: FallbackMetric[],
  bundle: {
    summaryEnglish: string;
    summaryArabic: string;
    items: Array<{
      metricIndex: number;
      category: string;
      meaningEnglish: string;
      meaningArabic: string;
      contextEnglish: string;
      contextArabic: string;
      sourcePage: number | null;
    }>;
  } | null,
) {
  if (!bundle || !hasUsableText(bundle.summaryEnglish) || !hasUsableText(bundle.summaryArabic)) return true;

  const seenIndexes = new Set<number>();
  for (const item of bundle.items) {
    if (seenIndexes.has(item.metricIndex)) return true;
    seenIndexes.add(item.metricIndex);
  }

  return metrics.some((metric, metricIndex) => {
    if (!hasSourceEvidence(metric)) return false;
    const items = bundle.items.filter(item => item.metricIndex === metricIndex);
    return items.length !== 1
      || !isExplanationItemComplete(items[0], metric, metrics)
      || items[0].category !== metric.category
      || items[0].sourcePage !== metric.sourcePage;
  });
}

type FallbackMetric = {
  category: string;
  label: string;
  reportedValue: string | null;
  sourceExcerpt: string | null;
  reportingPeriod: string | null;
  currency: string | null;
  unitScale: string;
  verificationStatus: string;
  sourcePage: number | null;
};

function reportingYear(period: string | null): number | null {
  const years = period?.match(/(?:19|20)\d{2}/g);
  return years?.length ? Number(years[years.length - 1]) : null;
}

function parseReportedNumber(value: string | null): number | null {
  if (!value) return null;
  let candidate = value.trim().replace(/[−–]/g, '-');
  const isParentheticalNegative = /^\(.+\)$/.test(candidate);
  if (isParentheticalNegative) candidate = candidate.slice(1, -1);
  const isPlainNumber = /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(candidate);
  const isThousandsGrouped = /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(candidate);
  if (!isPlainNumber && !isThousandsGrouped) return null;
  if (isThousandsGrouped) candidate = candidate.replace(/,/g, '');
  const parsed = Number(candidate);
  if (!Number.isFinite(parsed)) return null;
  return isParentheticalNegative ? -Math.abs(parsed) : parsed;
}

function verifiedEarlierPeriod(metric: FallbackMetric, metrics: FallbackMetric[]): FallbackMetric | null {
  const currentYear = reportingYear(metric.reportingPeriod);
  if (
    currentYear === null ||
    metric.verificationStatus !== 'verified' ||
    !metric.currency ||
    metric.unitScale === 'unknown' ||
    parseReportedNumber(metric.reportedValue) === null
  ) return null;
  return metrics
    .filter(candidate => {
      const candidateYear = reportingYear(candidate.reportingPeriod);
      return candidate.category === metric.category
        && candidate.label.trim().toLowerCase() === metric.label.trim().toLowerCase()
        && hasSourceEvidence(candidate)
        && Boolean(candidate.currency)
        && candidate.currency === metric.currency
        && candidate.unitScale !== 'unknown'
        && candidate.unitScale === metric.unitScale
        && candidateYear !== null
        && candidateYear < currentYear
        && parseReportedNumber(candidate.reportedValue) !== null;
    })
    .sort((left, right) => (reportingYear(right.reportingPeriod) ?? 0) - (reportingYear(left.reportingPeriod) ?? 0))[0] ?? null;
}

function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[٫]/g, '.');
}

function isMetricExplanationText(
  value: string | null | undefined,
  metric: FallbackMetric,
  previous: FallbackMetric | null,
): boolean {
  if (!hasUsableText(value)) return false;
  if (/(?:source\s+)?page\s*[#:]?\s*[0-9٠-٩]+|\bp\.\s*[0-9٠-٩]+|(?:الصفحة|صفحة)\s*[0-9٠-٩]+|\.pdf\b/i.test(value!)) {
    return false;
  }

  const normalized = normalizeDigits(value!).toLowerCase();
  const textWithoutPercentages = normalized.replace(
    /[+-]?\d+(?:[.,]\d+)?\s*(?:%|٪|percent(?:age)?|بالمئة)/gi,
    '',
  );
  const years = [reportingYear(metric.reportingPeriod), reportingYear(previous?.reportingPeriod ?? null)]
    .filter((year): year is number => year !== null);
  if (years.some(year => new RegExp(`\\b${year}\\b`).test(textWithoutPercentages))) return false;

  const protectedAmounts = [
    parseReportedNumber(metric.reportedValue),
    parseReportedNumber(previous?.reportedValue ?? null),
  ].filter((amount): amount is number => amount !== null);
  const numberTokens = textWithoutPercentages.match(/[+-]?\d[\d,]*(?:\.\d+)?/g) ?? [];
  if (numberTokens.some(token => {
    const amount = parseReportedNumber(token);
    return amount !== null && protectedAmounts.some(protectedAmount => amount === protectedAmount);
  })) return false;

  const percentMatches = normalizeDigits(value!)
    .matchAll(/([+-]?\d+(?:[.,]\d+)?)\s*(?:%|٪|percent(?:age)?|بالمئة)/gi);
  const percentClaims = [...percentMatches].map(match => Number(match[1].replace(',', '.')));
  const currentAmount = parseReportedNumber(metric.reportedValue);
  const previousAmount = parseReportedNumber(previous?.reportedValue ?? null);
  const allowedPercent = currentAmount !== null && previousAmount !== null && previousAmount > 0
    ? Number((((currentAmount - previousAmount) / previousAmount) * 100).toFixed(1))
    : null;
  return percentClaims.every(claim => allowedPercent !== null && Math.abs(claim - allowedPercent) <= 0.06);
}

function educationalFallback(
  metric: FallbackMetric,
  metrics: FallbackMetric[],
  language: 'en' | 'ar',
) {
  const lineText = `${metric.label} ${metric.sourceExcerpt ?? ''}`;
  const bankOperatingRevenue = metric.category === 'revenue'
    && /net operating (?:income|revenue)|operating income|صافي\s*إيرادات\s*التشغيل/i.test(lineText);
  const hasPreviousPeriod = verifiedEarlierPeriod(metric, metrics) !== null;

  if (language === 'ar') {
    const meaning: Record<string, string> = {
      revenue: bankOperatingRevenue
        ? 'يشير هذا البند المصرفي إلى صافي دخل الأنشطة التشغيلية، وهو يختلف عن صافي الربح بعد المصاريف.'
        : 'تمثل الإيرادات المبالغ المسجلة من الأنشطة الرئيسية للشركة قبل الوصول إلى صافي الربح.',
      net_profit: 'صافي الربح هو ما يتبقى من الدخل بعد احتساب المصاريف والتكاليف المسجلة؛ وليس رصيداً نقدياً بحد ذاته.',
      assets: 'الأصول هي الموارد التي تملكها الشركة أو تسيطر عليها، وفقاً لما سجله التقرير.',
      liabilities: 'الالتزامات هي المبالغ والواجبات المالية التي تقع على الشركة تجاه الآخرين.',
      equity: 'حقوق الملكية هي الحصة المتبقية للمساهمين بعد طرح الالتزامات من الأصول.',
      other: `اقرأ البند «${metric.label}» وفق تعريفه في التقرير؛ لا تتوفر له هنا فئة مالية مؤكدة.`,
    };
    const comparisons: Record<string, string> = {
      revenue: 'قارن هذا البند بصافي الربح والمصاريف التشغيلية إن كانت منشورة.',
      net_profit: 'اقرأه مع الإيرادات والمصاريف، وقارن البند نفسه بين الفترات إن توفرت.',
      assets: 'اقرأه مع الالتزامات وحقوق الملكية، ومع التدفقات النقدية إن توفرت.',
      liabilities: 'اقرأه مع الأصول وحقوق الملكية، ومع التدفقات النقدية إن توفرت.',
      equity: 'اقرأه مع الأصول والالتزامات وصافي الربح، إن كانت هذه الأرقام موثقة.',
      other: 'قارنه بالمقاييس المرتبطة به في التقرير وبالفترات الأخرى الموثقة إن توفرت.',
    };
    const periodNote = hasPreviousPeriod
      ? 'تتوفر فترة سابقة موثقة لهذا البند؛ قارنه بين الفترتين قبل استخلاص معنى التغير.'
      : 'لا تتوفر في الأرقام المحفوظة فترة سابقة موثقة لهذا البند، لذلك لا يمكن تحديد اتجاهه.';
    return {
      meaning: meaning[metric.category] ?? meaning.other,
      context: `${periodNote} ${comparisons[metric.category] ?? comparisons.other} ولا يكفي هذا المؤشر وحده لإثبات سبب التغير أو كونه إيجابياً أو سلبياً.`,
    };
  }

  const meaning: Record<string, string> = {
    revenue: bankOperatingRevenue
      ? 'For a bank, this net operating income/revenue line reflects operating activity; it is distinct from net profit after expenses.'
      : 'Revenue is the amount recorded from a company’s main activities before arriving at net profit.',
    net_profit: 'Net profit is what remains after recorded income, costs, and expenses are accounted for; it is not a cash balance by itself.',
    assets: 'Assets are resources the company owns or controls, as recorded in the report.',
    liabilities: 'Liabilities are the company’s recorded financial obligations to others.',
    equity: 'Equity is the shareholders’ remaining interest after liabilities are deducted from assets.',
    other: `Read “${metric.label}” according to the report’s definition; no confirmed category-specific meaning is available here.`,
  };
  const comparisons: Record<string, string> = {
    revenue: 'Compare it with net profit and operating expenses, if reported.',
    net_profit: 'Read it alongside revenue and expenses, and compare the same line across periods if available.',
    assets: 'Read it with liabilities and equity, and cash flows if reported.',
    liabilities: 'Read it with assets and equity, and cash flows if reported.',
    equity: 'Read it with assets, liabilities, and net profit where verified.',
    other: 'Compare it with related verified measures in the report and other documented periods, if available.',
  };
  const periodNote = hasPreviousPeriod
    ? 'A verified earlier period is available for this metric; compare the same line across both periods before interpreting the change.'
    : 'No verified earlier-period value for this metric is saved, so its trend cannot be determined.';
  return {
    meaning: meaning[metric.category] ?? meaning.other,
    context: `${periodNote} ${comparisons[metric.category] ?? comparisons.other} A change alone does not establish why a result occurred or whether it is favorable.`,
  };
}

export default function ReportExplanationsPage() {
  const [language, setLanguage] = useState<'en' | 'ar'>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('sahm-language') === 'en' ? 'en' : 'ar',
  );
  const [requestedMetricIndex, setRequestedMetricIndex] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const value = new URLSearchParams(window.location.search).get('metric');
    if (value === null || !/^\d+$/.test(value)) return null;
    return Number(value);
  });
  const [autoGenerateRequested, setAutoGenerateRequested] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('generate') === '1',
  );
  const autoGenerationStartedFor = useRef<string | null>(null);
  const params = useParams<{ reportId: string }>();
  const reportId = params.reportId || '';
  const queryClient = useQueryClient();
  const query = useGetFinancialReport(reportId, {
    query: { enabled: Boolean(reportId), queryKey: getGetFinancialReportQueryKey(reportId) },
  });
  const generate = useGenerateReportExplanations();
  const t = copy[language];
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  function toggleLanguage() {
    const next = language === 'ar' ? 'en' : 'ar';
    setLanguage(next);
    window.localStorage.setItem('sahm-language', next);
  }
  function generateGuide() {
    generate.mutate({ reportId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetFinancialReportQueryKey(reportId) }),
    });
  }

  useEffect(() => {
    if (!autoGenerateRequested || !reportId || !query.data || autoGenerationStartedFor.current === reportId) return;

    autoGenerationStartedFor.current = reportId;
    setAutoGenerateRequested(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('generate');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    if (!needsExplanationGeneration(query.data.metrics, query.data.explanations)) return;
    generate.mutate({ reportId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetFinancialReportQueryKey(reportId) }),
    });
  }, [autoGenerateRequested, generate, query.data, queryClient, reportId]);

  if (query.isLoading) return <main className="loading-page" dir={dir} lang={language}>
    <section className="loading-card" role="status" data-testid="status-explanation-loading">
      <div className="loading-bars"><span /><span /><span /></div><p>{t.loading}</p>
    </section>
  </main>;

  if (query.isError || !query.data) return <main className="error-page" dir={dir} lang={language}>
    <section className="error-card">
      <div className="error-icon"><AlertCircle size={20} /></div><h2>{t.error}</h2>
      <p>{query.isError ? t.errorSub : t.missing}</p>
      {query.isError && <button className="retry-button" type="button" onClick={() => query.refetch()} data-testid="button-retry-explanation">{t.retry}</button>}
      <div><Link href="/" className="back-link" data-testid="link-explanation-home"><ArrowLeft size={14} />{t.home}</Link></div>
    </section>
  </main>;

  const report = query.data;
  const bundle = report.explanations;
  const needsGeneration = needsExplanationGeneration(report.metrics, bundle);
  const selectedIndex = requestedMetricIndex !== null && requestedMetricIndex >= 0 && requestedMetricIndex < report.metrics.length
    ? requestedMetricIndex
    : 0;
  const metric = report.metrics[selectedIndex];
  const rawItem = bundle?.items.find((explanation) => explanation.metricIndex === selectedIndex);
  const item = rawItem && rawItem.category === metric?.category ? rawItem : undefined;
  const sourcePage = item?.sourcePage ?? metric?.sourcePage ?? null;
  const metricTitle = metric ? (t.metricLabels[metric.category] ?? metric.label) : '';
  const metricEligible = metric ? hasSourceEvidence(metric) : false;
  const savedMeaning = item ? (language === 'ar' ? item.meaningArabic : item.meaningEnglish) : null;
  const savedContext = item ? (language === 'ar' ? item.contextArabic : item.contextEnglish) : null;
  const fallback = metric && metricEligible
    ? educationalFallback(metric, report.metrics, language)
    : null;
  const earlierPeriodMetric = metric
    ? verifiedEarlierPeriod(metric, report.metrics)
    : null;
  const meaningText = hasUsableText(savedMeaning)
    ? savedMeaning
    : generate.isError && fallback
      ? `${t.fallbackLabel} ${fallback.meaning}`
    : metricEligible
      ? (generate.isPending || autoGenerateRequested ? t.preparingMetric : t.meaningUnavailable)
      : t.evidenceUnavailable;
  const contextText = hasSubstantiveContext(savedContext)
    ? savedContext
    : generate.isError && fallback
      ? `${t.fallbackLabel} ${fallback.context}`
    : metricEligible
      ? (generate.isPending || autoGenerateRequested ? t.preparingMetric : t.contextUnavailable)
      : t.evidenceUnavailable;
  const statusLabel = metric?.verificationStatus === 'verified' ? t.verified
    : metric?.verificationStatus === 'unverified' ? t.unverified : t.statusUnavailable;

  return <main className="report-dashboard explanation-dashboard" dir={dir} lang={language}>
    <aside className="dashboard-rail">
      <Link href="/" className="rail-brand" aria-label={t.home} data-testid="link-explanation-home"><Brand variant="rail" language={language} /></Link>
      <div className="rail-caption">{t.report}</div>
      <nav className="rail-nav" aria-label={t.report}>
        <Link href={`/reports/${encodeURIComponent(reportId)}`} className="rail-link" aria-label={t.back} data-testid="link-explanation-dashboard"><ArrowLeft size={17} /><span>{t.back}</span></Link>
        <span className="rail-link active" aria-label={t.overline} aria-current="page"><BookOpen size={17} /><span>{t.overline}</span></span>
      </nav>
      <div className="rail-bottom">
        <div className="rail-note"><span className="rail-note-mark"><FileText size={15} /></span><span><b>{report.companyName || t.report}</b><small>{report.originalFileName}</small></span></div>
        <Link href={`/reports/${encodeURIComponent(reportId)}`} className="rail-back" aria-label={t.back} data-testid="link-back-dashboard"><ArrowLeft size={15} />{t.back}</Link>
      </div>
    </aside>
    <div className="dashboard-main">
      <header className="dashboard-topbar">
        <div className="topbar-context"><span className="context-dot" />{t.overline}<span className="context-divider">/</span>{report.originalFileName}</div>
        <button className="language-toggle" type="button" onClick={toggleLanguage} data-testid="button-language">{t.switch}</button>
      </header>
      <div className="report-wrap explanation-wrap">
        <div className="report-head">
          <div><div className="report-overline">{t.overline}</div><h1 className="report-heading" data-testid="text-explanation-title">{t.title}</h1>
            <div className="report-filename"><FileText size={14} />{report.companyName || t.report} · {report.reportingPeriod || report.originalFileName}</div>
          </div>
          <div className="report-actions no-print">
            <button className="action-button" type="button" onClick={() => window.print()} data-testid="button-download-summary"><Download size={14} />{t.print}<Printer size={13} /></button>
            <Link href={`/reports/${encodeURIComponent(reportId)}`} className="action-button" data-testid="link-back-dashboard"><ArrowLeft size={14} />{t.back}</Link>
          </div>
        </div>
        <section className="explanation-hero">
          <div className="explanation-hero-icon"><Sparkles size={20} /></div>
          <div><span className="snapshot-eyebrow">{t.overline}</span><p>{t.subtitle}</p></div>
        </section>

        {bundle && <section className="report-card explanation-summary-card">
          <div className="report-card-header"><div><div className="section-title">{t.summary}</div><div className="section-kicker">{report.originalFileName}</div></div><span className="saved-label">{language === 'ar' ? 'من التقرير' : 'REPORT-SPECIFIC'}</span></div>
          <div className="explanation-summary explanation-summary-page" data-testid="text-explanation-summary">
            {unavailable(language === 'ar' ? bundle.summaryArabic : bundle.summaryEnglish, t.summaryUnavailable)}
          </div>
        </section>}

        <section className="report-card explanation-selection-card">
          <div className="report-card-header">
            <div><div className="section-title">{t.figures}</div><div className="section-kicker">{report.metrics.length} · {language === 'ar' ? 'أرقام مستخرجة' : 'extracted figures'}</div></div>
          </div>
          {report.metrics.length ? <>
            <div className="metric-tabs metric-card-grid" role="tablist" aria-label={t.figures} data-testid="tabs-report-metrics">
              {report.metrics.map((entry, index) => <button
                type="button"
                id={`metric-tab-${index}`}
                role="tab"
                aria-selected={selectedIndex === index}
                aria-controls="panel-selected-metric"
                tabIndex={selectedIndex === index ? 0 : -1}
                className={`metric-tab${selectedIndex === index ? ' active' : ''}`}
                key={`${entry.label}-${index}`}
                onClick={() => setRequestedMetricIndex(index)}
                onKeyDown={(event) => {
                  const forwardKey = language === 'ar' ? 'ArrowLeft' : 'ArrowRight';
                  const backwardKey = language === 'ar' ? 'ArrowRight' : 'ArrowLeft';
                  let nextIndex: number | null = null;
                  if (event.key === forwardKey) nextIndex = (index + 1) % report.metrics.length;
                  else if (event.key === backwardKey) nextIndex = (index - 1 + report.metrics.length) % report.metrics.length;
                  else if (event.key === 'Home') nextIndex = 0;
                  else if (event.key === 'End') nextIndex = report.metrics.length - 1;
                  if (nextIndex !== null) {
                    event.preventDefault();
                    setRequestedMetricIndex(nextIndex);
                    document.getElementById(`metric-tab-${nextIndex}`)?.focus();
                  }
                }}
                data-testid={`tab-metric-${index}`}
              >
                <span className="metric-tab-label">{t.metricLabels[entry.category] ?? entry.label}</span>
                <strong className="metric-tab-value" data-testid={`value-selected-metric-${index}`}>{unavailable(entry.reportedValue, t.unavailable)}</strong>
                <span className="metric-tab-meta">
                  {unavailable(entry.currency, t.unavailable)} · {t.unitScales[entry.unitScale] ?? t.unitScales.unknown}
                </span>
                <span className="metric-tab-page">{t.page} {entry.sourcePage ?? t.unavailable}</span>
              </button>)}
            </div>
            {metric && <div className="selected-metric-panel" id="panel-selected-metric" role="tabpanel" aria-labelledby={`metric-tab-${selectedIndex}`} data-testid={`panel-metric-${selectedIndex}`}>
              <div className="selected-metric-heading">
                <div>
                  <div className="selected-metric-title">{metricTitle}</div>
                  <div className="selected-metric-period">{t.period}: {unavailable(metric.reportingPeriod, t.unavailable)}</div>
                </div>
                <span className={`status-pill status-${metric.verificationStatus === 'unavailable' ? 'unavailable' : metric.verificationStatus}`} data-testid={`status-selected-metric-${selectedIndex}`}>{statusLabel}</span>
              </div>
              <div className="explanation-copy-grid selected-explanation-copy">
                <div data-testid={`meaning-selected-metric-${selectedIndex}`}><h3>{t.meaning}</h3><p>{meaningText}</p></div>
                <div data-testid={`context-selected-metric-${selectedIndex}`}><h3>{t.context}</h3><p>{contextText}</p></div>
              </div>
              <div className="explanation-source selected-source" data-testid={`source-selected-metric-${selectedIndex}`}>
                <div className="source-top"><span>{t.source}</span><span>{t.page} {sourcePage ?? t.unavailable}</span></div>
                <p className="source-filename" data-testid="text-source-filename">{report.originalFileName}</p>
                <p className={`selected-source-excerpt${metric.sourceExcerpt ? '' : ' unavailable'}`} data-testid={`excerpt-selected-metric-${selectedIndex}`}>{unavailable(metric.sourceExcerpt, t.noExcerpt)}</p>
                {earlierPeriodMetric && <div className="comparison-source" data-testid="source-earlier-period">
                  <div className="source-top"><span>{t.previousSource}</span><span>{t.page} {earlierPeriodMetric.sourcePage}</span></div>
                  <p className="selected-source-excerpt">{earlierPeriodMetric.sourceExcerpt}</p>
                </div>}
              </div>
            </div>}
          </> : <div className="empty-metrics" data-testid="empty-explanation-metrics">{t.noMetrics}</div>}
        </section>

        {needsGeneration && <section className="report-card explanation-prompt" aria-live="polite">
          <div className="explanation-hero-icon"><Lightbulb size={20} /></div>
          <h2>{generate.isPending || autoGenerateRequested ? t.generating : t.notReady}</h2>
          <p>{t.generationHelp}</p>
          <button className="action-button primary" type="button" onClick={generateGuide} disabled={generate.isPending || autoGenerateRequested} data-testid="button-generate-explanations">
            {generate.isPending || autoGenerateRequested ? t.generating : generate.isError ? t.retry : t.generate}
          </button>
          {generate.isError && <p className="explanation-error" role="alert" data-testid="status-explanation-error">{t.generateError}</p>}
        </section>}
        {bundle && bundle.items.length === 0 && <div className="empty-metrics" data-testid="empty-explanation-items">{t.noItems}</div>}
        <div className="disclaimer" data-testid="text-explanation-disclaimer">{t.disclaimer}</div>
      </div>
      <footer className="page-footer"><span className="footer-brand">SAHM · سهم</span><span>{report.originalFileName}</span></footer>
    </div>
  </main>;
}
