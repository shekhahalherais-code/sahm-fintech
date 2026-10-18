import { useState } from 'react';
import { Link, useParams } from './_shared/router-stubs';
import { useQueryClient } from './_shared/query-stubs';
import {
  getGetFinancialReportQueryKey,
  useGenerateReportExplanations,
  useGetFinancialReport,
} from './_shared/api-stubs';
import { AlertCircle, ArrowLeft, Download, FileText, Lightbulb, Printer } from 'lucide-react';
import './_group.css';

const words = {
  en: {
    back: 'Back to upload', overline: 'FINANCIAL DASHBOARD', report: 'Financial dashboard', filename: 'Source document',
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
  },
  ar: {
    back: 'العودة إلى رفع التقرير', overline: 'لوحة التقرير المالية', report: 'لوحة التقرير المالية', filename: 'المستند المصدر',
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

export function SahmDashboard() {
  const [language, setLanguage] = useState<'en' | 'ar'>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('sahm-language') === 'en' ? 'en' : 'ar',
  );
  const params = useParams<{ reportId: string }>();
  const reportId = params.reportId || '';
  const queryClient = useQueryClient();
  const query = useGetFinancialReport(reportId, {
    query: { enabled: Boolean(reportId), queryKey: getGetFinancialReportQueryKey(reportId) },
  });
  const explain = useGenerateReportExplanations();
  const t = words[language];
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  function changeLanguage() {
    const next = language === 'en' ? 'ar' : 'en';
    setLanguage(next);
    window.localStorage.setItem('sahm-language', next);
  }

  function generateExplanations() {
    explain.mutate({ reportId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetFinancialReportQueryKey(reportId) }),
    });
  }

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

  return (
    <main className="app-shell report-app" dir={dir} lang={language}>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="SAHM home" data-testid="link-home">
          <span className="brand-mark">س</span><span className="brand-name">SAHM</span><span className="brand-ar">سهم</span>
        </Link>
        <div className="header-right">
          <span className="header-note">{t.overline}</span>
          <button className="language-toggle" type="button" onClick={changeLanguage} data-testid="button-language">
            {language === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
      </header>

      <div className="report-wrap">
        <Link href="/" className="back-link" data-testid="link-back-home"><ArrowLeft size={15} />{t.back}</Link>
        <div className="report-head">
          <div><div className="report-overline">{t.overline}</div><h1 className="report-heading">{report.companyName || t.report}</h1>
            <div className="report-filename"><FileText size={14} style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />{report.originalFileName}</div>
          </div>
          <div className="report-actions">
            <div className="review-count" data-testid="text-metric-count">{String(report.metrics.length).padStart(2, '0')} &nbsp;{t.count}</div>
            <button className="action-button" type="button" onClick={() => window.print()} data-testid="button-download-summary"><Download size={14} />{t.print}<Printer size={13} /></button>
          </div>
        </div>

        <section className="report-card" aria-label={t.report}>
          <div className="report-card-header"><div><div className="section-title">{t.report}</div><div className="section-kicker">{t.filename}</div></div></div>
          <div className="meta-grid">
            <Meta label={t.company} value={report.companyName} empty={t.unavailable} testId="text-company" />
            <Meta label={t.period} value={report.reportingPeriod} empty={t.unavailable} testId="text-reporting-period" />
            <Meta label={t.currency} value={report.currency} empty={t.unavailable} testId="text-currency" />
            <div className="meta-item" data-testid="text-unit-scale"><div className="meta-label">{t.scale}</div><div className="meta-value">{unitLabel}</div></div>
          </div>
        </section>

        <section className="report-card">
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

        <section className="report-card" aria-labelledby="chart-heading">
          <div className="report-card-header"><div><div className="section-title" id="chart-heading">{t.chartTitle}</div><div className="section-kicker">{t.chartCaption}</div></div></div>
          {chartReady ? <div className="visual-panel">
            <p className="visual-caption">{chartGroup[0].metric.reportingPeriod} · {chartGroup[0].metric.currency} · {t[chartGroup[0].metric.unitScale]}</p>
            <div className="metric-chart" role="img" aria-label={t.chartTitle}>
              {chartGroup.map(({ metric, numeric }, index) => <div className="chart-column" key={`${metric.label}-${index}`}>
                <div className="chart-value">{metric.reportedValue}</div>
                <div className="chart-track"><div className="chart-bar" style={{ height: `${numeric === 0 ? 0 : Math.abs(numeric) / maxMagnitude * 100}%` }} /></div>
                <div className="chart-label">{metric.label}</div>
                <div className="chart-meta">{metric.sourcePage !== null ? `${t.page} ${metric.sourcePage}` : t.unavailable}</div>
              </div>)}
            </div>
          </div> : <div className="empty-metrics" data-testid="empty-report-chart">{t.chartEmpty}</div>}
        </section>

        <section className="report-card">
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
                  <h3>{metric?.label ?? (language === 'ar' ? 'شرح المؤشر' : 'Metric explanation')}</h3>
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

        <section className="notes-card" data-testid="section-extraction-notes">
          <div className="notes-title">{t.notes}</div>
          {report.extractionNotes.length ? <ul className="notes-list">{report.extractionNotes.map((note, index) => <li key={`${index}-${note}`}>{localizedNote(note, language)}</li>)}</ul> : <div className="no-notes">{t.noNotes}</div>}
        </section>
        <div className="disclaimer">{t.disclaimer}</div>
        <section className="print-summary" aria-label={t.printTitle}>
          <h2>{t.printTitle}</h2>
          <p>{t.printSource}: {report.originalFileName}</p>
          <p>{t.printDisclaimer}</p>
        </section>
      </div>
      <footer className="page-footer"><span className="footer-brand">SAHM · سهم</span><span>{report.originalFileName}</span></footer>
    </main>
  );
}

function Meta({ label, value, empty, testId }: { label: string; value: string | null; empty: string; testId: string }) {
  return <div className="meta-item" data-testid={testId}><div className="meta-label">{label}</div><div className="meta-value">{unavailable(value, empty)}</div></div>;
}
