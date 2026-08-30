import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Lightbulb,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DataManager } from '../lib/data';

function makeNavItems(sections) {
  const items = [{ id: 'ALL', label: '全部题目', count: 384 }];
  sections.forEach((section) => {
    const chunkCount = Math.ceil(section.count / 20);
    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * 20 + 1;
      const end = Math.min((index + 1) * 20, section.count);
      items.push({
        id: `${section.code}-${index}`,
        label: `${section.code} · ${start}–${end}`,
        sectionCode: section.code,
        range: [start, end],
        count: end - start + 1,
      });
    }
  });
  return items;
}

function QuestionSentence({ sentence, answer, showAnswer }) {
  const parts = String(sentence || '').split(/(_{2,})/);
  const answerParts = String(answer || '').split(/\s*(?:\.\s*){2,}\s*/).filter(Boolean);
  let blankIndex = 0;
  return (
    <p className="question-sentence">
      {parts.map((part, index) => {
        if (!/^_{2,}$/.test(part)) return <span key={`${part}-${index}`}>{part}</span>;
        const answerForBlank = answerParts[blankIndex] || answer;
        blankIndex += 1;
        return (
          <mark key={`${part}-${index}`} className={showAnswer ? 'blank-answer' : 'blank-line'}>
            {showAnswer ? answerForBlank : ' '}
          </mark>
        );
      })}
    </p>
  );
}

export default function Quiz({ mode, timeAttack }) {
  const navigate = useNavigate();
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedQuestionId = query.get('question');
  const dueOnly = query.get('review') === 'due';
  const [allQuestions] = useState(() => DataManager.getAllQuestions());
  const [sections] = useState(() => DataManager.getSections());
  const [selectedNavItem, setSelectedNavItem] = useState('ALL');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [openReview, setOpenReview] = useState(null);
  const [bookmarksVersion, setBookmarksVersion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(75);
  const startedAtRef = useRef(Date.now());

  const navItems = useMemo(() => makeNavItems(sections), [sections]);
  const baseQuestions = useMemo(() => {
    if (mode === 'ERROR') {
      const mistakes = new Set(DataManager.getMistakes());
      return allQuestions.filter((question) => mistakes.has(question.id));
    }
    if (dueOnly) {
      const dueIds = new Set(DataManager.getLearningSummary().dueQueue.map((item) => item.questionId).filter(Boolean));
      return allQuestions.filter((question) => dueIds.has(question.id));
    }
    return allQuestions;
  }, [allQuestions, dueOnly, mode]);

  const filteredQuestions = useMemo(() => {
    if (selectedNavItem === 'ALL' || dueOnly || mode === 'ERROR') return baseQuestions;
    const navItem = navItems.find((item) => item.id === selectedNavItem);
    if (!navItem) return baseQuestions;
    const sectionQuestions = baseQuestions.filter((question) => question.sectionCode === navItem.sectionCode);
    return navItem.range
      ? sectionQuestions.slice(navItem.range[0] - 1, navItem.range[1])
      : sectionQuestions;
  }, [baseQuestions, dueOnly, mode, navItems, selectedNavItem]);

  const currentQuestion = filteredQuestions[currentIndex] || null;
  const analysis = currentQuestion?.analysis || null;
  const hasDedicatedAnalysis = analysis?.reviewStatus === 'reviewed' && analysis.logicSteps.length > 0;
  const hasDedicatedHint = hasDedicatedAnalysis && Boolean(analysis.hint);
  const isCorrect = isSubmitted && selectedOption === currentQuestion?.answer;
  const selectedReview = selectedOption !== null && selectedOption >= 0
    ? analysis?.optionReviews?.[selectedOption]
    : null;
  const isBookmarked = currentQuestion ? DataManager.getBookmarks().includes(currentQuestion.id) : false;

  const resetQuestionState = useCallback(() => {
    setSelectedOption(null);
    setIsSubmitted(false);
    setHintUsed(false);
    setOpenReview(null);
    setTimeLeft(75);
    startedAtRef.current = Date.now();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    resetQuestionState();
  }, [currentIndex, currentQuestion?.id, resetQuestionState]);

  useEffect(() => {
    if (!requestedQuestionId || !filteredQuestions.length) return;
    const target = filteredQuestions.findIndex((question) => question.id === requestedQuestionId);
    if (target >= 0) setCurrentIndex(target);
  }, [filteredQuestions, requestedQuestionId]);

  const submitAnswer = useCallback((timedOut = false, explicitSelection = null) => {
    if (!currentQuestion || isSubmitted) return;
    const finalSelection = timedOut ? -1 : explicitSelection ?? selectedOption;
    if (finalSelection === null) return;

    const correct = finalSelection === currentQuestion.answer;
    setSelectedOption(finalSelection);
    setIsSubmitted(true);
    setOpenReview(finalSelection >= 0 && !correct ? finalSelection : null);
    DataManager.recordAttempt({
      questionId: currentQuestion.id,
      sectionCode: currentQuestion.sectionCode,
      correct,
      selectedIndex: finalSelection,
      answerIndex: currentQuestion.answer,
      mode: dueOnly ? 'review' : mode === 'ERROR' ? 'error-review' : 'practice',
      confidence: 'medium',
      durationMs: Date.now() - startedAtRef.current,
      hintUsed,
    });
    setBookmarksVersion((value) => value + 1);
  }, [currentQuestion, dueOnly, hintUsed, isSubmitted, mode, selectedOption]);

  useEffect(() => {
    if (!timeAttack || isSubmitted || !currentQuestion) return undefined;
    if (timeLeft <= 0) {
      submitAnswer(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setTimeLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [currentQuestion, isSubmitted, submitAnswer, timeAttack, timeLeft]);

  const goToQuestion = useCallback((nextIndex) => {
    if (!filteredQuestions.length) return;
    setCurrentIndex(Math.max(0, Math.min(nextIndex, filteredQuestions.length - 1)));
  }, [filteredQuestions.length]);

  const goNext = useCallback(() => {
    if (currentIndex < filteredQuestions.length - 1) goToQuestion(currentIndex + 1);
    else navigate('/data-board');
  }, [currentIndex, filteredQuestions.length, goToQuestion, navigate]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (!isSubmitted && /^[1-5]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        if (currentQuestion?.options[index]) submitAnswer(false, index);
      }
      if (event.key === 'Enter' && isSubmitted) {
        event.preventDefault();
        goNext();
      }
      if (event.key === 'ArrowLeft' && !isSubmitted) goToQuestion(currentIndex - 1);
      if (event.key === 'ArrowRight' && isSubmitted) goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentQuestion, goNext, goToQuestion, isSubmitted, submitAnswer]);

  if (!currentQuestion) {
    return (
      <div className="quiz-empty page-enter">
        <BookOpenCheck size={42} strokeWidth={1.4} />
        <h1>{dueOnly ? '今天的到期复习已经完成' : '这里暂时没有题目'}</h1>
        <p>{dueOnly ? '可以学习新题，或者去数据页查看记忆状态。' : '先完成一些题目，这里就会出现你的复习队列。'}</p>
        <div>
          <Link to="/quiz" className="primary-action">练习新题 <ArrowRight size={18} /></Link>
          <Link to="/" className="secondary-action">返回今日</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`quiz-layout page-enter ${isSidebarOpen ? '' : 'quiz-layout--collapsed'}`}>
      <header className="quiz-topbar">
        <button
          className="icon-button quiz-sidebar-toggle"
          type="button"
          onClick={() => setIsSidebarOpen((open) => !open)}
          aria-label={isSidebarOpen ? '收起题组导航' : '展开题组导航'}
        >
          {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
        <Link to="/" className="quiz-back"><ArrowLeft size={18} /> 返回</Link>
        <span className="wordmark quiz-wordmark">MOONSPELL</span>
        <div className="quiz-topbar__meta">
          {timeAttack ? <span className={`timer ${timeLeft <= 10 ? 'timer--urgent' : ''}`}><Clock3 size={17} /> {timeLeft}s</span> : null}
          <span className="tabular">{currentIndex + 1} / {filteredQuestions.length}</span>
          <span>{dueOnly ? '复习' : mode === 'ERROR' ? '错题' : '题库'}</span>
          <button
            type="button"
            className={`icon-button ${isBookmarked ? 'is-active' : ''}`}
            onClick={() => {
              DataManager.toggleBookmark(currentQuestion.id);
              setBookmarksVersion((value) => value + 1);
            }}
            aria-label={isBookmarked ? '取消收藏本题' : '收藏本题'}
          >
            <Bookmark size={19} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>
      </header>

      <aside className="quiz-sidebar" aria-label="题组导航">
        <div className="quiz-sidebar__title">
          <Menu size={18} />
          <span>题组</span>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={selectedNavItem === item.id ? 'is-active' : ''}
              onClick={() => {
                setSelectedNavItem(item.id);
                setCurrentIndex(0);
              }}
              disabled={dueOnly || mode === 'ERROR'}
            >
              <span>{item.label}</span>
              <small>{item.count}</small>
            </button>
          ))}
        </nav>
      </aside>

      <article key={currentQuestion.id} className="question-workspace question-swap">
        <header className="question-meta">
          <div>
            <strong>{currentQuestion.id}</strong>
            <span>{currentQuestion.difficulty === 1 ? '基础' : currentQuestion.difficulty === 2 ? '中等' : '进阶'}</span>
            <span>{currentQuestion.sectionCode}</span>
          </div>
        </header>

        <QuestionSentence
          sentence={currentQuestion.sentence}
          answer={currentQuestion.answerText}
          showAnswer={isSubmitted}
        />

        {!isSubmitted && hasDedicatedHint ? (
          <button type="button" className="evidence-control" onClick={() => setHintUsed((used) => !used)}>
            <Lightbulb size={18} />
            {hintUsed ? '收起本题提示' : '查看本题专属提示'}
            <ChevronDown size={17} />
          </button>
        ) : null}

        {hintUsed && !isSubmitted && hasDedicatedHint ? (
          <div className="evidence-hint">
            <strong>本题提示</strong>
            <p>{analysis.hint}</p>
          </div>
        ) : null}

        <div className="answer-options" role="radiogroup" aria-label="答案选项">
          {currentQuestion.options.map((option, index) => {
            const correctOption = isSubmitted && index === currentQuestion.answer;
            const wrongSelection = isSubmitted && index === selectedOption && !correctOption;
            const selected = index === selectedOption;
            return (
              <div
                key={`${currentQuestion.id}-${option}`}
                className={`answer-row ${selected ? 'is-selected' : ''} ${correctOption ? 'is-correct' : ''} ${wrongSelection ? 'is-wrong' : ''}`}
              >
                <button
                  type="button"
                  className="answer-row__choice"
                  disabled={isSubmitted}
                  onClick={() => submitAnswer(false, index)}
                  role="radio"
                  aria-checked={selected}
                >
                  <span className="answer-letter">{String.fromCharCode(65 + index)}</span>
                  <strong>{option}</strong>
                  {isSubmitted ? <span className="answer-gloss">{analysis.optionReviews[index]?.translation}</span> : null}
                  {correctOption ? <Check size={20} /> : null}
                  {wrongSelection ? <X size={20} /> : null}
                </button>
                <button
                  type="button"
                  className={`answer-save ${DataManager.isOptionBookmarked(currentQuestion.id, index) ? 'is-saved' : ''}`}
                  onClick={() => {
                    DataManager.toggleOptionBookmark({ questionId: currentQuestion.id, optionIndex: index });
                    setBookmarksVersion((value) => value + 1);
                  }}
                  aria-label={`收藏选项 ${option}`}
                >
                  <Bookmark size={17} fill={DataManager.isOptionBookmarked(currentQuestion.id, index) ? 'currentColor' : 'none'} />
                </button>
              </div>
            );
          })}
        </div>

        {isSubmitted ? (
          <section className="feedback-section" aria-live="polite">
            <div className="feedback-outcome">
              <span className={isCorrect ? 'outcome-icon outcome-icon--correct' : 'outcome-icon outcome-icon--wrong'}>
                {isCorrect ? <Check size={18} /> : <X size={18} />}
              </span>
              <strong>{isCorrect ? '正确' : selectedOption === -1 ? '时间到' : '错误'}</strong>
              <span><b>{analysis.answerLetter}. {analysis.answerText}</b>　{analysis.answerTranslation}</span>
            </div>

            {hasDedicatedAnalysis ? (
              <div className="feedback-grid">
                <div className="feedback-main">
                  <h2>解析</h2>
                  <ol className="logic-map">
                    {analysis.logicSteps.map((step, index) => (
                      <li key={step.title}>
                        <span className={`logic-shape logic-shape--${index + 1}`}>{index + 1}</span>
                        <div><strong>{step.title}</strong><p>{step.text}</p></div>
                      </li>
                    ))}
                  </ol>

                  {analysis.sentenceTranslation ? (
                    <div className="sentence-translation">
                      <span>整句翻译</span>
                      <p>{analysis.sentenceTranslation}</p>
                    </div>
                  ) : null}
                </div>

                <aside className="feedback-side">
                  {!isCorrect && selectedReview ? (
                    <section className="distractor-diagnosis">
                      <h2>{selectedReview.text} 为什么错</h2>
                      <p>{selectedReview.reason}</p>
                    </section>
                  ) : null}

                  <section className="distractor-diagnosis distractor-diagnosis--correct">
                    <h2>{analysis.answerText}</h2>
                    <p>{analysis.optionReviews[currentQuestion.answer]?.reason}</p>
                  </section>

                  <details className="other-options">
                    <summary>其余选项 <ChevronRight size={18} /></summary>
                    <div>
                      {analysis.optionReviews.map((review, index) => (
                        index !== currentQuestion.answer && index !== selectedOption ? (
                          <button
                            type="button"
                            key={`${review.text}-${index}`}
                            onClick={() => setOpenReview(openReview === index ? null : index)}
                          >
                            <span>{review.label}. {review.text} · {review.translation}</span>
                            <ChevronDown size={17} />
                            {openReview === index ? <p>{review.reason}</p> : null}
                          </button>
                        ) : null
                      ))}
                    </div>
                  </details>
                </aside>
              </div>
            ) : null}
          </section>
        ) : null}
      </article>

      {!isSubmitted ? (
        <aside className="question-inspector">
          <section>
            <h2>进度</h2>
            <div className="inspector-progress">
              <span>本组 <b>{currentIndex + 1} / {filteredQuestions.length}</b></span>
              <div><i style={{ width: `${((currentIndex + 1) / filteredQuestions.length) * 100}%` }} /></div>
            </div>
            <div className="inspector-progress">
              <span>全部 <b>{DataManager.getDashboardData().overview.uniqueAnswered} / {allQuestions.length}</b></span>
              <div><i style={{ width: `${(DataManager.getDashboardData().overview.uniqueAnswered / allQuestions.length) * 100}%` }} /></div>
            </div>
          </section>
          <section className="keyboard-help">
            <h2>键盘快捷键</h2>
            <dl>
              <div><dt>1–5</dt><dd>作答并查看解析</dd></div>
              <div><dt>←</dt><dd>上一题</dd></div>
            </dl>
          </section>
        </aside>
      ) : null}

      {isSubmitted ? (
        <footer className="feedback-actions">
          <button type="button" className="secondary-action" onClick={resetQuestionState}>再答一次</button>
          <button type="button" className="primary-action" onClick={goNext}>下一题 <ArrowRight size={18} /></button>
        </footer>
      ) : null}
    </div>
  );
}
