import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { getGetFinancialReportQueryKey, useGetFinancialReport } from '@workspace/api-client-react';
import { ArrowLeft, AlertCircle, FileText } from 'lucide-react';

const words = {
  en: {
    back: 'Back to upload', overline: 'EXTRACTION REVIEW', report: 'Report review', filename: 'Source document',
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
    metricLabels: { revenue: 'Revenue', net_profit: 'Net profit', assets: 'Total assets', liabilities: 'Total liabilities', equity: 'Total equity', other: 'Other' },
    categories: { revenue: 'Revenue', net_profit: 'Net profit', assets: 'Assets', liabilities: 'Liabilities', equity: 'Equity', other: 'Other' },
  },
  ar: {
    back: 'العودة إلى رفع التقرير', overline: 'مراجعة الاستخراج', report: 'مراجعة التقرير', filename: 'المستند المصدر',
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

export default function ReportReviewPage() {
  const [language, setLanguage] = useState<'en' | 'ar'>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('sahm-language') === 'ar' ? 'ar' : 'en',
  );
  const params = useParams<{ reportId: string }>();
  const reportId = params.reportId || '';
  const query = useGetFinancialReport(reportId, {
    query: { enabled: Boolean(reportId), queryKey: getGetFinancialReportQueryKey(reportId) },
  });
  const t = words[language];
  function changeLanguage() {
    const next = language === 'en' ? 'ar' : 'en';
    setLanguage(next);
    window.localStorage.setItem('sahm-language', next);
  }

  if (query.isLoading) return <main className="loading-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <section className="loading-card" role="status"><div className="loading-bars"><span /><span /><span /></div><p>{t.loading}</p></section>
  </main>;

  if (query.isError || !query.data) return <main className="error-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <section className="error-card">
      <div className="error-icon"><AlertCircle size={20} /></div><h2>{t.failed}</h2>
      <p>{query.isError ? (query.error instanceof Error && query.error.message.includes('HTTP 503') ? t.databaseUnavailable : t.failedSub) : t.notFound}</p>
      {query.isError && <button className="retry-button" type="button" onClick={() => query.refetch()} data-testid="button-retry-report">{t.retry}</button>}
      <div><Link href="/" className="back-link" style={{ marginTop: 20, marginBottom: 0 }} data-testid="link-back-home"><ArrowLeft size={14} />{t.back}</Link></div>
    </section>
  </main>;

  const report = query.data;
  const unitLabel = t[report.unitScale] ?? t.unknown;
  return (
    <main className="app-shell" dir={language === 'ar' ? 'rtl' : 'ltr'}>
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
          <div className="review-count" data-testid="text-metric-count">{String(report.metrics.length).padStart(2, '0')} &nbsp;{t.count}</div>
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
                  <div><div className="metric-label">{t.metricLabels[metric.category]}</div><div className="metric-category">{t.category}: {t.categories[metric.category]}</div></div>
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

        <section className="notes-card" data-testid="section-extraction-notes">
          <div className="notes-title">{t.notes}</div>
          {report.extractionNotes.length ? <ul className="notes-list">{report.extractionNotes.map((note, index) => <li key={`${index}-${note}`}>{localizedNote(note, language)}</li>)}</ul> : <div className="no-notes">{t.noNotes}</div>}
        </section>
        <div className="disclaimer">{t.disclaimer}</div>
      </div>
      <footer className="page-footer"><span className="footer-brand">SAHM · سهم</span><span>{report.originalFileName}</span></footer>
    </main>
  );
}

function Meta({ label, value, empty, testId }: { label: string; value: string | null; empty: string; testId: string }) {
  return <div className="meta-item" data-testid={testId}><div className="meta-label">{label}</div><div className="meta-value">{unavailable(value, empty)}</div></div>;
}
