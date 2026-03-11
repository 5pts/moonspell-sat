import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataManager } from '../lib/data';

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

  const entries = DataManager.getWordbookEntries();
  const summary = DataManager.getWordbookSummary();
  const currentEntry = entries[currentIndex] || null;
  const currentWord = currentEntry?.word || '';

  useEffect(() => {
    if (currentIndex >= entries.length && entries.length > 0) {
      setCurrentIndex(entries.length - 1);
    }
    if (!entries.length) {
      setCurrentIndex(0);
    }
  }, [entries.length, currentIndex, wordbookVersion]);

  useEffect(() => {
    let active = true;

    if (!currentWord) {
      setLookup(null);
      setLookupStatus('idle');
      return undefined;
    }

    const cached = DataManager.getCachedWordLookup(currentWord);
    if (cached) {
      setLookup(cached);
      setLookupStatus('ready');
    } else {
      setLookup(null);
      setLookupStatus('loading');
    }

    DataManager.fetchWordLookup(currentWord).then((result) => {
      if (!active) return;
      setLookup(result);
      setLookupStatus(result ? 'ready' : 'empty');
    });

    return () => {
      active = false;
    };
  }, [currentWord]);

  const handleNext = () => {
    if (!entries.length) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % entries.length);
    }, 150);
  };

  const handlePrev = () => {
    if (!entries.length) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + entries.length) % entries.length);
    }, 150);
  };

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

  if (!entries.length) {
    return (
      <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in-up z-10 px-4 mt-20">
        <div className="theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg p-6 md:p-12 text-center w-full relative stripe-bg">
          <h2 className="font-pixel-title text-xl md:text-3xl theme-text-blue mb-6">NO WORDBOOK</h2>
          <p className="font-brutal-body text-lg md:text-xl mb-8">Save words during practice. Every saved word goes into your Wordbook first, then into Flashcards.</p>
          <Link to="/" className="block text-center w-full py-3 md:py-4 theme-bg-blue theme-text-on-color font-pixel-eng text-xl md:text-2xl uppercase border-2 md:border-4 theme-border brutal-shadow brutal-btn">
            RETURN TO BASE
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl flex flex-col items-center animate-fade-in-up z-10 px-4 pb-20">
      <div className="mt-8 mb-6 text-center w-full relative">
        <h1 className="font-pixel-title text-2xl md:text-4xl theme-text-orange uppercase mb-4 pixel-text-outline leading-tight">WORDBOOK</h1>
        <div className="font-pixel-eng text-lg md:text-xl theme-text-muted">{currentIndex + 1} / {entries.length}</div>
      </div>

      <div className="w-full grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Saved Words" value={summary.totalWords} tone="theme-text-orange" note="收藏就自动进入生词本" />
        <SummaryCard label="Mnemonic Ready" value={summary.withHooks} tone="theme-text-blue" note="每个词至少两条巧记法" />
        <SummaryCard label="Lookup Ready" value={summary.withLookup} tone="theme-text-green" note="已带词典义 / 音标 / 发音" />
        <SummaryCard label="Suggested Deck" value={summary.suggestedDeckSize} tone="theme-text-red" note="建议每轮 flashcards 数量" />
      </div>

      <div className="w-full flex flex-wrap gap-3 mb-6">
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
              <div className="w-full h-80 md:h-96 relative perspective-1000 cursor-pointer group" onClick={() => setIsFlipped((prev) => !prev)}>
                <div className={`relative w-full h-full transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''}`} style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                  <div className="absolute inset-0 backface-hidden theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg flex flex-col items-center justify-center p-6 md:p-8 stripe-bg">
                    <div className="absolute top-4 left-4 font-pixel-eng text-xs md:text-sm opacity-50">FRONT</div>
                    <div className="absolute top-4 right-4 font-pixel-eng text-xs md:text-sm opacity-70 theme-text-blue">
                      {lookup?.phonetic || 'Flip for review'}
                    </div>
                    <h2 className="font-brutal-title text-4xl md:text-7xl theme-text-primary mb-4 break-words text-center">{currentWord}</h2>
                    <div className="font-brutal-body text-lg md:text-xl theme-text-blue">Tap to review the wordbook notes</div>
                  </div>

                  <div className="absolute inset-0 backface-hidden theme-bg-inverse theme-text-inverse border-2 md:border-4 theme-border brutal-shadow-lg p-6 md:p-8" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}>
                    <div className="font-pixel-eng text-xs md:text-sm opacity-50 mb-3">BACK</div>
                    <div className="space-y-4 overflow-y-auto max-h-full pr-1">
                      <div>
                        <div className="font-pixel-eng text-xs md:text-sm opacity-70 mb-1">DEFINITION</div>
                        {lookup?.shortDefs?.length ? (
                          <div className="font-brutal-body text-base md:text-lg leading-relaxed">{lookup.shortDefs[0]}</div>
                        ) : (
                          <div className="font-brutal-body text-base md:text-lg theme-text-muted">Definition not available yet.</div>
                        )}
                      </div>

                      {currentEntry.memoryHooks.map((hook, index) => (
                        <div key={`${currentWord}-flash-hook-${index}`}>
                          <div className="font-pixel-eng text-xs md:text-sm opacity-70 mb-1">MNEMONIC {index + 1}</div>
                          <div className="font-brutal-body text-sm md:text-base leading-relaxed">{hook.text}</div>
                        </div>
                      ))}

                      {currentEntry.derivatives?.length ? (
                        <div>
                          <div className="font-pixel-eng text-xs md:text-sm opacity-70 mb-1">WORD FAMILY</div>
                          <div className="font-brutal-body text-sm md:text-base leading-relaxed">{currentEntry.derivatives.slice(0, 6).join(', ')}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 md:gap-6 mt-6 md:mt-10 w-full max-w-md">
                <button onClick={handlePrev} className="flex-1 py-3 md:py-4 theme-bg-panel theme-text-primary font-pixel-eng text-lg md:text-2xl uppercase border-2 md:border-4 theme-border brutal-shadow brutal-btn">
                  {'<'} PREV
                </button>
                <button onClick={handleNext} className="flex-1 py-3 md:py-4 theme-bg-blue theme-text-on-color font-pixel-eng text-lg md:text-2xl uppercase border-2 md:border-4 theme-border brutal-shadow brutal-btn">
                  NEXT {'>'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg p-4 md:p-5 stripe-bg">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="font-pixel-eng text-xs opacity-70">WORD LIST</div>
              <h2 className="font-brutal-title text-xl md:text-2xl">Saved Vocabulary</h2>
            </div>
            <div className="font-pixel-eng text-sm theme-text-muted">{entries.length} saved</div>
          </div>

          <div className="space-y-3 max-h-[42rem] overflow-y-auto pr-1">
            {entries.map((entry, index) => {
              const active = index === currentIndex;

              return (
                <div key={entry.word} className={`border-2 theme-border brutal-shadow p-3 ${active ? 'theme-bg-orange theme-text-on-orange' : 'theme-bg-panel theme-text-primary'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => jumpToWord(index)}
                      className="text-left flex-1"
                    >
                      <div className="font-brutal-title text-lg md:text-xl break-words">{entry.word}</div>
                      <div className="font-brutal-body text-xs md:text-sm mt-1 opacity-80">
                        2 mnemonics ready
                      </div>
                    </button>

                    <div className="flex flex-col gap-2 shrink-0">
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
