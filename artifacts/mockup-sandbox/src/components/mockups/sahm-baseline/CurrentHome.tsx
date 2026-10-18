import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { useLocation } from './_shared/router-stubs';
import { useExtractReport } from './_shared/api-stubs';
import { ArrowRight, FileText, LockKeyhole, X, UploadCloud } from 'lucide-react';
import './_group.css';

const copy = {
  en: {
    header: 'A clearer first step into investing',
    eyebrow: 'FINANCIAL REPORTS, MADE READABLE',
    headline: <>Understand the numbers.<br /><em>Start with the source.</em></>,
    sub: 'SAHM helps students and first-time investors in Kuwait review the figures already published in company reports — without the jargon.',
    proof: ['Built for beginners', 'Only extracted data is saved'],
    upload: 'Start with a report', hint: 'Choose a company financial report in PDF format.', step: 'STEP 01 / 02',
    drop: <>Drop your PDF here, or <span className="drop-browse">browse files</span></>, dropSub: 'Text-based PDF · up to 15 MB',
    submit: 'Extract report data', uploading: 'Extracting report data', wait: 'Reading the document and locating reported figures…',
    foot: 'PDF files only · Maximum file size 15 MB', secure: 'Source pages and excerpts stay alongside each figure.',
    reportLabel: 'Upload → Review → Learn', flowSub: 'A focused first phase: extract, then verify the source.',
    f1: 'Upload report', f2: 'Review figures', f3: 'Check source', footer: 'FINANCIAL LITERACY, STARTING WITH THE SOURCE.',
    footerRight: 'Made for learners in Kuwait', select: 'Please choose a PDF file.', type: 'This file is not a PDF. Choose a .pdf file.',
    size: 'The PDF exceeds the 15 MB limit. Choose a smaller file.', fail: 'We couldn’t extract this report. Please check that it is a text-based PDF and try again.',
    database: 'The report was read, but MongoDB Atlas must be connected before it can be saved. Add the MONGODB_URI secret and try again.',
    databaseUnavailable: 'The report was read, but Atlas could not be reached. Check that the cluster is running and that its Network Access list allows this Replit runtime.',
  },
  ar: {
    header: 'خطوة أوضح نحو الاستثمار',
    eyebrow: 'التقارير المالية، بوضوح أكبر',
    headline: <>افهم الأرقام.<br /><em>ابدأ من المصدر.</em></>,
    sub: 'يساعد سهم الطلاب والمستثمرين المبتدئين في الكويت على مراجعة الأرقام المنشورة في تقارير الشركات، بعيداً عن المصطلحات المعقدة.',
    proof: ['مصمم للمبتدئين', 'يُحفظ الاستخراج دون ملف PDF'],
    upload: 'ابدأ بتقرير مالي', hint: 'اختر تقريراً مالياً لشركة بصيغة PDF.', step: 'الخطوة ١ / ٢',
    drop: <>أفلت ملف PDF هنا، أو <span className="drop-browse">تصفّح الملفات</span></>, dropSub: 'ملف PDF نصي · حتى ١٥ ميغابايت',
    submit: 'استخراج بيانات التقرير', uploading: 'جارٍ استخراج البيانات', wait: 'جارٍ قراءة المستند والعثور على الأرقام المنشورة…',
    foot: 'ملفات PDF فقط · الحد الأقصى ١٥ ميغابايت', secure: 'نحتفظ بصفحات المصدر ومقتطفاته مع كل رقم.',
    reportLabel: 'ارفع ← راجع ← تحقق', flowSub: 'المرحلة الأولى: استخراج الأرقام ثم مراجعة مصادرها.',
    f1: 'ارفع التقرير', f2: 'راجع الأرقام', f3: 'تحقق من المصدر', footer: 'الثقافة المالية تبدأ من المصدر.',
    footerRight: 'للمتعلمين في الكويت', select: 'يرجى اختيار ملف PDF.', type: 'هذا الملف ليس بصيغة PDF. اختر ملفاً بامتداد .pdf.',
    size: 'حجم الملف يتجاوز ١٥ ميغابايت. اختر ملفاً أصغر.', fail: 'تعذّر استخراج التقرير. تأكد من أنه PDF نصي ثم حاول مرة أخرى.',
    database: 'تمت قراءة التقرير، لكن يجب ربط MongoDB Atlas لحفظه. أضف السر MONGODB_URI ثم حاول مرة أخرى.',
    databaseUnavailable: 'تمت قراءة التقرير، لكن تعذّر الوصول إلى Atlas. تحقق من تشغيل العنقود والسماح لبيئة Replit الحالية ضمن قائمة Network Access.',
  },
};

function formatSize(size: number) {
  return size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function CurrentHome() {
  const [language, setLanguage] = useState<'en' | 'ar'>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('sahm-language') === 'ar' ? 'ar' : 'en',
  );
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const extract = useExtractReport();
  const t = copy[language];

  function chooseFile(next: File | undefined) {
    if (!next) return;
    setError('');
    if (!/\.pdf$/i.test(next.name) && next.type !== 'application/pdf') { setFile(null); setError(t.type); return; }
    if (next.size > 15 * 1024 * 1024) { setFile(null); setError(t.size); return; }
    setFile(next);
  }
  function changeLanguage() {
    const next = language === 'en' ? 'ar' : 'en';
    setLanguage(next);
    window.localStorage.setItem('sahm-language', next);
  }
  function onInput(event: ChangeEvent<HTMLInputElement>) { chooseFile(event.target.files?.[0]); event.target.value = ''; }
  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]);
  }
  function submit() {
    if (!file) { setError(t.select); return; }
    setError('');
    extract.mutate({ data: { file } }, {
      onSuccess: report => navigate(`/reports/${encodeURIComponent(report.id)}`),
      onError: error => {
        if (error.status !== 503) { setError(t.fail); return; }
        setError(error.message.includes('MONGODB_URI') ? t.database : t.databaseUnavailable);
      },
    });
  }

  return (
    <main className="app-shell" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="SAHM home" data-testid="link-home">
          <span className="brand-mark">س</span><span className="brand-name">SAHM</span><span className="brand-ar">سهم</span>
        </a>
        <div className="header-right">
          <span className="header-note">{t.header}</span>
          <button className="language-toggle" type="button" onClick={changeLanguage} data-testid="button-language">
            {language === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">{t.eyebrow}</div>
          <h1>{t.headline}</h1>
          <p className="hero-sub">{t.sub}</p>
          <div className="promise-row">
            {t.proof.map(item => <span className="promise" key={item}><span className="promise-dot" />{item}</span>)}
          </div>
        </div>

        <section className="upload-card" aria-label={t.upload}>
          <div className="upload-title-row">
            <div><div className="upload-title">{t.upload}</div><div className="upload-hint">{t.hint}</div></div>
            <div className="step-index">{t.step}</div>
          </div>
          <label className={`dropzone${dragging ? ' dragging' : ''}`} htmlFor="report-file" onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} data-testid="dropzone-report">
            <input ref={inputRef} id="report-file" type="file" accept="application/pdf,.pdf" onChange={onInput} data-testid="input-report-file" />
            <span className="upload-icon"><UploadCloud size={22} strokeWidth={1.8} /></span>
            <span className="drop-main">{t.drop}</span>
            <span className="drop-meta">{t.dropSub}</span>
          </label>
          {file && <div className="selected-file" data-testid="selected-file">
            <FileText className="file-glyph" size={20} />
            <div style={{ minWidth: 0 }}><div className="selected-name">{file.name}</div><div className="selected-size">{formatSize(file.size)}</div></div>
            <button className="remove-file" type="button" aria-label="Remove selected file" onClick={() => { setFile(null); setError(''); }} data-testid="button-remove-file"><X size={17} /></button>
          </div>}
          {error && <div className="error-panel" role="alert" data-testid="status-upload-error">{error}</div>}
          {extract.isPending && <div className="progress-box" role="status" data-testid="status-extraction-progress">
            <span className="progress-orbit" /><span><span className="progress-text">{t.uploading}</span><span className="progress-sub">{t.wait}</span></span>
          </div>}
          <button className="upload-submit" type="button" onClick={submit} disabled={extract.isPending || !file} data-testid="button-extract">
            {extract.isPending ? t.uploading : <>{t.submit}<ArrowRight size={16} /></>}
          </button>
          <div className="secure-note"><LockKeyhole size={12} style={{ verticalAlign: 'middle', marginInlineEnd: 5 }} />{t.secure}</div>
        </section>
      </section>

      <section className="content-band">
        <div className="band-inner">
          <div><div className="band-title">{t.reportLabel}</div><div className="band-desc">{t.flowSub}</div></div>
          <div className="flow" aria-label={t.reportLabel}>
            {[t.f1, t.f2, t.f3].map((label, index) => <div className="flow-step" key={label}><span className="flow-number">0{index + 1}</span><span>{label}</span></div>).flatMap((step, index, all) => index < all.length - 1 ? [step, <span className="flow-line" key={`line-${index}`} />] : [step])}
          </div>
        </div>
      </section>
      <footer className="page-footer"><span className="footer-brand">{t.footer}</span><span>{t.footerRight}</span></footer>
    </main>
  );
}
