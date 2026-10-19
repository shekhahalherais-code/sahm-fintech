import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetFinancialReportQueryKey,
  useGenerateReportExplanations,
  useGetFinancialReport,
} from '@workspace/api-client-react';
import { AlertCircle, ArrowLeft, BookOpen, ChartNoAxesCombined, Download, FileSearch, FileText, LayoutDashboard, Lightbulb, Printer, Settings2 } from 'lucide-react';
import { Brand } from '@/components/brand';
import { deriveFinancialSignals, getYearOverYearComparison } from '@/lib/financial-insights';

const words = {
  en: {
    back: 'Back to upload', overline: 'FINANCIAL DASHBOARD', report: 'Financial dashboard', filename: 'Source document', navigation: 'REPORT WORKSPACE', overview: 'Overview', figuresNav: 'Extracted figures', learning: 'Plain-language guide', settings: 'Report details', welcome: 'A clearer view of this report', welcomeSub: 'Figures below are reproduced from the source document. Nothing here is a recommendation.', summaryLabel: 'REPORT SNAPSHOT', sourcePages: 'Source pages', availableFigures: 'Extracted figures', verifiedFigures: 'Verified figures',
    company: 'Company', period: 'Reporting period', currency: 'Currency', scale: 'Unit scale',
    unavailable: 'Unavailable in report', metrics: 'Extracted figures', metricsSub: 'Values are shown as reported in the source document.',
    noMetrics: 'No figures could be extracted from this report.', category: 'Category', value: 'Reported value',
    status: 'Review status', verified: 'Verified', unverified: 'Unverified', missing: 'Unavailable',
    source: 'SOURCE EVIDENCE', page: 'Page', noSource: 'No source excerpt was available for this figure.',
    notes: 'Extraction notes', noNotes: 'No additional extraction notes were supplied.',
    disclaimer: 'SAHM displays information extracted from the uploaded document. Always check the cited source and original filing before making a financial decision.',
    loading: 'Retrieving your saved extraction…', failed: 'We couldn’t load this report', failedSub: 'The report may have moved or the saved link may be incomplete.',
    databaseUnavailable: 'MongoDB Atlas could not be reached. Check the cluster and its Network Access IP list.',
    retry: 'Try again', notFound: 'This report could not be found.', count: 'FIGURES TO REVIEW',
    units: 'Units', thousands: 'Thousands', millions: 'Millions', unknown: 'Unknown',
    chartTitle: 'Verified figures, at a glance', chartCaption: 'A within-report view of verified figures with matching period, currency and unit scale. Bar lengths show relative magnitude only; this is not a time series.',
    chartEmpty: 'A chart is unavailable because this report does not contain at least two verified numeric figures with matching units and reporting period.',
    explanations: 'Plain-language notes', explanationSub: 'A reading aid grounded in this report, not a recommendation.',
    explain: 'Explain these figures', explaining: 'Preparing explanations…', noExplanation: 'No simplified explanation has been saved for this report yet.',
    explanationError: 'We could not prepare explanations. Please try again.', explanationHint: 'Choose when you want a plain-language reading of this report.',
    print: 'Download summary', printTitle: 'SAHM report summary', printSource: 'Report source', printDisclaimer: 'This summary reproduces extracted report information and source references. It is educational only and is not investment advice.',
    metricLabels: { revenue: 'Revenue', net_profit: 'Net profit', assets: 'Total assets', liabilities: 'Total liabilities', equity: 'Total equity', other: 'Other' },
    categories: { revenue: 'Revenue', net_profit: 'Net profit', assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity', other: 'Other' },
    definition: {
      revenue: 'Revenue is income earned from the company’s activities during the reporting period.',
      revenueBank: 'For a bank, operating revenue reflects income from banking activities such as financing and fees.',
      net_profit: 'Net profit is what remains after expenses, finance costs and taxes are deducted from income.',
      assets: 'Assets are resources the company controls, such as cash, property or investments.',
      liabilities: 'Liabilities are amounts the company owes to others.',
      equity: 'Equity is the residual interest in the company after liabilities are deducted from assets.',
    },
    yoy: 'Year over year', insufficientComparison: 'Insufficient data for comparison.',
    signals: 'Financial Signals to Watch', signalsSub: 'Evidence-led observations, not conclusions or investment advice.',
    insufficientSignals: 'Not enough comparable, source-verified annual figures are available to identify a financial signal.',
    signalRevenueRise: 'Revenue growth can be a positive sign, but check whether profit and cash flow also improved; growth alone does not establish financial health.',
    signalProfitRise: 'Higher net profit can be encouraging; check revenue, expenses and cash flows before judging whether it is sustainable.',
    signalFall: 'A decrease in {category} merits review alongside related income, costs and cash flows; it does not establish a cause.',
    signalFlat: '{category} was unchanged year over year in the comparable figures.',
    signalLiabilityUp: 'Liabilities represent a larger share of assets than in the prior year. Treat this as a watch item, not an automatic red flag; sector context matters, especially for banks.',
    signalLiabilityDown: 'Liabilities represent a smaller share of assets than in the prior year. This is a comparison, not a conclusion about performance.',
    signalLiabilityFlat: 'Liabilities represented a similar share of assets year over year. Sector context still matters, especially for banks.',
    definitionLabel: 'In plain language',
    direction: { increased: 'increased', decreased: 'decreased', unchanged: 'unchanged' },
  },
  ar: {
    back: 'العودة إلى رفع التقرير', overline: 'لوحة التقرير المالية', report: 'لوحة التقرير المالية', filename: 'المستند المصدر', navigation: 'مساحة التقرير', overview: 'نظرة عامة', figuresNav: 'الأرقام المستخرجة', learning: 'قراءة مبسطة', settings: 'تفاصيل التقرير', welcome: 'قراءة أوضح لهذا التقرير', welcomeSub: 'الأرقام أدناه منقولة من المستند المصدر. ولا تمثل توصية استثمارية.', summaryLabel: 'ملخص التقرير', sourcePages: 'صفحات المصدر', availableFigures: 'الأرقام المستخرجة', verifiedFigures: 'أرقام تم التحقق منها',
    company: 'الشركة', period: 'الفترة المالية', currency: 'العملة', scale: 'مقياس الوحدة',
    unavailable: 'غير متوفر في التقرير', metrics: 'الأرقام المستخرجة', metricsSub: 'تُعرض القيم كما وردت في المستند المصدر.',
    noMetrics: 'تعذّر استخراج أرقام من هذا التقرير.', category: 'الفئة', value: 'القيمة المنشورة',
    status: 'حالة المراجعة', verified: 'تم التحقق', unverified: 'غير متحقق', missing: 'غير متوفر',
    source: 'دليل المصدر', page: 'الصفحة', noSource: 'لا يتوفر مقتطف من المصدر لهذا الرقم.',
    notes: 'ملاحظات الاستخراج', noNotes: 'لا توجد ملاحظات إضافية للاستخراج.',
    disclaimer: 'يعرض سهم المعلومات المستخرجة من المستند المرفوع. راجع المصدر المذكور والإفصاح الأصلي دائماً قبل اتخاذ أي قرار مالي.',
    loading: 'جارٍ استرجاع الاستخراج المحفوظ…', failed: 'تعذّر تحميل هذا التقرير', failedSub: 'ربما انتقل التقرير أو أن الرابط المحفوظ غير مكتمل.',
    databaseUnavailable: 'تعذّر الوصول إلى MongoDB Atlas. تحقق من العنقود وقائمة عناوين IP في Network Access.',
    retry: 'حاول مرة أخرى', notFound: 'لم يتم العثور على هذا التقرير.', count: 'أرقام للمراجعة',
    units: 'وحدات', thousands: 'آلاف', millions: 'ملايين', unknown: 'غير معروف',
    chartTitle: 'الأرقام المتحقق منها', chartCaption: 'عرض للأرقام المتحقق منها في التقرير نفسه بشرط تطابق الفترة والعملة ومقياس الوحدة. طول العمود يوضح القيمة النسبية فقط، وليس اتجاهاً زمنياً.',
    chartEmpty: 'لا يتوفر رسم بياني لعدم وجود رقمين متحقق منهما على الأقل، بصيغة رقمية وفترة ووحدات متطابقة.',
    explanations: 'قراءة مبسطة', explanationSub: 'مساعدة لفهم هذا التقرير، وليست توصية استثمارية.',
    explain: 'بسّط قراءة الأرقام', explaining: 'جارٍ إعداد الشرح…', noExplanation: 'لا يوجد شرح مبسط محفوظ لهذا التقرير حتى الآن.',
    explanationError: 'تعذّر إعداد الشرح. حاول مرة أخرى.', explanationHint: 'اختر متى تريد قراءة مبسطة لهذا التقرير.',
    print: 'تنزيل الملخص', printTitle: 'ملخص تقرير سهم', printSource: 'مصدر التقرير', printDisclaimer: 'يعيد هذا الملخص عرض معلومات مستخرجة من التقرير ومراجع مصادرها. المحتوى للتثقيف فقط وليس نصيحة استثمارية.',
    metricLabels: { revenue: 'الإيرادات', net_profit: 'صافي الربح', assets: 'إجمالي الأصول', liabilities: 'إجمالي الالتزامات', equity: 'إجمالي حقوق الملكية', other: 'أخرى' },
    categories: { revenue: 'الإيرادات', net_profit: 'صافي الربح', assets: 'الأصول', liabilities: 'الالتزامات', equity: 'حقوق الملكية', other: 'أخرى' },
    definition: {
      revenue: 'الإيرادات هي الدخل الناتج عن أنشطة الشركة خلال الفترة المالية.',
      revenueBank: 'في البنوك، تعكس الإيرادات التشغيلية الدخل من الأنشطة المصرفية مثل التمويل والرسوم.',
      net_profit: 'صافي الربح هو ما يتبقى بعد خصم المصروفات وتكاليف التمويل والضرائب من الدخل.',
      assets: 'الأصول هي الموارد التي تسيطر عليها الشركة، مثل النقد والعقارات والاستثمارات.',
      liabilities: 'الالتزامات هي المبالغ المستحقة على الشركة للآخرين.',
      equity: 'حقوق الملكية هي المتبقي من الأصول بعد خصم الالتزامات.',
    },
    yoy: 'مقارنة سنوية', insufficientComparison: 'لا تتوفر بيانات كافية للمقارنة',
    signals: 'مؤشرات تستحق الانتباه', signalsSub: 'ملاحظات تستند إلى الأدلة وليست استنتاجات أو توصيات استثمارية.',
    insufficientSignals: 'لا تتوفر أرقام سنوية موثقة وقابلة للمقارنة بما يكفي لتحديد مؤشر مالي.',
    signalRevenueRise: 'قد تكون زيادة الإيرادات علامة إيجابية، لكن تحقق مما إذا كان صافي الربح والتدفق النقدي قد تحسنا أيضاً؛ فالنمو وحده لا يثبت سلامة الأداء.',
    signalProfitRise: 'قد تكون زيادة صافي الربح مشجعة، لكن راجع الإيرادات والمصروفات والتدفقات النقدية قبل الحكم على استدامتها.',
    signalFall: 'يستحق انخفاض {category} مراجعة الإيرادات والتكاليف والتدفقات النقدية المرتبطة به؛ لكنه لا يثبت سبب الانخفاض.',
    signalFlat: 'لم تتغير {category} على أساس سنوي في الأرقام القابلة للمقارنة.',
    signalLiabilityUp: 'أصبحت الالتزامات تمثل حصة أكبر من الأصول مقارنة بالسنة السابقة. هذا مؤشر للمراجعة وليس علامة سلبية تلقائية؛ ويهم سياق القطاع، خصوصاً البنوك.',
    signalLiabilityDown: 'أصبحت الالتزامات تمثل حصة أقل من الأصول مقارنة بالسنة السابقة. هذه مقارنة وليست حكماً على الأداء.',
    signalLiabilityFlat: 'ظلت حصة الالتزامات من الأصول متقاربة على أساس سنوي. يظل سياق القطاع مهماً، خصوصاً للبنوك.',
    definitionLabel: 'بعبارة مبسطة',
    direction: { increased: 'ارتفع', decreased: 'انخفض', unchanged: 'لم يتغير' },
  },
};

function unavailable(text: string | null | undefined, emptyText: string) {
  return text ? <>{text}</> : <span className="unavailable">{emptyText}</span>;
}

function localizedNote(note: string, language: 'en' | 'ar'): string {
  if (language === 'en') return note;
  const ambiguous = note.match(/^(.*?) appears alongside multiple figures on page (\d+); no value was selected\.$/);
  if (ambiguous) {
    const label = ambiguous[1] === 'Revenue' ? 'الإيرادات' : ambiguous[1] === 'Net profit' ? 'صافي الربح' : ambiguous[1] === 'Total assets' ? 'إجمالي الأصول' : ambiguous[1] === 'Total liabilities' ? 'إجمالي الالتزامات' : 'إجمالي حقوق الملكية';
    return `ظهر ${label} مع عدة أرقام في الصفحة ${ambiguous[2]}؛ لم يتم اختيار قيمة.`;
  }
  const notes: Record<string, string> = {
    'Currency was not uniquely identifiable from the report text.': 'تعذّر تحديد العملة بشكل موثوق من نص التقرير.',
    "The report's unit scale could not be confirmed; values are not converted.": 'تعذّر تأكيد مقياس الوحدات؛ لم يتم تحويل القيم.',
    'A reporting period could not be confidently identified.': 'تعذّر تحديد الفترة المالية بشكل موثوق.',
    'A company name could not be confidently identified from a labeled field.': 'تعذّر تحديد اسم الشركة بشكل موثوق من حقل واضح.',
    'No supported financial metric labels were confidently identified.': 'تعذّر تحديد مؤشرات مالية مدعومة بشكل موثوق.',
  };
  return notes[note] ?? note;
}

function numericFromReportedText(value: string | null, currency: string | null): number | null {
  if (!value) return null;
  let candidate = value.trim();
  if (currency) {
    const escapedCurrency = currency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    candidate = candidate.replace(new RegExp(escapedCurrency, 'gi'), '').trim();
  }
  candidate = candidate.replace(/,/g, '').replace(/\s/g, '');
  const negativeParentheses = /^\(.*\)$/.test(candidate);
  if (negativeParentheses) candidate = candidate.slice(1, -1);
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(candidate)) return null;
  const parsed = Number(candidate);
  if (!Number.isFinite(parsed)) return null;
  return negativeParentheses ? -Math.abs(parsed) : parsed;
}

export default function ReportReviewPage() {
  const [language, setLanguage] = useState<'en' | 'ar'>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('sahm-language') === 'en' ? 'en' : 'ar',
  );
  const params = useParams<{ reportId: string }>();
  const reportId = params.reportId || '';
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const query = useGetFinancialReport(reportId, {
    query: { enabled: Boolean(reportId), queryKey: getGetFinancialReportQueryKey(reportId) },
  });
  const explain = useGenerateReportExplanations();
  const autoGenerationHandled = useRef<string | null>(null);
  const t = words[language];
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  function changeLanguage() {
    const next = language === 'en' ? 'ar' : 'en';
    setLanguage(next);
    window.localStorage.setItem('sahm-language', next);
  }

  function generateExplanations() {
    explain.mutate({ reportId }, {
      onSuccess: bundle => queryClient.setQueryData(getGetFinancialReportQueryKey(reportId), (old: typeof query.data) =>
        old ? { ...old, explanations: bundle } : old),
    });
  }

  useEffect(() => {
    if (!query.data || autoGenerationHandled.current === reportId) return;
    if (new URLSearchParams(window.location.search).get('generate') !== '1') return;
    autoGenerationHandled.current = reportId;
    navigate(`/reports/${encodeURIComponent(reportId)}`, { replace: true });
    if (!query.data.explanations) generateExplanations();
  }, [query.data, reportId]);

  if (query.isLoading) return <main className="loading-page" dir={dir} lang={language}>
    <section className="loading-card" role="status"><div className="loading-bars"><span /><span /><span /></div><p>{t.loading}</p></section>
  </main>;

  if (query.isError || !query.data) return <main className="error-page" dir={dir} lang={language}>
    <section className="error-card">
      <div className="error-icon"><AlertCircle size={20} /></div><h2>{t.failed}</h2>
      <p>{query.isError ? (query.error instanceof Error && query.error.message.includes('HTTP 503') ? t.databaseUnavailable : t.failedSub) : t.notFound}</p>
      {query.isError && <button className="retry-button" type="button" onClick={() => query.refetch()} data-testid="button-retry-report">{t.retry}</button>}
      <div><Link href="/" className="back-link" style={{ marginTop: 20, marginBottom: 0 }} data-testid="link-back-home"><ArrowLeft size={14} />{t.back}</Link></div>
    </section>
  </main>;

  const report = query.data;
  const unitLabel = t[report.unitScale] ?? t.unknown;
  const chartCandidates = report.metrics
    .filter(metric => metric.verificationStatus === 'verified' && metric.reportingPeriod && metric.currency && metric.unitScale !== 'unknown')
    .map(metric => ({ metric, numeric: numericFromReportedText(metric.reportedValue, metric.currency) }))
    .filter((entry): entry is { metric: typeof report.metrics[number]; numeric: number } => entry.numeric !== null);
  const chartGroup: typeof chartCandidates = chartCandidates.reduce((best, entry) => {
    const group = chartCandidates.filter(({ metric }) =>
      metric.reportingPeriod === entry.metric.reportingPeriod &&
      metric.currency === entry.metric.currency &&
      metric.unitScale === entry.metric.unitScale,
    );
    return group.length > best.length ? group : best;
  }, []);
  const chartReady = chartGroup.length >= 2;
  const maxMagnitude = chartReady ? Math.max(...chartGroup.map(entry => Math.abs(entry.numeric)), Number.EPSILON) : 1;
  const explanations = report.explanations;
  const summary = explanations ? (language === 'ar' ? explanations.summaryArabic : explanations.summaryEnglish) : null;
  const verifiedCount = report.metrics.filter(metric => metric.verificationStatus === 'verified').length;
  const summaryCategories = ['revenue', 'net_profit', 'assets', 'liabilities', 'equity'] as const;
  const summaryMetrics = summaryCategories.map(category => {
    const index = report.metrics.findIndex(metric => metric.category === category && metric.reportingPeriod === report.reportingPeriod);
    const fallbackIndex = report.metrics.findIndex(metric => metric.category === category);
    const metricIndex = index >= 0 ? index : fallbackIndex;
    return { category, metric: metricIndex >= 0 ? report.metrics[metricIndex] : undefined, metricIndex };
  });
  const savedMeanings = new Map((report.explanations?.items ?? []).map(item => [item.metricIndex, language === 'ar' ? item.meaningArabic : item.meaningEnglish]));
  const signals = deriveFinancialSignals(report.metrics);
  const bankAware = /\b(bank|banking)\b|بنك|مصرف/i.test(report.companyName ?? '');
  const signalCopy = (id: string, category: string) => {
    const label = t.metricLabels[category as keyof typeof t.metricLabels] ?? category;
    if (id === 'revenue_increased') return t.signalRevenueRise;
    if (id === 'profit_increased') return t.signalProfitRise;
    if (id === 'revenue_decreased' || id === 'profit_decreased') return t.signalFall.replace('{category}', label);
    if (id === 'revenue_unchanged' || id === 'profit_unchanged') return t.signalFlat.replace('{category}', label);
    if (id === 'liabilities_share_increased') return t.signalLiabilityUp;
    if (id === 'liabilities_share_decreased') return t.signalLiabilityDown;
    return t.signalLiabilityFlat;
  };

  return (
    <main className="report-dashboard" dir={dir} lang={language}>
      <aside className="dashboard-rail">
         <Link href="/" className="rail-brand" aria-label="SAHM home" data-testid="link-home"><Brand variant="rail" language={language} /></Link>
        <div className="rail-caption">{t.navigation}</div>
        <nav className="rail-nav" aria-label={t.navigation}>
          <a className="rail-link active" href="#report-overview" aria-label={t.overview} aria-current="page"><LayoutDashboard size={17} /><span>{t.overview}</span></a>
          <a className="rail-link" href="#extracted-figures" aria-label={t.figuresNav}><FileSearch size={17} /><span>{t.figuresNav}</span></a>
          <Link className="rail-link" href={`/reports/${encodeURIComponent(reportId)}/explanations`} aria-label={t.learning} data-testid="link-report-explanations"><BookOpen size={17} /><span>{t.learning}</span></Link>
          <a className="rail-link" href="#report-details" aria-label={t.settings}><Settings2 size={17} /><span>{t.settings}</span></a>
        </nav>
        <div className="rail-bottom">
          <div className="rail-note"><span className="rail-note-mark"><FileText size={15} /></span><span><b>{t.filename}</b><small>{report.originalFileName}</small></span></div>
          <Link href="/" className="rail-back" aria-label={t.back} data-testid="link-back-home"><ArrowLeft size={15} />{t.back}</Link>
        </div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-context"><span className="context-dot" />{t.overline}<span className="context-divider">/</span>{report.originalFileName}</div>
          <div className="header-right">
            <span className="dashboard-locale">{language === 'ar' ? 'العربية' : 'EN'}</span>
            <button className="language-toggle" type="button" onClick={changeLanguage} data-testid="button-language">{language === 'en' ? 'العربية' : 'English'}</button>
          </div>
        </header>
        <div className="report-wrap">
        <div className="report-head" id="report-overview">
          <div><div className="report-overline">{t.overline}</div><h1 className="report-heading">{report.companyName || t.report}</h1>
            <div className="report-filename"><FileText size={14} style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />{report.originalFileName}</div>
          </div>
          <div className="report-actions">
            <div className="review-count" data-testid="text-metric-count">{String(report.metrics.length).padStart(2, '0')} &nbsp;{t.count}</div>
            <button className="action-button" type="button" onClick={() => window.print()} data-testid="button-download-summary"><Download size={14} />{t.print}<Printer size={13} /></button>
          </div>
        </div>

        <section className="snapshot-banner">
          <div className="snapshot-copy"><span className="snapshot-eyebrow">{t.summaryLabel}</span><h2>{t.welcome}</h2><p>{t.welcomeSub}</p></div>
          <div className="snapshot-meta">
            <div><span>{t.period}</span><strong>{unavailable(report.reportingPeriod, t.unavailable)}</strong></div>
            <div><span>{t.currency} · {t.scale}</span><strong>{[report.currency, unitLabel].filter(Boolean).join(' · ') || t.unavailable}</strong></div>
          </div>
        </section>

        <section className="summary-grid" aria-label={t.summaryLabel}>
          {summaryMetrics.map(({ category, metric, metricIndex }, index) => {
            const comparison = metric ? getYearOverYearComparison(report.metrics, metricIndex) : null;
            const explanation = metric ? savedMeanings.get(metricIndex) : undefined;
            const definition = category === 'revenue' && bankAware ? t.definition.revenueBank : t.definition[category];
            const cardContent = <>
              <div className="summary-card-top"><span className="summary-card-label">{t.metricLabels[category]}</span><span className="summary-card-icon"><ChartNoAxesCombined size={15} /></span></div>
              <strong className="summary-card-value">{unavailable(metric?.reportedValue, t.unavailable)}</strong>
              <p className="summary-card-definition" data-testid={`summary-definition-${category}`}>{explanation || definition}</p>
              <div className="summary-card-foot" data-testid={`summary-details-${category}`}>
                {metric ? <>
                  <span>{t.currency}: {metric.currency || t.unavailable} · {t.scale}: {metric.unitScale !== 'unknown' ? t[metric.unitScale] : t.unknown}</span>
                  <span>{t.period}: {metric.reportingPeriod || t.unavailable}</span>
                  <span>{t.page}: {metric.sourcePage ?? t.unavailable}</span>
                  <span className={`status-pip status-${metric.verificationStatus}`} />
                  <span>{t.status}: {metric.verificationStatus === 'verified' ? t.verified : metric.verificationStatus === 'unverified' ? t.unverified : t.missing}</span>
                  <span className="summary-yoy" data-testid={`summary-yoy-${category}`}>{t.yoy}: {comparison ? `${comparison.percentageChange === null ? comparison.direction : `${comparison.percentageChange > 0 ? '+' : ''}${comparison.percentageChange}%`} (${comparison.previousYear}–${comparison.currentYear}) · ${t.page} ${comparison.previousSourcePage}, ${comparison.currentSourcePage}` : t.insufficientComparison}</span>
                </> : <>
                  <span>{t.currency}: {t.unavailable} · {t.scale}: {t.unavailable}</span>
                  <span>{t.period}: {t.unavailable}</span>
                  <span>{t.page}: {t.unavailable}</span>
                  <span>{t.status}: {t.missing}</span>
                  <span className="summary-yoy" data-testid={`summary-yoy-${category}`}>{t.yoy}: {t.insufficientComparison}</span>
                </>}
              </div>
            </>;
            return metric ? <Link
              className={`summary-card summary-card-${index + 1} summary-card-link`}
              key={category}
              href={`/reports/${encodeURIComponent(reportId)}/explanations?metric=${report.metrics.indexOf(metric)}`}
              data-testid={`summary-${category}`}
              aria-label={`${t.metricLabels[category]} · ${t.explanations}`}
            >{cardContent}</Link> : <article className={`summary-card summary-card-${index + 1}`} key={category} data-testid={`summary-${category}`}>{cardContent}</article>;
          })}
        </section>

        <section className="report-card signals-card" aria-labelledby="signals-heading" data-testid="section-financial-signals">
          <div className="report-card-header"><div><div className="section-title" id="signals-heading">{t.signals}</div><div className="section-kicker">{t.signalsSub}</div></div></div>
          <div className="signals-list">
            {signals.map((signal, index) => signal.id === 'insufficient_data'
              ? <div className="signal-item signal-neutral" key={signal.id} data-testid="signal-insufficient-data"><span className="signal-tone">{language === 'ar' ? 'محايد' : 'NEUTRAL'}</span><p>{t.insufficientSignals}</p></div>
              : <article className={`signal-item signal-${signal.tone}`} key={`${signal.id}-${index}`} data-testid={`signal-${signal.id}`}>
                <span className="signal-tone">{signal.tone === 'positive' ? (language === 'ar' ? 'محتمل إيجابي' : 'POTENTIAL POSITIVE') : signal.tone === 'watch' ? (language === 'ar' ? 'للمراجعة' : 'FOR REVIEW') : (language === 'ar' ? 'محايد' : 'NEUTRAL')}</span>
                <p>{signalCopy(signal.id, signal.category ?? 'other')}</p>
                <div className="signal-meta" data-testid={`signal-source-${index}`}>
                  {signal.percentageChange !== null && <span>{signal.percentageChange > 0 ? '+' : ''}{signal.percentageChange}%</span>}
                  {signal.currentYear !== null && signal.previousYear !== null && <span>{signal.previousYear}–{signal.currentYear}</span>}
                  <span>{t.sourcePages}: {signal.sourcePages.length ? signal.sourcePages.join(', ') : t.unavailable}</span>
                </div>
              </article>
            )}
          </div>
        </section>

        <section className="report-card report-meta-card" id="report-details" aria-label={t.report}>
          <div className="report-card-header"><div><div className="section-title">{t.report}</div><div className="section-kicker">{t.filename}</div></div></div>
          <div className="meta-grid">
            <Meta label={t.company} value={report.companyName} empty={t.unavailable} testId="text-company" />
            <Meta label={t.period} value={report.reportingPeriod} empty={t.unavailable} testId="text-reporting-period" />
            <Meta label={t.currency} value={report.currency} empty={t.unavailable} testId="text-currency" />
            <div className="meta-item" data-testid="text-unit-scale"><div className="meta-label">{t.scale}</div><div className="meta-value">{unitLabel}</div></div>
          </div>
        </section>

        <section className="report-card" id="extracted-figures">
          <div className="report-card-header">
            <div><div className="section-title">{t.metrics}</div><div className="section-kicker">{t.metricsSub}</div></div>
            <div className="step-index">{t.status}</div>
          </div>
          {report.metrics.length === 0 ? <div className="empty-metrics" data-testid="empty-extracted-metrics">{t.noMetrics}</div> :
            <div className="metrics-list">
              {report.metrics.map((metric, index) => {
                const status = metric.verificationStatus;
                const statusLabel = status === 'verified' ? t.verified : status === 'unverified' ? t.unverified : t.missing;
                return <article className="metric-row" key={`${metric.label}-${index}`} data-testid={`row-metric-${index}`}>
                  <div><div className="metric-label">{t.metricLabels[metric.category] ?? metric.label}</div><div className="metric-category">{t.category}: {t.categories[metric.category] ?? metric.category}</div></div>
                  <div className={`status-pill status-${status}`} data-testid={`status-metric-${index}`}>{statusLabel}</div>
                  <div><div className="metric-value">{unavailable(metric.reportedValue, t.unavailable)}</div>
                    <div className="metric-context">{[metric.currency, metric.unitScale !== 'unknown' ? (t[metric.unitScale] ?? t.unknown) : ''].filter(Boolean).join(' · ') || t.unavailable}</div>
                  </div>
                  <div className="metric-context">{metric.reportingPeriod || t.unavailable}</div>
                  <div className="source-block">
                    <div className="source-top"><span>{t.source}</span><span>{t.page} {metric.sourcePage ?? t.unavailable}</span></div>
                    <div className={`source-excerpt${metric.sourceExcerpt ? '' : ' unavailable'}`}>{metric.sourceExcerpt || t.noSource}</div>
                  </div>
                </article>;
              })}
            </div>
          }
        </section>

        <section className="report-card chart-card" aria-labelledby="chart-heading">
          <div className="report-card-header"><div><div className="section-title" id="chart-heading">{t.chartTitle}</div><div className="section-kicker">{t.chartCaption}</div></div></div>
          {chartReady ? <div className="visual-panel">
            <p className="visual-caption">{chartGroup[0].metric.reportingPeriod} · {chartGroup[0].metric.currency} · {t[chartGroup[0].metric.unitScale]}</p>
            <div className="metric-chart" role="img" aria-label={t.chartTitle}>
              {chartGroup.map(({ metric, numeric }, index) => <div className="chart-column" key={`${metric.label}-${index}`}>
                <div className="chart-value">{metric.reportedValue}</div>
                <div className="chart-track"><div className="chart-bar" style={{ height: `${numeric === 0 ? 0 : Math.abs(numeric) / maxMagnitude * 100}%` }} /></div>
                <div className="chart-label">{t.metricLabels[metric.category] ?? metric.label}</div>
                <div className="chart-meta">{metric.sourcePage !== null ? `${t.page} ${metric.sourcePage}` : t.unavailable}</div>
              </div>)}
            </div>
          </div> : <div className="empty-metrics" data-testid="empty-report-chart">{t.chartEmpty}</div>}
        </section>

        <section className="report-card" id="plain-language">
          <div className="report-card-header">
            <div><div className="section-title">{t.explanations}</div><div className="section-kicker">{t.explanationSub}</div></div>
            {explanations && <span className="step-index">{language === 'ar' ? 'شرح محفوظ' : 'SAVED EXPLANATION'}</span>}
          </div>
          {explanations ? <>
            {summary && <div className="explanation-summary" data-testid="text-explanation-summary">{summary}</div>}
            {explanations.items.length > 0 && <div className="explanation-list">
              {explanations.items.map((item, index) => {
                const metric = report.metrics[item.metricIndex];
                return <article className="explanation-item" key={`${item.metricIndex}-${index}`}>
                  <h3>{metric ? t.metricLabels[metric.category] ?? metric.label : (language === 'ar' ? 'شرح المؤشر' : 'Metric explanation')}</h3>
                  <p>{language === 'ar' ? item.meaningArabic : item.meaningEnglish}</p>
                  <p className="explanation-context">{language === 'ar' ? item.contextArabic : item.contextEnglish}</p>
                  <div className="metric-context">{t.page} {item.sourcePage ?? t.unavailable}</div>
                </article>;
              })}
            </div>}
          </> : <div className="explanation-empty">
            <span><Lightbulb size={15} style={{ verticalAlign: 'middle', marginInlineEnd: 7 }} />{t.noExplanation} {t.explanationHint}</span>
            <button className="action-button primary" type="button" onClick={generateExplanations} disabled={explain.isPending} data-testid="button-generate-explanations">
              {explain.isPending ? t.explaining : t.explain}
            </button>
          </div>}
          {explain.isError && <div className="explanation-error" role="alert">{t.explanationError}</div>}
        </section>
          <div className="explanation-route-action"><Link className="action-button primary" href={`/reports/${encodeURIComponent(reportId)}/explanations`} data-testid="link-open-explanations"><BookOpen size={14} />{language === 'ar' ? 'فتح صفحة القراءة المبسطة' : 'Open plain-language guide'}</Link></div>

        <section className="notes-card" data-testid="section-extraction-notes">
          <div className="notes-title">{t.notes}</div>
          {report.extractionNotes.length ? <ul className="notes-list">{report.extractionNotes.map((note, index) => <li key={`${index}-${note}`}>{localizedNote(note, language)}</li>)}</ul> : <div className="no-notes">{t.noNotes}</div>}
        </section>
        <div className="disclaimer">{t.disclaimer}</div>
        <section className="print-summary" aria-label={t.printTitle}>
          <h2>{t.printTitle}</h2>
          <p>{t.printSource}: {report.originalFileName}</p>
          <p>{t.period}: {report.reportingPeriod || t.unavailable} · {t.currency}: {report.currency || t.unavailable} · {t.scale}: {unitLabel}</p>
          <h3>{t.metrics}</h3>
          {report.metrics.map((metric, index) => <p key={`${metric.label}-${index}`}>{t.metricLabels[metric.category] ?? metric.label}: {metric.reportedValue || t.unavailable} · {t.page} {metric.sourcePage ?? t.unavailable}{metric.sourceExcerpt ? ` — ${metric.sourceExcerpt}` : ''}</p>)}
          {summary && <><h3>{t.explanations}</h3><p>{summary}</p></>}
          <p>{t.printDisclaimer}</p>
        </section>
      </div>
      <footer className="page-footer"><span className="footer-brand">SAHM · سهم</span><span>{t.source}: {report.originalFileName}</span></footer>
      </div>
    </main>
  );
}

function Meta({ label, value, empty, testId }: { label: string; value: string | null; empty: string; testId: string }) {
  return <div className="meta-item" data-testid={testId}><div className="meta-label">{label}</div><div className="meta-value">{unavailable(value, empty)}</div></div>;
}
