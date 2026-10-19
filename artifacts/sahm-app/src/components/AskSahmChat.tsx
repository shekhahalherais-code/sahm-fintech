import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAskSahmChat } from '@workspace/api-client-react';
import type {
  FinancialReportChatHistoryItem,
  FinancialReportChatResponse,
  FinancialReportChatSource,
} from '@workspace/api-client-react';
import { ArrowUp, BookOpen, ChevronDown, FileSearch, ShieldCheck, X } from 'lucide-react';
import type { SahmLanguage } from '@/lib/language';
import { localizeReportingPeriod } from '@/lib/report-period';
import './AskSahmChat.css';

type ChatMessage =
  | { id: number; role: 'user'; content: string }
  | { id: number; role: 'assistant'; response: FinancialReportChatResponse };

type Props = {
  reportId?: string;
  language: SahmLanguage;
};

const copy = {
  en: {
    open: 'Open Ask SAHM AI',
    close: 'Close Ask SAHM AI',
    title: 'Ask SAHM',
    reportSubtitle: 'A guide to this report',
    generalSubtitle: 'Financial learning, clearly explained',
    sourceFirst: 'Answers grounded in this report',
    generalFirst: 'General financial education · no report selected',
    hello: 'What would you like to understand?',
    helloDetail: 'Ask about a figure, a reporting period, or where something appears in the report.',
    homeWelcome: "Hi! I'm SAHM 👋 What would you like to learn about financial reports or investing in Kuwait?",
    suggestionIntro: 'Try one of these questions',
    suggestions: [
      'What are stocks?',
      'How do I read a financial report?',
      'What is the difference between revenue and profit?',
    ],
    placeholder: 'Ask a question about this report…',
    generalPlaceholder: 'Ask about financial terms or Boursa Kuwait…',
    send: 'Send question',
    empty: 'Write a question before sending.',
    tooLong: 'Keep your question under 1,000 characters.',
    error: 'We couldn’t get an answer just now. Please try again.',
    loading: 'Checking the report',
    loadingDetail: 'Looking for relevant source evidence…',
    generalLoading: 'Preparing an educational answer',
    generalLoadingDetail: 'Keeping it general—no report is selected.',
    sources: 'Report sources',
    page: 'Page',
    excerpt: 'Source excerpt',
    verified: 'Verified in report',
    not_verified: 'Not verified',
    general: 'General explanation',
    advice: 'Investment advice not provided',
    inputLabel: 'Your question',
    newQuestion: 'Ask another question',
    reportAnswerTag: 'SOURCE-LED ANSWER',
    generalAnswerTag: 'GENERAL EDUCATION',
    reportFoot: 'Answers use this report only',
    generalFoot: 'General education · no live market data',
  },
  ar: {
    open: 'فتح اسأل سهم AI',
    close: 'إغلاق اسأل سهم AI',
    title: 'اسأل سهم',
    reportSubtitle: 'دليل لفهم هذا التقرير',
    generalSubtitle: 'تعلم مالي مبسّط',
    sourceFirst: 'إجابات تستند إلى هذا التقرير',
    generalFirst: 'تثقيف مالي عام · لا يوجد تقرير محدد',
    hello: 'ما الذي تود فهمه؟',
    helloDetail: 'اسأل عن رقم أو فترة مالية أو موضع معلومة في التقرير.',
    homeWelcome: 'هلا! أنا سهم 👋 شنو ودك تعرف عن التقارير المالية أو الاستثمار في بورصة الكويت؟',
    suggestionIntro: 'جرّب أحد هذه الأسئلة',
    suggestions: [
      'ما هي الأسهم؟',
      'كيف أقرأ تقريراً مالياً؟',
      'ما الفرق بين الإيرادات والربح؟',
    ],
    placeholder: 'اكتب سؤالك عن هذا التقرير…',
    generalPlaceholder: 'اسأل عن المصطلحات المالية أو بورصة الكويت…',
    send: 'إرسال السؤال',
    empty: 'اكتب سؤالاً قبل الإرسال.',
    tooLong: 'يجب ألا يتجاوز السؤال ١٬٠٠٠ حرف.',
    error: 'تعذّر الحصول على إجابة الآن. حاول مرة أخرى.',
    loading: 'جارٍ التحقق من التقرير',
    loadingDetail: 'جارٍ البحث عن دليل ذي صلة في المصدر…',
    generalLoading: 'جارٍ إعداد شرح تعليمي',
    generalLoadingDetail: 'إجابة عامة، لعدم تحديد تقرير.',
    sources: 'مصادر التقرير',
    page: 'الصفحة',
    excerpt: 'مقتطف من المصدر',
    verified: 'تم التحقق في التقرير',
    not_verified: 'لم يتم التحقق',
    general: 'شرح عام',
    advice: 'لا يقدم نصائح استثمارية',
    inputLabel: 'سؤالك',
    newQuestion: 'اسأل سؤالاً آخر',
    reportAnswerTag: 'إجابة تستند إلى المصدر',
    generalAnswerTag: 'تثقيف مالي عام',
    reportFoot: 'الإجابات مبنية على هذا التقرير فقط',
    generalFoot: 'تثقيف عام · لا توجد بيانات سوق مباشرة',
  },
} as const;

function SourceEvidence({
  source,
  index,
  language,
}: {
  source: FinancialReportChatSource;
  index: number;
  language: SahmLanguage;
}) {
  const t = copy[language];
  const bankOperatingIncome =
    source.category === 'revenue' &&
    /صافي\s+إيرادات\s+التشغيل|\bnet\s+operating\s+income\b/i.test(source.sourceExcerpt);
  const categoryLabels = {
    en: {
      revenue: bankOperatingIncome ? 'Net operating income' : 'Revenue',
      net_profit: 'Net profit',
      assets: 'Total assets',
      liabilities: 'Total liabilities',
      equity: 'Total equity',
      other: source.label,
    },
    ar: {
      revenue: bankOperatingIncome ? 'صافي إيرادات التشغيل' : 'الإيرادات',
      net_profit: 'صافي الربح',
      assets: 'إجمالي الموجودات',
      liabilities: 'إجمالي المطلوبات',
      equity: 'إجمالي حقوق الملكية',
      other: source.label,
    },
  } as const;
  const scale = language === 'ar'
    ? source.unitScale === 'thousands' ? 'بالآلاف' : source.unitScale === 'millions' ? 'بالملايين' : 'وحدات'
    : source.unitScale;
  const period = localizeReportingPeriod(source.reportingPeriod, language) || source.reportingPeriod;
  return (
    <article className="sahm-chat-source" data-testid={`chat-source-${index}`}>
      <div className="sahm-chat-source-heading">
        <strong>{categoryLabels[language][source.category]}</strong>
        <span className="sahm-chat-page">{t.page} {source.sourcePage}</span>
      </div>
      <div className="sahm-chat-source-value" dir="auto">
        <span>{source.reportedValue}</span>
        <span>{[source.currency, scale, period].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="sahm-chat-excerpt-label">{t.excerpt}</div>
      <blockquote dir="auto">{source.sourceExcerpt}</blockquote>
    </article>
  );
}

function AnswerContent({ response, language }: { response: FinancialReportChatResponse; language: SahmLanguage }) {
  const t = copy[language];
  const answer = language === 'ar' ? response.answerArabic : response.answerEnglish;
  const typeLabel = t[response.answerType];
  return (
    <div className="sahm-chat-answer-content">
      <div className={`sahm-chat-answer-type sahm-chat-answer-${response.answerType}`}>
        {response.answerType === 'verified' ? <ShieldCheck size={13} aria-hidden="true" /> : <BookOpen size={13} aria-hidden="true" />}
        <span>{typeLabel}</span>
      </div>
      <p className="sahm-chat-answer-copy" dir="auto">{answer}</p>
      {response.sources.length > 0 && (
        <details className="sahm-chat-sources" open>
          <summary><FileSearch size={14} aria-hidden="true" /><span>{t.sources} · {response.sources.length}</span><ChevronDown size={14} aria-hidden="true" /></summary>
          <div className="sahm-chat-source-list">
            {response.sources.map((source, index) => (
              <SourceEvidence key={`${source.sourcePage}-${source.label}-${index}`} source={source} index={index} language={language} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default function AskSahmChat({ reportId, language }: Props) {
  const t = copy[language];
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [validationError, setValidationError] = useState('');
  const [requestError, setRequestError] = useState(false);
  const mutation = useAskSahmChat();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, mutation.isPending, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  function sendQuestion(cleanQuestion: string, addUserMessage = true) {
    if (!cleanQuestion) {
      setValidationError(t.empty);
      inputRef.current?.focus();
      return;
    }
    if (cleanQuestion.length > 1000) {
      setValidationError(t.tooLong);
      inputRef.current?.focus();
      return;
    }
    if (mutation.isPending) return;

    setValidationError('');
    setRequestError(false);
    const historyMessages = addUserMessage ? messages : messages.slice(0, -1);
    const history: FinancialReportChatHistoryItem[] = historyMessages.slice(-8).map((message) => ({
      role: message.role,
      content: message.role === 'user'
        ? message.content
        : language === 'ar' ? message.response.answerArabic : message.response.answerEnglish,
    }));
    if (addUserMessage) {
      const userMessage: ChatMessage = { id: ++idRef.current, role: 'user', content: cleanQuestion };
      setMessages((current) => [...current, userMessage]);
      setQuestion('');
    }
    mutation.mutate(
      {
        data: {
          question: cleanQuestion,
          ...(reportId ? { reportId } : {}),
          ...(history.length ? { history } : {}),
        },
      },
      {
        onSuccess: (response) => {
          setMessages((current) => [...current, { id: ++idRef.current, role: 'assistant', response }]);
        },
        onError: () => setRequestError(true),
      },
    );
  }

  function submitQuestion(event?: FormEvent) {
    event?.preventDefault();
    sendQuestion(question.trim());
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitQuestion();
    }
  }

  return (
    <div className="sahm-chat-root" dir={dir} lang={language}>
      {isOpen && (
        <section className="sahm-chat-panel" aria-label={t.title} aria-modal="false" role="dialog" data-testid="panel-ask-sahm">
          <header className="sahm-chat-header">
            <div className="sahm-chat-brand-mark" aria-hidden="true">
              <img src="/sahm-icon.png" alt="" />
            </div>
            <div className="sahm-chat-heading">
              <h2>{t.title}</h2>
              <p>{reportId ? t.reportSubtitle : t.generalSubtitle}</p>
            </div>
            <button className="sahm-chat-close" type="button" aria-label={t.close} onClick={() => setIsOpen(false)} data-testid="button-close-chat">
              <X size={17} aria-hidden="true" />
            </button>
          </header>
          <div className="sahm-chat-trust"><span className="sahm-chat-trust-dot" />{t.sourceFirst}</div>

          <div className="sahm-chat-messages" ref={messagesRef} aria-live="polite" aria-relevant="additions text">
            {messages.length === 0 && (
              reportId ? (
                <div className="sahm-chat-empty" data-testid="text-chat-empty">
                  <span className="sahm-chat-empty-icon"><BookOpen size={20} aria-hidden="true" /></span>
                  <h3>{t.hello}</h3>
                  <p>{t.helloDetail}</p>
                </div>
              ) : (
                <div className="sahm-chat-empty sahm-chat-home-empty" data-testid="text-chat-empty">
                  <h3>{t.homeWelcome}</h3>
                  <div className="sahm-chat-suggestions" aria-label={t.suggestionIntro}>
                    <span>{t.suggestionIntro}</span>
                    {t.suggestions.map((suggestion) => (
                      <button
                        type="button"
                        className="sahm-chat-suggestion"
                        key={suggestion}
                        onClick={() => sendQuestion(suggestion)}
                        disabled={mutation.isPending}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
            {messages.map((message) => (
              <article className={`sahm-chat-message sahm-chat-message-${message.role}`} key={message.id} data-testid={`chat-message-${message.role}-${message.id}`}>
                {message.role === 'user'
                  ? <p dir="auto">{message.content}</p>
                  : <div className="sahm-chat-assistant-wrap"><span className="sahm-chat-answer-overline">{reportId ? t.reportAnswerTag : t.generalAnswerTag}</span><AnswerContent response={message.response} language={language} /></div>}
              </article>
            ))}
            {mutation.isPending && (
              <div className="sahm-chat-loading" role="status" data-testid="status-chat-loading">
                <span className="sahm-chat-loading-mark" aria-hidden="true"><i /><i /><i /></span>
                <span><strong>{reportId ? t.loading : t.generalLoading}</strong><small>{reportId ? t.loadingDetail : t.generalLoadingDetail}</small></span>
              </div>
            )}
            {requestError && (
              <div className="sahm-chat-error" role="alert" data-testid="status-chat-error">
                <span>{t.error}</span>
                <button type="button" onClick={() => {
                  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
                  if (latestUserMessage) {
                    sendQuestion(latestUserMessage.content, false);
                  }
                }} data-testid="button-retry-chat">{language === 'ar' ? 'إعادة المحاولة' : 'Try again'}</button>
              </div>
            )}
          </div>

          <form className="sahm-chat-composer" onSubmit={submitQuestion} noValidate>
            {validationError && <div id="sahm-chat-validation" className="sahm-chat-validation" role="alert" data-testid="status-chat-validation">{validationError}</div>}
            <label className="sahm-chat-sr-only" htmlFor="sahm-chat-question">{t.inputLabel}</label>
            <div className="sahm-chat-input-wrap">
              <textarea
                id="sahm-chat-question"
                ref={inputRef}
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  if (validationError) setValidationError('');
                }}
                onKeyDown={onInputKeyDown}
                placeholder={reportId ? t.placeholder : t.generalPlaceholder}
                rows={1}
                maxLength={1000}
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? 'sahm-chat-validation' : undefined}
                data-testid="input-chat-question"
              />
              <button type="submit" className="sahm-chat-send" disabled={mutation.isPending} aria-label={t.send} data-testid="button-send-question">
                <ArrowUp size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="sahm-chat-composer-foot">
              <span>{reportId ? t.reportFoot : t.generalFoot}</span>
              <span>{question.length}/1,000</span>
            </div>
          </form>
        </section>
      )}
      <button
        ref={toggleRef}
        type="button"
        className={`sahm-chat-launcher${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={isOpen ? t.close : t.open}
        data-testid="button-ask-sahm"
      >
        {isOpen ? <X size={18} aria-hidden="true" /> : (
          <span className="sahm-chat-launcher-mark" aria-hidden="true">
            <img src="/sahm-icon.png" alt="" />
          </span>
        )}
        <span>Ask SAHM AI | اسأل سهم</span>
      </button>
    </div>
  );
}
