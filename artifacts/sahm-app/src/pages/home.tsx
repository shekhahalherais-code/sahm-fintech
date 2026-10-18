import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { useLocation } from 'wouter';
import { useExtractReport } from '@workspace/api-client-react';
import { ArrowRight, FileText, LockKeyhole, X, UploadCloud } from 'lucide-react';
import { Brand } from '@/components/brand';

const copy = {
  en: {
    header: 'A clearer first step into investing',
    eyebrow: 'FINANCIAL REPORTS, MADE READABLE',
    headline: <>Understand the numbers.<br /><em>Before the decision.</em></>,
    sub: 'SAHM helps students and first-time investors in Kuwait understand figures published in company reports, in clear language and with the source close at hand.',
    proof: ['Built for beginners', 'Only extracted data is saved'],
    upload: 'Understand your financial report', hint: 'Upload a company report and begin with its published figures.', step: 'STEP 01 / 02',
    drop: <>Drop your PDF here, or <span className="drop-browse">browse files</span></>, dropSub: 'Text-based PDF · up to 15 MB',
    submit: 'Extract report data', uploading: 'Extracting report data', wait: 'Reading the document and locating reported figures…',
    foot: 'PDF files only · Maximum file size 15 MB', secure: 'Source pages and excerpts stay alongside each figure.',
    reportLabel: 'Upload → Review → Learn', flowSub: 'A focused first phase: extract, then verify the source.',
    f1: 'Upload report', f2: 'Review figures', f3: 'Check source', footer: 'FINANCIAL LITERACY, STARTING WITH THE SOURCE.',
    footerRight: 'Made for learners in Kuwait', select: 'Please choose a PDF file.', type: 'This file is not a PDF. Choose a .pdf file.', start: 'Get started',
    size: 'The PDF exceeds the 15 MB limit. Choose a smaller file.', fail: 'We couldn’t extract this report. Please check that it is a text-based PDF and try again.',
    database: 'The report was read, but MongoDB Atlas must be connected before it can be saved. Add the MONGODB_URI secret and try again.',
    databaseUnavailable: 'The report was read, but Atlas could not be reached. Check that the cluster is running and that its Network Access list allows this Replit runtime.',
  },
  ar: {
    header: 'خطوة أوضح نحو الاستثمار',
    eyebrow: 'التقارير المالية، بوضوح أكبر',
     headline: <>افهم الأرقام قبل القرار.</>,
    sub: 'سهم منصة تساعد الطلاب والمستثمرين المبتدئين في الكويت على فهم التقارير المالية للشركات المدرجة، بلغة بسيطة وواضحة ومن واقع المصدر.',
    proof: ['مصمم للمبتدئين', 'يُحفظ الاستخراج دون ملف PDF'],
    upload: 'افهم تقريرك المالي بسهولة', hint: 'ارفع تقرير الشركة وابدأ بالأرقام المنشورة فيه.', step: 'الخطوة ١ / ٢',
    drop: <>أفلت ملف PDF هنا، أو <span className="drop-browse">تصفّح الملفات</span></>, dropSub: 'ملف PDF نصي · حتى ١٥ ميغابايت',
    submit: 'استخراج بيانات التقرير', uploading: 'جارٍ استخراج البيانات', wait: 'جارٍ قراءة المستند والعثور على الأرقام المنشورة…',
    foot: 'ملفات PDF فقط · الحد الأقصى ١٥ ميغابايت', secure: 'نحتفظ بصفحات المصدر ومقتطفاته مع كل رقم.',
    reportLabel: 'ارفع ← راجع ← تحقق', flowSub: 'المرحلة الأولى: استخراج الأرقام ثم مراجعة مصادرها.',
    f1: 'ارفع التقرير', f2: 'راجع الأرقام', f3: 'تحقق من المصدر', footer: 'الثقافة المالية تبدأ من المصدر.',
    footerRight: 'للمتعلمين في الكويت', select: 'يرجى اختيار ملف PDF.', type: 'هذا الملف ليس بصيغة PDF. اختر ملفاً بامتداد .pdf.', start: 'ابدأ الآن',
    size: 'حجم الملف يتجاوز ١٥ ميغابايت. اختر ملفاً أصغر.', fail: 'تعذّر استخراج التقرير. تأكد من أنه PDF نصي ثم حاول مرة أخرى.',
    database: 'تمت قراءة التقرير، لكن يجب ربط MongoDB Atlas لحفظه. أضف السر MONGODB_URI ثم حاول مرة أخرى.',
    databaseUnavailable: 'تمت قراءة التقرير، لكن تعذّر الوصول إلى Atlas. تحقق من تشغيل العنقود والسماح لبيئة Replit الحالية ضمن قائمة Network Access.',
  },
};

function formatSize(size: number) {
  return size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HomePage() {
  const [language, setLanguage] = useState<'en' | 'ar'>(() => {
    if (typeof window === 'undefined') return 'ar';
    const savedLanguage = window.localStorage.getItem('sahm-language');
    return savedLanguage === 'en' || savedLanguage === 'ar' ? savedLanguage : 'ar';
  });
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
    <main className="app-shell" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="SAHM home" data-testid="link-home">
          <Brand />
        </a>
        <nav className="home-nav" aria-label={language === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
          <a href="#home">{language === 'ar' ? 'الرئيسية' : 'Home'}</a>
          <a href="#upload-section">{language === 'ar' ? 'رفع تقرير' : 'Upload report'}</a>
        </nav>
        <div className="header-right">
          <span className="header-note">{t.header}</span>
          <button className="language-toggle" type="button" onClick={changeLanguage} data-testid="button-language">
            {language === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow">{t.eyebrow}</div>
          <h1>{t.headline}</h1>
          <p className="hero-sub">{t.sub}</p>
          <div className="promise-row">
            {t.proof.map(item => <span className="promise" key={item}><span className="promise-dot" />{item}</span>)}
          </div>
          <a className="hero-start" href="#upload-section" data-testid="link-start-upload">{t.start}<ArrowRight size={17} /></a>
        </div>

        <div className="hero-visual" aria-label={language === 'ar' ? 'أفق مدينة الكويت' : 'Kuwait City skyline'}>
          <img src="/images/sahm-kuwait-skyline.jpg" alt={language === 'ar' ? 'أفق مدينة الكويت وأبراج الكويت عند الغروب' : 'Kuwait City skyline and Kuwait Towers at sunset'} />
          <div className="skyline-caption"><span className="skyline-caption-mark"><FileText size={15} /></span><span><strong>{language === 'ar' ? 'الكويت · فهم يبدأ من المصدر' : 'Kuwait · understanding starts at the source'}</strong><small>{language === 'ar' ? 'الأرقام كما وردت في التقرير' : 'Figures as they appear in the report'}</small></span></div>
        </div>
      </section>

      <section className="upload-section" id="upload-section">
        <div className="upload-intro">
          <span className="upload-intro-label">{language === 'ar' ? 'الخطوة الأولى' : 'YOUR FIRST STEP'}</span>
          <h2>{t.upload}</h2>
          <p>{t.hint}</p>
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

      <footer className="page-footer"><span className="footer-brand">{t.footer}</span><span>{t.footerRight}</span></footer>
    </main>
  );
}
