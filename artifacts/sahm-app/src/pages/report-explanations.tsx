import { useState } from 'react';
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
    overline: 'PLAIN-LANGUAGE GUIDE', title: 'Understand the report figures',
    subtitle: 'A careful reading of saved figures and explanations, grounded in the original report.',
    report: 'Report', back: 'Back to dashboard', home: 'SAHM home', switch: 'العربية', print: 'Download summary',
    summary: 'The short version', figures: 'Choose a figure', source: 'Reference in the original report',
    page: 'Page', noExcerpt: 'No source excerpt is available for this figure.',
    value: 'Reported value', meaning: 'What this figure means', context: 'For a beginner investor',
    period: 'Reporting period', currency: 'Currency', unit: 'Unit scale',
    unavailable: 'Unavailable in report', unitScales: { units: 'Units', thousands: 'Thousands', millions: 'Millions', unknown: 'Unknown' },
    meaningUnavailable: 'No saved plain-language meaning is available for this figure.',
    contextUnavailable: 'No saved investor context is available for this figure.',
    summaryUnavailable: 'No saved report summary is available.',
    metricLabels: { revenue: 'Revenue', net_profit: 'Net profit', assets: 'Total assets', liabilities: 'Total liabilities', equity: 'Total equity', other: 'Other' },
    generate: 'Prepare plain-language guide', generating: 'Preparing your guide…',
    notReady: 'No explanation has been saved for this report yet.',
    loading: 'Opening your saved report…', error: 'We couldn’t open this report',
    errorSub: 'Try again, or return to the dashboard and open the saved report again.',
    retry: 'Try again', missing: 'This report could not be found.',
    generateError: 'We couldn’t prepare the guide. Please try again.',
    disclaimer: 'For learning only. SAHM reproduces information from the uploaded report and does not provide investment advice.',
    noItems: 'No figure-specific notes were saved for this report.',
    noMetrics: 'No figures were extracted from this report.',
    verified: 'Verified', unverified: 'Unverified', statusUnavailable: 'Unavailable',
  },
  ar: {
    overline: 'قراءة مبسطة', title: 'افهم أرقام التقرير',
    subtitle: 'قراءة دقيقة للأرقام والشروحات المحفوظة، بالاستناد إلى التقرير الأصلي.',
    report: 'التقرير', back: 'العودة إلى لوحة التقرير', home: 'الصفحة الرئيسية لسهم', switch: 'English', print: 'تنزيل الملخص',
    summary: 'ملخص سريع', figures: 'اختر رقماً', source: 'مرجع الرقم في التقرير الأصلي',
    page: 'الصفحة', noExcerpt: 'لا يتوفر مقتطف من المصدر لهذا الرقم.',
    value: 'القيمة المنشورة', meaning: 'ما هو هذا الرقم؟', context: 'ماذا يعني للمستثمر المبتدئ؟',
    period: 'الفترة المالية', currency: 'العملة', unit: 'مقياس الوحدة',
    unavailable: 'غير متوفر في التقرير', unitScales: { units: 'وحدات', thousands: 'آلاف', millions: 'ملايين', unknown: 'غير معروف' },
    meaningUnavailable: 'لا يتوفر شرح مبسط محفوظ لهذا الرقم.',
    contextUnavailable: 'لا يتوفر سياق محفوظ للمستثمر لهذا الرقم.',
    summaryUnavailable: 'لا يتوفر ملخص محفوظ للتقرير.',
    metricLabels: { revenue: 'الإيرادات', net_profit: 'صافي الربح', assets: 'إجمالي الأصول', liabilities: 'إجمالي الالتزامات', equity: 'إجمالي حقوق الملكية', other: 'أخرى' },
    generate: 'إعداد قراءة مبسطة', generating: 'جارٍ إعداد القراءة…',
    notReady: 'لم يُحفظ شرح لهذا التقرير حتى الآن.',
    loading: 'جارٍ فتح التقرير المحفوظ…', error: 'تعذّر فتح هذا التقرير',
    errorSub: 'حاول مرة أخرى، أو ارجع إلى لوحة التقرير وافتح التقرير المحفوظ.',
    retry: 'حاول مرة أخرى', missing: 'لم يتم العثور على هذا التقرير.',
    generateError: 'تعذّر إعداد القراءة المبسطة. حاول مرة أخرى.',
    disclaimer: 'للتثقيف فقط. يعرض سهم معلومات من التقرير المرفوع ولا يقدم نصيحة استثمارية.',
    noItems: 'لا توجد شروحات محفوظة خاصة بأرقام هذا التقرير.',
    noMetrics: 'لم يتم استخراج أرقام من هذا التقرير.',
    verified: 'تم التحقق', unverified: 'غير متحقق', statusUnavailable: 'غير متاح',
  },
};

function unavailable(value: string | null | undefined, empty: string) {
  return value ? value : empty;
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
  const selectedIndex = requestedMetricIndex !== null && requestedMetricIndex >= 0 && requestedMetricIndex < report.metrics.length
    ? requestedMetricIndex
    : 0;
  const metric = report.metrics[selectedIndex];
  const item = bundle?.items.find((explanation) => explanation.metricIndex === selectedIndex);
  const sourcePage = item?.sourcePage ?? metric?.sourcePage ?? null;
  const metricTitle = metric ? (t.metricLabels[metric.category] ?? metric.label) : '';
  const statusLabel = metric?.verificationStatus === 'verified' ? t.verified
    : metric?.verificationStatus === 'unverified' ? t.unverified : t.statusUnavailable;

  return <main className="report-dashboard explanation-dashboard" dir={dir} lang={language}>
    <aside className="dashboard-rail">
      <Link href="/" className="rail-brand" aria-label={t.home} data-testid="link-explanation-home"><Brand variant="rail" /></Link>
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
            <div className="metric-tabs" role="tablist" aria-label={t.figures} data-testid="tabs-report-metrics">
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
              >{t.metricLabels[entry.category] ?? entry.label}</button>)}
            </div>
            {metric && <div className="selected-metric-panel" id="panel-selected-metric" role="tabpanel" aria-labelledby={`metric-tab-${selectedIndex}`} data-testid={`panel-metric-${selectedIndex}`}>
              <div className="selected-metric-heading">
                <div>
                  <div className="selected-metric-title">{metricTitle}</div>
                  <div className="selected-metric-period">{t.period}: {unavailable(metric.reportingPeriod, t.unavailable)}</div>
                </div>
                <span className={`status-pill status-${metric.verificationStatus === 'unavailable' ? 'unavailable' : metric.verificationStatus}`} data-testid={`status-selected-metric-${selectedIndex}`}>{statusLabel}</span>
              </div>
              <div className="selected-metric-value" data-testid={`value-selected-metric-${selectedIndex}`}>
                <span>{t.value}</span>
                <strong>{unavailable(metric.reportedValue, t.unavailable)}</strong>
                <div className="selected-metric-meta">
                  <span>{t.currency}: {unavailable(metric.currency, t.unavailable)}</span>
                  <span>{t.unit}: {t.unitScales[metric.unitScale] ?? t.unitScales.unknown}</span>
                  <span>{t.period}: {unavailable(metric.reportingPeriod, t.unavailable)}</span>
                  <span>{t.page} {sourcePage ?? t.unavailable}</span>
                </div>
              </div>
              <div className="explanation-copy-grid selected-explanation-copy">
                <div data-testid={`meaning-selected-metric-${selectedIndex}`}><h3>{t.meaning}</h3><p>{unavailable(item ? (language === 'ar' ? item.meaningArabic : item.meaningEnglish) : null, t.meaningUnavailable)}</p></div>
                <div data-testid={`context-selected-metric-${selectedIndex}`}><h3>{t.context}</h3><p>{unavailable(item ? (language === 'ar' ? item.contextArabic : item.contextEnglish) : null, t.contextUnavailable)}</p></div>
              </div>
              <div className="explanation-source selected-source" data-testid={`source-selected-metric-${selectedIndex}`}>
                <div className="source-top"><span>{t.source}</span><span>{t.page} {sourcePage ?? t.unavailable}</span></div>
                <p className="source-filename" data-testid="text-source-filename">{report.originalFileName}</p>
                <p className={`selected-source-excerpt${metric.sourceExcerpt ? '' : ' unavailable'}`} data-testid={`excerpt-selected-metric-${selectedIndex}`}>{unavailable(metric.sourceExcerpt, t.noExcerpt)}</p>
              </div>
            </div>}
          </> : <div className="empty-metrics" data-testid="empty-explanation-metrics">{t.noMetrics}</div>}
        </section>

        {!bundle && <section className="report-card explanation-prompt">
          <div className="explanation-hero-icon"><Lightbulb size={20} /></div><h2>{t.notReady}</h2>
          <button className="action-button primary" type="button" onClick={generateGuide} disabled={generate.isPending} data-testid="button-generate-explanations">
            {generate.isPending ? t.generating : t.generate}
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
