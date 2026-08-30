import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ChevronDown,
  ExternalLink,
  Search,
  Volume2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataManager } from '../lib/data';

const PAGE_SIZE = 24;

function speak(word) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.86;
  window.speechSynthesis.speak(utterance);
}

export default function BarronStudy() {
  const lessons = useMemo(() => DataManager.getBarronLessons(), []);
  const [selectedLesson, setSelectedLesson] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [expandedWord, setExpandedWord] = useState('');
  const [version, setVersion] = useState(0);

  const words = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = selectedLesson === 'all'
      ? lessons.flatMap((lesson) => lesson.words)
      : lessons.find((lesson) => String(lesson.lesson) === selectedLesson)?.words || [];
    if (!normalized) return source;
    return source.filter((entry) => (
      entry.word.includes(normalized)
      || String(entry.barronZh || '').includes(normalized)
      || String(entry.barronEn || '').toLowerCase().includes(normalized)
    ));
  }, [lessons, query, selectedLesson]);

  const totalPages = Math.max(1, Math.ceil(words.length / PAGE_SIZE));
  const visibleWords = words.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
    setExpandedWord('');
  }, [query, selectedLesson]);

  return (
    <div className="barron-page page-enter">
      <header className="page-title-row">
        <div>
          <p className="page-kicker">03 / BARRON</p>
          <h1>Barron 词库</h1>
          <p>399 词 / 37 课</p>
        </div>
        <Link to="/wordbook" className="secondary-action">打开单词本 <ArrowRight size={18} /></Link>
      </header>

      <section className="lexicon-controls" aria-label="词库筛选">
        <label className="search-field">
          <Search size={19} />
          <span className="sr-only">搜索 Barron 词库</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索英文或中文义" />
        </label>
        <label className="select-field">
          <span>课程</span>
          <select value={selectedLesson} onChange={(event) => setSelectedLesson(event.target.value)}>
            <option value="all">全部 37 课</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.lesson}>Lesson {lesson.lesson} · {lesson.theme}</option>
            ))}
          </select>
          <ChevronDown size={17} aria-hidden="true" />
        </label>
        <span className="lexicon-count">{words.length} words</span>
      </section>

      <div className="lesson-index" aria-label="课程快速选择">
        <button type="button" className={selectedLesson === 'all' ? 'is-active' : ''} onClick={() => setSelectedLesson('all')}>ALL</button>
        {lessons.map((lesson) => (
          <button
            type="button"
            key={lesson.id}
            className={selectedLesson === String(lesson.lesson) ? 'is-active' : ''}
            onClick={() => setSelectedLesson(String(lesson.lesson))}
            aria-label={`Lesson ${lesson.lesson}`}
          >
            {String(lesson.lesson).padStart(2, '0')}
          </button>
        ))}
      </div>

      {visibleWords.length ? (
        <section className="lexicon-table" aria-label="Barron 单词列表">
          <div className="lexicon-table__head">
            <span>词</span><span>语境义</span><span>课程</span><span>状态</span><span className="sr-only">操作</span>
          </div>
          {visibleWords.map((entry, index) => {
            const saved = DataManager.getWordBookmarks().includes(entry.word);
            const state = DataManager.getReviewState(`word:${entry.word}`);
            const expanded = expandedWord === entry.word;
            return (
              <article className={`lexicon-row ${expanded ? 'is-expanded' : ''}`} key={entry.word}>
                <button type="button" className="lexicon-row__summary" onClick={() => setExpandedWord(expanded ? '' : entry.word)}>
                  <span className="lexicon-row__word">
                    <small>{String((page - 1) * PAGE_SIZE + index + 1).padStart(3, '0')}</small>
                    <strong>{entry.word}</strong>
                    <em>{entry.partOfSpeech}</em>
                  </span>
                  <span>{entry.barronZh || entry.shortDefs?.[0] || '释义待补充'}</span>
                  <span>Lesson {entry.lesson}</span>
                  <span className={`memory-state memory-state--${state?.status || 'new'}`}>{state?.status || 'new'}</span>
                  <ChevronDown size={18} />
                </button>

                <button
                  type="button"
                  className={`lexicon-row__save ${saved ? 'is-saved' : ''}`}
                  onClick={() => {
                    DataManager.toggleWordBookmark(entry.word);
                    setVersion((value) => value + 1);
                  }}
                  aria-label={saved ? `从单词本移除 ${entry.word}` : `收藏 ${entry.word}`}
                >
                  <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
                </button>

                {expanded ? (
                  <div className="lexicon-row__detail">
                    <div>
                      <span>英文释义</span>
                      <p>{entry.barronEn || entry.shortDefs?.[0] || '暂无可靠英文释义。'}</p>
                      <button type="button" className="audio-button" onClick={() => speak(entry.word)}><Volume2 size={17} /> {entry.phonetic || '播放发音'}</button>
                    </div>
                    <div>
                      <span>巧记质量</span>
                      {entry.memoryHooks?.length ? entry.memoryHooks.map((hook) => (
                        <p key={hook.text}><strong>{hook.title}：</strong>{hook.text} <small>{hook.reviewed ? '已复核' : '待复核'}</small></p>
                      )) : <p className="quality-note">暂无巧记。</p>}
                    </div>
                    <div className="lexicon-row__sources">
                      <a href={entry.cambridgeUrl} target="_blank" rel="noreferrer">核对 Cambridge <ExternalLink size={14} /></a>
                      <a href={entry.merriamUrl} target="_blank" rel="noreferrer">核对 Merriam-Webster <ExternalLink size={14} /></a>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <div className="empty-state">
          <Search size={34} />
          <h2>没有找到匹配的词</h2>
          <p>检查拼写，或切换到全部课程。</p>
        </div>
      )}

      <nav className="pagination" aria-label="词表分页">
        <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}><ArrowLeft size={17} /> 上一页</button>
        <span>第 {page} / {totalPages} 页</span>
        <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages}>下一页 <ArrowRight size={17} /></button>
      </nav>
    </div>
  );
}
