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
    subtitle: 'Each note is based on a figure extracted from this filing. Open the cited page to check the original context.',
    report: 'Report', back: 'Back to dashboard', home: 'SAHM home', switch: 'العربية', print: 'Download summary',
    summary: 'The short version', figures: 'What the figures mean', source: 'Source evidence',
    page: 'Page', noExcerpt: 'No source excerpt was available for this figure.',
    value: 'Reported value', meaning: 'In plain language', context: 'In this report',
    metricLabels: { revenue: 'Revenue', net_profit: 'Net profit', assets: 'Total assets', liabilities: 'Total liabilities', equity: 'Total equity', other: 'Other' },
    generate: 'Prepare plain-language guide', generating: 'Preparing your guide…',
    notReady: 'No explanation has been saved for this report yet.',
    loading: 'Opening your saved report…', error: 'We couldn’t open this report',
    errorSub: 'Try again, or return to the dashboard and open the saved report again.',
    retry: 'Try again', missing: 'This report could not be found.',
    generateError: 'We couldn’t prepare the guide. Please try again.',
    disclaimer: 'For learning only. SAHM reproduces information from the uploaded report and does not provide investment advice.',
    noItems: 'No figure-specific notes were returned for this report.',
  },
  ar: {
    overline: 'قراءة مبسطة', title: 'افهم أرقام التقرير',
    subtitle: 'يستند كل شرح إلى رقم مستخرج من هذا الإفصاح. افتح الصفحة المذكورة للتحقق من سياق المصدر الأصلي.',
    report: 'التقرير', back: 'العودة إلى لوحة التقرير', home: 'الصفحة الرئيسية لسهم', switch: 'English', print: 'تنزيل الملخص',
    summary: 'ملخص سريع', figures: 'ماذا تعني الأرقام', source: 'دليل المصدر',
    page: 'الصفحة', noExcerpt: 'لا يتوفر مقتطف من المصدر لهذا الرقم.',
    value: 'القيمة المنشورة', meaning: 'بشرح مبسط', context: 'في هذا التقرير',
    metricLabels: { revenue: 'الإيرادات', net_profit: 'صافي الربح', assets: 'إجمالي الأصول', liabilities: 'إجمالي الالتزامات', equity: 'إجمالي حقوق الملكية', other: 'أخرى' },
    generate: 'إعداد قراءة مبسطة', generating: 'جارٍ إعداد القراءة…',
    notReady: 'لم يُحفظ شرح لهذا التقرير حتى الآن.',
    loading: 'جارٍ فتح التقرير المحفوظ…', error: 'تعذّر فتح هذا التقرير',
    errorSub: 'حاول مرة أخرى، أو ارجع إلى لوحة التقرير وافتح التقرير المحفوظ.',
    retry: 'حاول مرة أخرى', missing: 'لم يتم العثور على هذا التقرير.',
    generateError: 'تعذّر إعداد القراءة المبسطة. حاول مرة أخرى.',
    disclaimer: 'للتثقيف فقط. يعرض سهم معلومات من التقرير المرفوع ولا يقدم نصيحة استثمارية.',
    noItems: 'لم يتم إرجاع شروحات خاصة بالأرقام في هذا التقرير.',
  },
};

export default function ReportExplanationsPage() {
  const [language, setLanguage] = useState<'en' | 'ar'>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('sahm-language') === 'en' ? 'en' : 'ar',
  );
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

  return <main className="report-dashboard explanation-dashboard" dir={dir} lang={language}>
    <aside className="dashboard-rail">
      <Link href="/" className="rail-brand" aria-label={t.home} data-testid="link-explanation-home">
        <Brand variant="rail" />
      </Link>
      <div className="rail-caption">{t.report}</div>
      <nav className="rail-nav" aria-label={t.report}>
        <Link href={`/reports/${encodeURIComponent(reportId)}`} className="rail-link" aria-label={t.back} data-testid="link-explanation-dashboard"><ArrowLeft size={17} /><span>{t.back}</span></Link>
        <span className="rail-link active" aria-current="page"><BookOpen size={17} /><span>{t.overline}</span></span>
      </nav>
      <div className="rail-bottom">
        <div className="rail-note"><span className="rail-note-mark"><FileText size={15} /></span><span><b>{report.companyName || t.report}</b><small>{report.originalFileName}</small></span></div>
        <Link href={`/reports/${encodeURIComponent(reportId)}`} className="rail-back" data-testid="link-back-dashboard"><ArrowLeft size={15} />{t.back}</Link>
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

        {bundle ? <>
          <section className="report-card explanation-summary-card">
            <div className="report-card-header"><div><div className="section-title">{t.summary}</div><div className="section-kicker">{report.originalFileName}</div></div><span className="saved-label">{language === 'ar' ? 'من التقرير' : 'REPORT-SPECIFIC'}</span></div>
            <div className="explanation-summary explanation-summary-page" data-testid="text-explanation-summary">{language === 'ar' ? bundle.summaryArabic : bundle.summaryEnglish}</div>
          </section>
          <section className="report-card">
            <div className="report-card-header"><div><div className="section-title">{t.figures}</div><div className="section-kicker">{report.metrics.length} · {language === 'ar' ? 'أرقام مستخرجة' : 'extracted figures'}</div></div></div>
            {bundle.items.length ? <div className="explanation-page-list">
              {bundle.items.map((item, index) => {
                const metric = report.metrics[item.metricIndex];
                const metricTitle = metric
                  ? t.metricLabels[metric.category] ?? metric.label
                  : t.metricLabels[item.category] ?? item.category;
                return <article className="explanation-page-item" key={`${item.metricIndex}-${index}`} data-testid={`card-explanation-${index}`}>
                  <div className="explanation-item-heading"><div><span className="explanation-index">{String(index + 1).padStart(2, '0')}</span><h2>{metricTitle}</h2></div><span className={`status-pill status-${metric?.verificationStatus || 'unavailable'}`}>{metric?.verificationStatus === 'verified' ? (language === 'ar' ? 'تم التحقق' : 'Verified') : metric?.verificationStatus === 'unverified' ? (language === 'ar' ? 'غير متحقق' : 'Unverified') : (language === 'ar' ? 'غير متاح' : 'Unavailable')}</span></div>
                  {metric && <div className="explanation-reported-value"><span>{t.value}</span><strong>{metric.reportedValue || (language === 'ar' ? 'غير متوفر' : 'Unavailable')}</strong><small>{[metric.currency, metric.unitScale !== 'unknown' ? (language === 'ar' ? ({ units: 'وحدات', thousands: 'آلاف', millions: 'ملايين' }[metric.unitScale] || '') : metric.unitScale) : ''].filter(Boolean).join(' · ') || (language === 'ar' ? 'الوحدات غير محددة' : 'Units unavailable')}</small></div>}
                  <div className="explanation-copy-grid">
                    <div><h3>{t.meaning}</h3><p>{language === 'ar' ? item.meaningArabic : item.meaningEnglish}</p></div>
                    <div><h3>{t.context}</h3><p>{language === 'ar' ? item.contextArabic : item.contextEnglish}</p></div>
                  </div>
                  <div className="explanation-source" data-testid={`source-explanation-${index}`}>
                    <div className="source-top"><span>{t.source}</span><span>{t.page} {item.sourcePage ?? metric?.sourcePage ?? (language === 'ar' ? 'غير متوفر' : 'Unavailable')}</span></div>
                    <p>{metric?.sourceExcerpt || t.noExcerpt}</p>
                  </div>
                </article>;
              })}
            </div> : <div className="empty-metrics" data-testid="empty-explanation-items">{t.noItems}</div>}
          </section>
        </> : <section className="report-card explanation-prompt">
          <div className="explanation-hero-icon"><Lightbulb size={20} /></div><h2>{t.notReady}</h2>
          <button className="action-button primary" type="button" onClick={generateGuide} disabled={generate.isPending} data-testid="button-generate-explanations">
            {generate.isPending ? t.generating : t.generate}
          </button>
          {generate.isError && <p className="explanation-error" role="alert" data-testid="status-explanation-error">{t.generateError}</p>}
        </section>}
        <div className="disclaimer" data-testid="text-explanation-disclaimer">{t.disclaimer}</div>
      </div>
      <footer className="page-footer"><span className="footer-brand">SAHM · سهم</span><span>{report.originalFileName}</span></footer>
    </div>
  </main>;
}
