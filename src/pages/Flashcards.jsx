import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookmarkMinus,
  Download,
  ExternalLink,
  RotateCcw,
  Search,
  Volume2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DataManager } from '../lib/data';

function speakWord(word) {
  if (!('speechSynthesis' in window) || !word) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.86;
  window.speechSynthesis.speak(utterance);
}

function downloadWordbook(entries) {
  const lines = [['word', 'part_of_speech', 'definition', 'chinese', 'status']];
  entries.forEach((entry) => lines.push([
    entry.word,
    entry.partOfSpeech || '',
    entry.shortDefs?.[0] || entry.barronEn || '',
    entry.barronZh || '',
    DataManager.getReviewState(`word:${entry.word}`)?.status || 'new',
  ]));
  const csv = lines.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `moonspell-wordbook-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Flashcards({ defaultTab = 'wordbook' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('mode') === 'review' || defaultTab === 'flashcards' ? 'review' : 'wordbook';
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState(0);
  const [queue, setQueue] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const startedAtRef = useRef(Date.now());

  const entries = useMemo(() => DataManager.getWordbookEntries(), [version]);
  const summary = useMemo(() => DataManager.getWordbookSummary(), [version]);
  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.word, entry])), [entries]);
  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return entries;
    return entries.filter((entry) => (
      entry.word.includes(normalized)
      || String(entry.barronZh || '').includes(normalized)
      || (entry.shortDefs || []).some((definition) => definition.toLowerCase().includes(normalized))
    ));
  }, [entries, query]);

  useEffect(() => {
    const dueWords = entries
      .filter((entry) => DataManager.getReviewState(`word:${entry.word}`)?.status === 'due')
      .map((entry) => entry.word);
    const learningWords = entries
      .filter((entry) => ['new', 'learning'].includes(DataManager.getReviewState(`word:${entry.word}`)?.status || 'new'))
      .map((entry) => entry.word);
    const nextQueue = [...new Set([...dueWords, ...learningWords])];
    setQueue(nextQueue);
    setCurrentWord((word) => word && nextQueue.includes(word) ? word : nextQueue[0] || '');
  }, [entries]);

  const currentEntry = entryMap.get(currentWord) || null;
  const changeTab = (nextTab) => {
    setTab(nextTab);
    setSearchParams(nextTab === 'review' ? { mode: 'review' } : {});
    setRevealed(false);
  };

  const grade = (result) => {
    if (!currentEntry) return;
    const grading = {
      again: { correct: false, confidence: 'low', grade: 'again' },
      unsure: { correct: true, confidence: 'low', grade: 'good' },
      good: { correct: true, confidence: 'high', grade: 'good' },
    }[result];
    DataManager.recordReview({
      itemId: `word:${currentEntry.word}`,
      itemType: 'word',
      word: currentEntry.word,
      ...grading,
      durationMs: Date.now() - startedAtRef.current,
    });
    const remaining = queue.filter((word) => word !== currentEntry.word);
    if (result === 'again') remaining.splice(Math.min(2, remaining.length), 0, currentEntry.word);
    setQueue(remaining);
    setCurrentWord(remaining[0] || '');
    setRevealed(false);
    setSessionReviewed((count) => count + 1);
    startedAtRef.current = Date.now();
    setVersion((value) => value + 1);
  };

  useEffect(() => {
    if (tab !== 'review' || !currentEntry) return undefined;
    const handleKeyDown = (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code === 'Space') {
        event.preventDefault();
        setRevealed((value) => !value);
        return;
      }
      if (!revealed) return;
      if (event.key === '1') grade('again');
      if (event.key === '2') grade('unsure');
      if (event.key === '3') grade('good');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentEntry, revealed, tab]);

  return (
    <div className="wordbook-page page-enter">
      <header className="page-title-row">
        <div>
          <p className="page-kicker">04 / WORDS</p>
          <h1>单词本</h1>
        </div>
        <div className="page-title-actions">
          <button type="button" className="secondary-action" onClick={() => downloadWordbook(entries)} disabled={!entries.length}>
            <Download size={18} /> 导出 CSV
          </button>
          <Link to="/barron" className="secondary-action">浏览 Barron 词表 <ArrowRight size={18} /></Link>
        </div>
      </header>

      <div className="segmented-tabs" role="tablist" aria-label="单词本模式">
        <button type="button" role="tab" aria-selected={tab === 'wordbook'} className={tab === 'wordbook' ? 'is-active' : ''} onClick={() => changeTab('wordbook')}>词表</button>
        <button type="button" role="tab" aria-selected={tab === 'review'} className={tab === 'review' ? 'is-active' : ''} onClick={() => changeTab('review')}>到期复习</button>
      </div>

      {tab === 'wordbook' ? (
        <div className="wordbook-layout">
          <aside className="wordbook-summary">
            <h2>档案状态</h2>
            <dl>
              <div><dt>已收藏</dt><dd>{summary.totalWords}</dd></div>
              <div><dt>有词典释义</dt><dd>{summary.withLookup}</dd></div>
              <div><dt>有关联题目</dt><dd>{summary.withRelated}</dd></div>
              <div><dt>有可用巧记</dt><dd>{summary.withHooks}</dd></div>
            </dl>
          </aside>

          <section className="word-list-panel">
            <label className="search-field">
              <Search size={19} />
              <span className="sr-only">搜索单词本</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单词、中文义或英文定义" />
            </label>

            {filteredEntries.length ? (
              <div className="word-list">
                {filteredEntries.map((entry, index) => {
                  const state = DataManager.getReviewState(`word:${entry.word}`);
                  return (
                    <article key={entry.word} className="word-list-row">
                      <span className="word-list-row__index">{String(index + 1).padStart(2, '0')}</span>
                      <div className="word-list-row__main">
                        <div>
                          <h2>{entry.word}</h2>
                          <button type="button" className="audio-button" onClick={() => speakWord(entry.word)} aria-label={`播放 ${entry.word} 发音`}>
                            <Volume2 size={16} /> {entry.phonetic || '播放'}
                          </button>
                        </div>
                        <p>{entry.barronZh || entry.shortDefs?.[0] || '释义需要联网查询或人工补充'}</p>
                        <span>{entry.partOfSpeech || 'word'} · {state?.status || 'new'}</span>
                      </div>
                      <div className="word-list-row__actions">
                        <button type="button" onClick={() => { setCurrentWord(entry.word); changeTab('review'); }}>
                          复习 <ArrowRight size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            DataManager.toggleWordBookmark(entry.word);
                            setVersion((value) => value + 1);
                          }}
                          aria-label={`从单词本移除 ${entry.word}`}
                        >
                          <BookmarkMinus size={18} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <BookOpen size={34} />
                <h2>{entries.length ? '没有匹配的词' : '单词本还是空的'}</h2>
                <p>{entries.length ? '换一个关键词试试。' : '在做题或 Barron 词表中收藏单词后，它们会出现在这里。'}</p>
                {!entries.length ? <Link to="/quiz" className="primary-action">开始练习 <ArrowRight size={18} /></Link> : null}
              </div>
            )}
          </section>
        </div>
      ) : (
        <section className="review-studio">
          <header>
            <div>
              <p className="page-kicker">REVIEW</p>
              <h2>{currentEntry ? `${queue.length} 个待处理` : '本轮复习完成'}</h2>
            </div>
            <span>本轮已复习 {sessionReviewed}</span>
          </header>

          {currentEntry ? (
            <>
              <div className={`memory-card-stage ${revealed ? 'is-revealed' : ''}`}>
                <article className="memory-card">
                  <div className="memory-card__face memory-card__front" aria-hidden={revealed} inert={revealed ? '' : undefined}>
                    <div className="memory-card__prompt">
                      <span>{currentEntry.partOfSpeech || 'word'}</span>
                      <h2>{currentEntry.word}</h2>
                      <button type="button" className="audio-button" onClick={() => speakWord(currentEntry.word)}>
                        <Volume2 size={18} /> {currentEntry.phonetic || '播放发音'}
                      </button>
                      <p>回忆词义。</p>
                    </div>
                  </div>
                  <div className="memory-card__face memory-card__back" aria-hidden={!revealed} inert={!revealed ? '' : undefined}>
                    <div className="memory-card__prompt memory-card__prompt--compact">
                      <span>{currentEntry.partOfSpeech || 'word'}</span>
                      <h2>{currentEntry.word}</h2>
                      <button type="button" className="audio-button" onClick={() => speakWord(currentEntry.word)}>
                        <Volume2 size={18} /> {currentEntry.phonetic || '播放发音'}
                      </button>
                    </div>
                    <div className="memory-card__answer">
                      <span>语境义</span>
                      <h3>{currentEntry.barronZh || currentEntry.shortDefs?.[0] || '暂无可靠中文释义'}</h3>
                      {(currentEntry.shortDefs || []).slice(0, 2).map((definition) => <p key={definition}>{definition}</p>)}

                      <div className="memory-hook-area">
                        <h4>巧记</h4>
                        {currentEntry.memoryHooks?.length ? (
                          currentEntry.memoryHooks.map((hook) => (
                            <div key={hook.text}>
                              <strong>{hook.title}</strong>
                              <p>{hook.text}</p>
                              {!hook.reviewed ? <span>待复核联想</span> : <span>已复核</span>}
                            </div>
                          ))
                        ) : (
                          <p className="quality-note">暂无巧记。</p>
                        )}
                      </div>

                      {currentEntry.relatedQuestionIds?.length ? (
                        <Link to={`/quiz?question=${currentEntry.relatedQuestionIds[0]}`} className="text-action">
                          回到关联题目 <ArrowRight size={16} />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              </div>

              {!revealed ? (
                <button type="button" className="primary-action reveal-action" onClick={() => setRevealed(true)}>
                  显示答案
                </button>
              ) : (
                <div className="review-grades">
                  <button type="button" onClick={() => grade('again')}><RotateCcw size={18} /><strong>没想起</strong><span>10 分钟后</span></button>
                  <button type="button" onClick={() => grade('unsure')}><strong>想起但不确定</strong><span>较近复习</span></button>
                  <button type="button" className="is-primary" onClick={() => grade('good')}><strong>清楚记得</strong><span>拉长间隔</span></button>
                </div>
              )}
              <p className="review-hotkeys">Space 翻面 · 1 / 2 / 3 评分</p>
            </>
          ) : (
            <div className="empty-state review-complete">
              <BookOpen size={38} />
              <h2>暂无到期单词</h2>
              <button type="button" className="secondary-action" onClick={() => changeTab('wordbook')}><ArrowLeft size={18} /> 返回词表</button>
            </div>
          )}
        </section>
      )}

      <footer className="source-links">
        <span>需要核对词义时，优先查看权威词典。</span>
        <a href="https://dictionary.cambridge.org/" target="_blank" rel="noreferrer">Cambridge <ExternalLink size={15} /></a>
        <a href="https://www.merriam-webster.com/" target="_blank" rel="noreferrer">Merriam-Webster <ExternalLink size={15} /></a>
      </footer>
    </div>
  );
}
