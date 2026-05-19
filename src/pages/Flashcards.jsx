import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataManager } from '../lib/data';

const QUIZLET_CREATE_SET_URL = 'https://quizlet.com/create-set';

function flattenText(value) {
  return String(value ?? '')
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function encodeCsvCell(value) {
  return `"${flattenText(value).replaceAll('"', '""')}"`;
}

function makeTimestampTag() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join('');
}

function triggerFileDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', 'true');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
}

function buildWordbookRows(entries) {
  return entries.map((entry) => {
    const definitions = Array.isArray(entry.shortDefs) ? entry.shortDefs.filter(Boolean) : [];
    const hooks = Array.isArray(entry.memoryHooks) ? entry.memoryHooks : [];
    const hookTexts = hooks.map((hook) => flattenText(hook?.text || '')).filter(Boolean);
    const primaryDefinition =
      definitions[0] ||
      flattenText(entry.barronZh || '') ||
      hookTexts[0] ||
      (Array.isArray(entry.derivatives) ? entry.derivatives.join(', ') : '');

    return {
      term: entry.word || '',
      definition: primaryDefinition,
      pronunciation: entry.phonetic || '',
      extraDefinitions: definitions.slice(1).join(' | '),
      barronZh: flattenText(entry.barronZh || ''),
      mnemonic1: hookTexts[0] || '',
      mnemonic2: hookTexts[1] || '',
      derivatives: Array.isArray(entry.derivatives) ? entry.derivatives.join(', ') : '',
      sourceQuestions: Array.isArray(entry.relatedQuestionIds) ? entry.relatedQuestionIds.join(', ') : '',
      cambridgeUrl: entry.cambridgeUrl || '',
      merriamUrl: entry.merriamUrl || '',
    };
  });
}

function shuffleList(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function SummaryCard({ label, value, note, tone = 'theme-text-primary' }) {
  return (
    <div className="theme-bg-panel border-2 md:border-4 theme-border p-4 brutal-shadow">
      <div className="font-pixel-eng text-xs md:text-sm opacity-70">{label}</div>
      <div className={`font-brutal-title text-2xl md:text-4xl mt-2 ${tone}`}>{value}</div>
      {note ? <div className="font-brutal-body text-xs md:text-sm mt-2 opacity-80">{note}</div> : null}
    </div>
  );
}

export default function Flashcards({ defaultTab = 'wordbook' }) {
  const [tab, setTab] = useState(defaultTab);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [lookup, setLookup] = useState(null);
  const [lookupStatus, setLookupStatus] = useState('idle');
  const [wordbookVersion, setWordbookVersion] = useState(0);
  const [sessionQueue, setSessionQueue] = useState([]);
  const [sessionRound, setSessionRound] = useState(1);
  const [sessionStats, setSessionStats] = useState({ seen: 0, again: 0, good: 0, easy: 0 });
  const [exportNotice, setExportNotice] = useState('');

  const entries = DataManager.getWordbookEntries();
  const summary = DataManager.getWordbookSummary();
  const entryWords = useMemo(() => entries.map((entry) => entry.word), [entries]);
  const entryWordsKey = entryWords.join('|');
  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.word, entry])), [entries]);
  const currentEntry = entries[currentIndex] || null;
  const currentWord = currentEntry?.word || '';
  const currentFlashWord = sessionQueue[0] || '';
  const currentFlashEntry = entryMap.get(currentFlashWord) || null;
  const lookupWord = tab === 'flashcards' ? currentFlashWord : currentWord;

  useEffect(() => {
    if (currentIndex >= entries.length && entries.length > 0) {
      setCurrentIndex(entries.length - 1);
    }
    if (!entries.length) {
      setCurrentIndex(0);
    }
  }, [entries.length, currentIndex, wordbookVersion]);

  useEffect(() => {
    setSessionQueue(shuffleList(entryWords));
    setSessionRound(1);
    setSessionStats({ seen: 0, again: 0, good: 0, easy: 0 });
    setIsFlipped(false);
  }, [entryWordsKey]);

  useEffect(() => {
    let active = true;

    if (!lookupWord) {
      setLookup(null);
      setLookupStatus('idle');
      return undefined;
    }

    const cached = DataManager.getCachedWordLookup(lookupWord);
    if (cached) {
      setLookup(cached);
      setLookupStatus('ready');
    } else {
      setLookup(null);
      setLookupStatus('loading');
    }

    DataManager.fetchWordLookup(lookupWord).then((result) => {
      if (!active) return;
      setLookup(result);
      setLookupStatus(result ? 'ready' : 'empty');
    });

    return () => {
      active = false;
    };
  }, [lookupWord]);

  const jumpToWord = (index) => {
    setIsFlipped(false);
    setCurrentIndex(index);
  };

  const playAudio = () => {
    if (!lookup?.audioUrl) return;
    const audio = new Audio(lookup.audioUrl);
    audio.play().catch(() => {});
  };

  const removeCurrentWord = () => {
    if (!currentWord) return;
    DataManager.toggleWordBookmark(currentWord);
    setWordbookVersion((value) => value + 1);
    setIsFlipped(false);
  };

  const gradeFlashcard = useCallback((grade) => {
    if (!entryWords.length) return;

    setSessionQueue((prevQueue) => {
      if (!prevQueue.length) return prevQueue;

      const [current, ...rest] = prevQueue;
      const nextQueue = [...rest];

      if (grade === 'again') {
        const insertIndex = Math.min(2, nextQueue.length);
        nextQueue.splice(insertIndex, 0, current);
      } else if (grade === 'good') {
        nextQueue.push(current);
      }

      if (!nextQueue.length) {
        setSessionRound((round) => round + 1);
        return shuffleList(entryWords);
      }

      return nextQueue;
    });

    setSessionStats((prev) => ({
      ...prev,
      seen: prev.seen + 1,
      [grade]: prev[grade] + 1,
    }));
    setIsFlipped(false);
  }, [entryWords]);

  const skipFlashcard = useCallback(() => {
    setSessionQueue((prevQueue) => {
      if (prevQueue.length <= 1) return prevQueue;
      const [current, ...rest] = prevQueue;
      return [...rest, current];
    });
    setIsFlipped(false);
  }, []);

  const focusFlashWord = useCallback((word) => {
    if (!word) return;
    setSessionQueue((prevQueue) => {
      if (!prevQueue.includes(word)) return prevQueue;
      const rest = prevQueue.filter((item) => item !== word);
      return [word, ...rest];
    });
    setIsFlipped(false);
  }, []);

  const resetFlashSession = useCallback(() => {
    setSessionQueue(shuffleList(entryWords));
    setSessionRound(1);
    setSessionStats({ seen: 0, again: 0, good: 0, easy: 0 });
    setIsFlipped(false);
  }, [entryWords]);

  const exportWordbookCsv = useCallback(() => {
    if (!entries.length) {
      setExportNotice('Wordbook 还是空的，先收藏几个词再导出。');
      return;
    }

    const rows = buildWordbookRows(entries);
    const headers = [
      'Term',
      'Definition',
      'Pronunciation',
      'BarronZh',
      'ExtraDefinitions',
      'Mnemonic1',
      'Mnemonic2',
      'Derivatives',
      'SourceQuestions',
      'CambridgeURL',
      'MerriamURL',
    ];

    const csvLines = [
      headers.map(encodeCsvCell).join(','),
      ...rows.map((row) => ([
        row.term,
        row.definition,
        row.pronunciation,
        row.barronZh,
        row.extraDefinitions,
        row.mnemonic1,
        row.mnemonic2,
        row.derivatives,
        row.sourceQuestions,
        row.cambridgeUrl,
        row.merriamUrl,
      ]).map(encodeCsvCell).join(',')),
    ];

    const filename = `moonspell-wordbook-${makeTimestampTag()}.csv`;
    triggerFileDownload(`\uFEFF${csvLines.join('\r\n')}`, filename, 'text/csv;charset=utf-8;');
    setExportNotice(`已导出 ${rows.length} 个单词到 ${filename}（Excel 可直接打开）。`);
  }, [entries]);

  const copyQuizletImportText = useCallback(async () => {
    if (!entries.length) {
      setExportNotice('Wordbook 还是空的，先收藏几个词再复制 Quizlet 文本。');
      return;
    }

    const rows = buildWordbookRows(entries);
    const quizletText = rows
      .map((row) => `${flattenText(row.term)}\t${flattenText(row.definition)}`)
      .join('\n');

    try {
      await copyText(quizletText);
      setExportNotice(`已复制 ${rows.length} 行 Quizlet 导入文本（Term[TAB]Definition）。`);
    } catch (_error) {
      setExportNotice('复制失败，请检查浏览器剪贴板权限。');
    }
  }, [entries]);

  const openQuizletImportPage = useCallback(() => {
    window.open(QUIZLET_CREATE_SET_URL, '_blank', 'noopener,noreferrer');
    setExportNotice('已打开 Quizlet 创建页面，直接粘贴“复制 Quizlet 文本”的内容即可导入。');
  }, []);

  useEffect(() => {
    if (tab !== 'flashcards') return undefined;

    const handleKeydown = (event) => {
      const targetTag = String(event.target?.tagName || '').toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        setIsFlipped((prev) => !prev);
        return;
      }
      if (event.key === '1') {
        event.preventDefault();
        gradeFlashcard('again');
        return;
      }
      if (event.key === '2') {
        event.preventDefault();
        gradeFlashcard('good');
        return;
      }
      if (event.key === '3') {
        event.preventDefault();
        gradeFlashcard('easy');
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        skipFlashcard();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [tab, gradeFlashcard, skipFlashcard]);

  if (!entries.length) {
    return (
      <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in-up z-10 px-4 mt-20">
        <div className="theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg p-6 md:p-12 text-center w-full relative stripe-bg">
          <h2 className="font-pixel-title text-xl md:text-3xl theme-text-blue mb-6">NO WORDBOOK</h2>
          <p className="font-brutal-body text-lg md:text-xl mb-8">Save words during practice, or open Barron Lessons to batch-add vocabulary into your account wordbook.</p>
          <div className="grid gap-3">
            <Link to="/barron" className="block text-center w-full py-3 md:py-4 theme-bg-green theme-text-on-color font-pixel-eng text-xl md:text-2xl uppercase border-2 md:border-4 theme-border brutal-shadow brutal-btn no-underline">
              OPEN BARRON
            </Link>
            <Link to="/" className="block text-center w-full py-3 md:py-4 theme-bg-blue theme-text-on-color font-pixel-eng text-xl md:text-2xl uppercase border-2 md:border-4 theme-border brutal-shadow brutal-btn no-underline">
              RETURN TO BASE
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl flex flex-col items-center animate-fade-in-up z-10 px-4 pb-20">
      <div className="mt-8 mb-6 text-center w-full relative">
        <h1 className="font-pixel-title text-2xl md:text-4xl theme-text-orange uppercase mb-4 pixel-text-outline leading-tight">WORDBOOK</h1>
        <div className="font-pixel-eng text-lg md:text-xl theme-text-muted">
          {tab === 'flashcards'
            ? `Round ${sessionRound} · Queue ${sessionQueue.length}`
            : `${currentIndex + 1} / ${entries.length}`}
        </div>
      </div>

      <div className="w-full grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Saved Words" value={summary.totalWords} tone="theme-text-orange" note="收藏就自动进入生词本" />
        <SummaryCard label="Mnemonic Ready" value={summary.withHooks} tone="theme-text-blue" note="每个词至少两条巧记法" />
        <SummaryCard label="Lookup Ready" value={summary.withLookup} tone="theme-text-green" note="已带词典义 / 音标 / 发音" />
        <SummaryCard label="Suggested Deck" value={summary.suggestedDeckSize} tone="theme-text-red" note="建议每轮 flashcards 数量" />
      </div>

      <div className="w-full flex flex-wrap gap-3 mb-6">
        <Link
          to="/barron"
          className="px-4 py-3 border-2 md:border-4 theme-border brutal-shadow brutal-btn font-brutal-title text-sm md:text-base uppercase no-underline theme-bg-green theme-text-on-color"
        >
          Barron Lessons
        </Link>
        <button
          type="button"
          onClick={() => setTab('wordbook')}
          className={`px-4 py-3 border-2 md:border-4 theme-border brutal-shadow brutal-btn font-brutal-title text-sm md:text-base uppercase ${tab === 'wordbook' ? 'theme-bg-blue theme-text-on-color' : 'theme-bg-card theme-text-primary'}`}
        >
          Wordbook
        </button>
        <button
          type="button"
          onClick={() => setTab('flashcards')}
          className={`px-4 py-3 border-2 md:border-4 theme-border brutal-shadow brutal-btn font-brutal-title text-sm md:text-base uppercase ${tab === 'flashcards' ? 'theme-bg-orange theme-text-on-orange' : 'theme-bg-card theme-text-primary'}`}
        >
          Flashcards
        </button>
      </div>

      <div className="w-full mb-6 border-2 md:border-4 theme-border theme-bg-panel brutal-shadow p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-pixel-eng text-xs md:text-sm opacity-70">QUIZLET EXPORT</div>
            <div className="font-brutal-body text-sm md:text-base theme-text-primary mt-1">
              一键导出 Excel（CSV）或复制 Quizlet 导入文本。
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportWordbookCsv}
              className="px-3 py-2 border-2 theme-border theme-bg-blue theme-text-on-color font-pixel-eng text-xs md:text-sm brutal-btn"
            >
              EXPORT EXCEL CSV
            </button>
            <button
              type="button"
              onClick={copyQuizletImportText}
              className="px-3 py-2 border-2 theme-border theme-bg-orange theme-text-on-orange font-pixel-eng text-xs md:text-sm brutal-btn"
            >
              COPY QUIZLET TEXT
            </button>
            <button
              type="button"
              onClick={openQuizletImportPage}
              className="px-3 py-2 border-2 theme-border theme-bg-card theme-text-primary font-pixel-eng text-xs md:text-sm brutal-btn"
            >
              OPEN QUIZLET
            </button>
          </div>
        </div>
        {exportNotice ? (
          <div className="mt-3 font-brutal-body text-sm theme-text-muted">
            {exportNotice}
          </div>
        ) : null}
      </div>

      <div className="w-full grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-start">
        <div className="theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg p-4 md:p-6 stripe-bg">
          {tab === 'wordbook' ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-pixel-eng text-xs md:text-sm opacity-70">WORD ENTRY</div>
                  <h2 className="font-brutal-title text-3xl md:text-5xl theme-text-primary break-words">{currentWord}</h2>
                  {lookup?.phonetic ? (
                    <div className="font-brutal-body text-base md:text-lg theme-text-blue mt-2">{lookup.phonetic}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {lookup?.audioUrl ? (
                    <button
                      type="button"
                      onClick={playAudio}
                      className="px-3 py-2 border-2 theme-border theme-bg-orange theme-text-on-orange font-pixel-eng text-sm brutal-btn"
                    >
                      PLAY
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={removeCurrentWord}
                    className="px-3 py-2 border-2 theme-border theme-bg-card theme-text-primary font-pixel-eng text-sm brutal-btn"
                  >
                    REMOVE
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="border-2 theme-border bg-white/80 p-4">
                  <div className="font-pixel-eng text-xs md:text-sm opacity-70 mb-2">ENGLISH DEFINITION</div>
                  {lookupStatus === 'loading' ? (
                    <div className="font-brutal-body text-base md:text-lg">Loading live dictionary data...</div>
                  ) : lookup?.shortDefs?.length ? (
                    <ul className="space-y-2">
                      {lookup.shortDefs.slice(0, 3).map((definition, index) => (
                        <li key={`def-${index}`} className="font-brutal-body text-base md:text-lg leading-relaxed">
                          {index + 1}. {definition}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="font-brutal-body text-base md:text-lg theme-text-muted">Definition not available yet.</div>
                  )}
                </div>

                <div className="border-2 theme-border bg-white/80 p-4">
                  <div className="font-pixel-eng text-xs md:text-sm opacity-70 mb-2">WORD PLAN</div>
                  <div className="font-brutal-body text-base md:text-lg leading-relaxed">
                    先把这页两条巧记法看完，再去 Flashcards 模式刷一轮。建议把今天的词卡批次控制在 {summary.suggestedDeckSize} 个以内。
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <a href={currentEntry.cambridgeUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 border-2 theme-border theme-bg-card theme-text-blue font-brutal-body no-underline">
                      Cambridge
                    </a>
                    <a href={currentEntry.merriamUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 border-2 theme-border theme-bg-card theme-text-blue font-brutal-body no-underline">
                      Merriam-Webster
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {currentEntry.memoryHooks.map((hook, index) => (
                  <div key={`${currentWord}-hook-${index}`} className="border-2 theme-border bg-white/80 p-4 brutal-shadow">
                    <div className="font-pixel-eng text-xs md:text-sm opacity-70 mb-2">MNEMONIC {index + 1}</div>
                    <div className="font-brutal-title text-lg md:text-xl theme-text-blue mb-2">{hook.title}</div>
                    <div className="font-brutal-body text-sm md:text-base leading-relaxed">{hook.text}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="border-2 theme-border bg-white/80 p-4">
                  <div className="font-pixel-eng text-xs md:text-sm opacity-70 mb-2">WORD FAMILY</div>
                  {currentEntry.derivatives?.length ? (
                    <div className="font-brutal-body text-sm md:text-base leading-relaxed">
                      {currentEntry.derivatives.join(', ')}
                    </div>
                  ) : (
                    <div className="font-brutal-body text-sm md:text-base theme-text-muted">No clean derivative list yet.</div>
                  )}
                </div>

                <div className="border-2 theme-border bg-white/80 p-4">
                  <div className="font-pixel-eng text-xs md:text-sm opacity-70 mb-2">SOURCE QUESTIONS</div>
                  {currentEntry.relatedQuestionIds?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {currentEntry.relatedQuestionIds.slice(0, 8).map((questionId) => (
                        <Link
                          key={`${currentWord}-${questionId}`}
                          to={`/quiz?question=${questionId}`}
                          className="px-3 py-2 border-2 theme-border theme-bg-card theme-text-primary font-pixel-eng text-xs md:text-sm no-underline brutal-btn"
                        >
                          {questionId}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="font-brutal-body text-sm md:text-base theme-text-muted">No source-question link yet.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2 py-1 border-2 theme-border theme-bg-card font-pixel-eng text-xs">Round {sessionRound}</span>
                <span className="px-2 py-1 border-2 theme-border theme-bg-card font-pixel-eng text-xs">Queue {sessionQueue.length}</span>
                <span className="px-2 py-1 border-2 theme-border theme-bg-card font-pixel-eng text-xs">Seen {sessionStats.seen}</span>
                <span className="px-2 py-1 border-2 theme-border theme-bg-card font-pixel-eng text-xs">Again {sessionStats.again}</span>
                <span className="px-2 py-1 border-2 theme-border theme-bg-card font-pixel-eng text-xs">Good {sessionStats.good}</span>
                <span className="px-2 py-1 border-2 theme-border theme-bg-card font-pixel-eng text-xs">Easy {sessionStats.easy}</span>
              </div>

              <div className="w-full h-80 md:h-96 relative perspective-1000 cursor-pointer group" onClick={() => setIsFlipped((prev) => !prev)}>
                <div className={`relative w-full h-full transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''}`} style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                  <div className="absolute inset-0 backface-hidden theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg flex flex-col items-center justify-center p-6 md:p-8 stripe-bg">
                    <div className="absolute top-4 left-4 font-pixel-eng text-xs md:text-sm opacity-50">FRONT</div>
                    <div className="absolute top-4 right-4 font-pixel-eng text-xs md:text-sm opacity-70 theme-text-blue">
                      {lookup?.phonetic || currentFlashEntry?.phonetic || 'Flip for review'}
                    </div>
                    <h2 className="font-brutal-title text-4xl md:text-7xl theme-text-primary mb-4 break-words text-center">{currentFlashWord}</h2>
                    <div className="font-brutal-body text-lg md:text-xl theme-text-blue">Tap / Space to flip, then rate memory strength</div>
                  </div>

                  <div className="absolute inset-0 backface-hidden theme-bg-inverse theme-text-inverse border-2 md:border-4 theme-border brutal-shadow-lg p-6 md:p-8" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}>
                    <div className="font-pixel-eng text-xs md:text-sm opacity-50 mb-3">BACK</div>
                    <div className="space-y-4 overflow-y-auto max-h-full pr-1">
                      {currentFlashEntry?.barronZh ? (
                        <div>
                          <div className="font-pixel-eng text-xs md:text-sm opacity-70 mb-1">BARRON CHINESE</div>
                          <div className="font-brutal-body text-base md:text-lg leading-relaxed">{currentFlashEntry.barronZh}</div>
                        </div>
                      ) : null}

                      <div>
                        <div className="font-pixel-eng text-xs md:text-sm opacity-70 mb-1">DEFINITION</div>
                        {lookup?.shortDefs?.length ? (
                          <div className="font-brutal-body text-base md:text-lg leading-relaxed">{lookup.shortDefs[0]}</div>
                        ) : currentFlashEntry?.shortDefs?.length ? (
                          <div className="font-brutal-body text-base md:text-lg leading-relaxed">{currentFlashEntry.shortDefs[0]}</div>
                        ) : (
                          <div className="font-brutal-body text-base md:text-lg theme-text-muted">Definition not available yet.</div>
                        )}
                      </div>

                      {(currentFlashEntry?.memoryHooks || []).map((hook, index) => (
                        <div key={`${currentFlashWord}-flash-hook-${index}`}>
                          <div className="font-pixel-eng text-xs md:text-sm opacity-70 mb-1">MNEMONIC {index + 1}</div>
                          <div className="font-brutal-body text-sm md:text-base leading-relaxed">{hook.text}</div>
                        </div>
                      ))}

                      {currentFlashEntry?.derivatives?.length ? (
                        <div>
                          <div className="font-pixel-eng text-xs md:text-sm opacity-70 mb-1">WORD FAMILY</div>
                          <div className="font-brutal-body text-sm md:text-base leading-relaxed">{currentFlashEntry.derivatives.slice(0, 6).join(', ')}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
                <button onClick={() => gradeFlashcard('again')} className="py-3 theme-bg-red theme-text-on-color font-pixel-eng text-sm md:text-lg uppercase border-2 theme-border brutal-shadow brutal-btn">
                  1 AGAIN
                </button>
                <button onClick={() => gradeFlashcard('good')} className="py-3 theme-bg-blue theme-text-on-color font-pixel-eng text-sm md:text-lg uppercase border-2 theme-border brutal-shadow brutal-btn">
                  2 GOOD
                </button>
                <button onClick={() => gradeFlashcard('easy')} className="py-3 theme-bg-green theme-text-on-color font-pixel-eng text-sm md:text-lg uppercase border-2 theme-border brutal-shadow brutal-btn">
                  3 EASY
                </button>
                <button onClick={skipFlashcard} className="py-3 theme-bg-panel theme-text-primary font-pixel-eng text-sm md:text-lg uppercase border-2 theme-border brutal-shadow brutal-btn">
                  SKIP
                </button>
                <button onClick={resetFlashSession} className="py-3 theme-bg-orange theme-text-on-orange font-pixel-eng text-sm md:text-lg uppercase border-2 theme-border brutal-shadow brutal-btn">
                  RESET
                </button>
              </div>

              <div className="mt-3 font-pixel-eng text-xs theme-text-muted">
                Hotkeys: `Space` flip · `1` again · `2` good · `3` easy · `→` skip
              </div>
            </div>
          )}
        </div>

        <div className="theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg p-4 md:p-5 stripe-bg">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="font-pixel-eng text-xs opacity-70">{tab === 'flashcards' ? 'FLASH QUEUE' : 'WORD LIST'}</div>
              <h2 className="font-brutal-title text-xl md:text-2xl">{tab === 'flashcards' ? 'Session Queue' : 'Saved Vocabulary'}</h2>
            </div>
            <div className="font-pixel-eng text-sm theme-text-muted">{tab === 'flashcards' ? `${sessionQueue.length} in queue` : `${entries.length} saved`}</div>
          </div>

          <div className="space-y-3 max-h-[42rem] overflow-y-auto pr-1">
            {(tab === 'flashcards' ? sessionQueue : entries.map((entry) => entry.word)).map((word, index) => {
              const entry = entryMap.get(word);
              if (!entry) return null;

              const active = tab === 'flashcards'
                ? index === 0
                : index === currentIndex;

              return (
                <div key={entry.word} className={`border-2 theme-border brutal-shadow p-3 ${active ? 'theme-bg-orange theme-text-on-orange' : 'theme-bg-panel theme-text-primary'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (tab === 'flashcards') {
                          focusFlashWord(entry.word);
                        } else {
                          jumpToWord(index);
                        }
                      }}
                      className="text-left flex-1"
                    >
                      <div className="font-brutal-title text-lg md:text-xl break-words">{entry.word}</div>
                      <div className="font-brutal-body text-xs md:text-sm mt-1 opacity-80">
                        {entry.barronZh || entry.shortDefs?.[0] || '2 mnemonics ready'}
                      </div>
                    </button>

                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          DataManager.toggleWordBookmark(entry.word);
                          setWordbookVersion((value) => value + 1);
                        }}
                        className="px-2 py-1 border-2 theme-border theme-bg-card theme-text-primary font-pixel-eng text-xs brutal-btn"
                      >
                        REMOVE
                      </button>
                      <a
                        href={entry.cambridgeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 border-2 theme-border theme-bg-card theme-text-blue font-pixel-eng text-xs no-underline"
                      >
                        CAM
                      </a>
                      <a
                        href={entry.merriamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 border-2 theme-border theme-bg-card theme-text-blue font-pixel-eng text-xs no-underline"
                      >
                        MW
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-8">
        <Link to="/" className="theme-text-muted font-pixel-eng hover:theme-text-primary transition-colors">
          EXIT TO MENU
        </Link>
        <button
          type="button"
          onClick={() => setTab('flashcards')}
          className="theme-bg-orange theme-text-on-orange border-2 theme-border brutal-shadow brutal-btn px-4 py-2 font-brutal-title text-sm uppercase"
        >
          Open Flashcards Mode
        </button>
      </div>
    </div>
  );
}
