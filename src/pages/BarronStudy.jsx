import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataManager } from '../lib/data';

function speakWord(word) {
  if (!(window?.speechSynthesis) || !word) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

export default function BarronStudy() {
  const [selectedLesson, setSelectedLesson] = useState('all');
  const [search, setSearch] = useState('');
  const [onlySaved, setOnlySaved] = useState(false);
  const [savedVersion, setSavedVersion] = useState(0);

  const lessons = useMemo(() => DataManager.getBarronLessons(), []);
  const allWords = useMemo(() => DataManager.getBarronWords(), []);
  const savedWords = DataManager.getWordBookmarks();
  const savedKey = savedWords.join('|');
  const savedSet = useMemo(() => new Set(savedWords), [savedKey, savedVersion]);

  const lessonProgressMap = useMemo(() => {
    const map = new Map();
    lessons.forEach((lesson) => {
      const savedCount = lesson.words.filter((entry) => savedSet.has(entry.word)).length;
      map.set(lesson.lesson, {
        savedCount,
        totalCount: lesson.words.length,
      });
    });
    return map;
  }, [lessons, savedSet]);

  const filteredWords = useMemo(() => {
    let pool = selectedLesson === 'all'
      ? allWords
      : (lessons.find((lesson) => String(lesson.lesson) === String(selectedLesson))?.words || []);

    if (onlySaved) {
      pool = pool.filter((entry) => savedSet.has(entry.word));
    }

    const needle = search.trim().toLowerCase();
    if (!needle) return pool;

    return pool.filter((entry) =>
      [
        entry.word,
        entry.displayWord,
        entry.partOfSpeech,
        entry.barronZh,
        entry.barronEn,
        entry.theme,
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [selectedLesson, allWords, lessons, onlySaved, search, savedSet]);

  const toggleSaved = (word) => {
    DataManager.toggleWordBookmark(word);
    setSavedVersion((value) => value + 1);
  };

  const playAudio = (url, word) => {
    if (!url) {
      speakWord(word);
      return;
    }

    const audio = new Audio(url);
    audio.play().catch(() => {
      speakWord(word);
    });
  };

  return (
    <div className="w-full max-w-7xl flex flex-col items-center animate-fade-in-up z-10 px-4 pb-20">
      <div className="mt-8 mb-6 text-center w-full">
        <h1 className="font-pixel-title text-2xl md:text-4xl theme-text-green uppercase mb-4 pixel-text-outline leading-tight">
          BARRON LESSONS
        </h1>
        <div className="font-pixel-eng text-lg md:text-xl theme-text-muted">
          37 Lessons · {allWords.length} words · {savedWords.length} saved
        </div>
      </div>

      <div className="w-full grid gap-6 lg:grid-cols-[0.78fr_1.22fr] items-start">
        <aside className="theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg p-4 md:p-5 stripe-bg">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="font-pixel-eng text-xs opacity-70">LESSON MAP</div>
              <h2 className="font-brutal-title text-xl md:text-2xl">Barron 37</h2>
            </div>
            <button
              type="button"
              onClick={() => setOnlySaved((value) => !value)}
              className={`px-3 py-2 border-2 theme-border font-pixel-eng text-xs brutal-btn ${onlySaved ? 'theme-bg-orange theme-text-on-orange' : 'theme-bg-card theme-text-primary'}`}
            >
              {onlySaved ? 'ONLY SAVED' : 'SHOW ALL'}
            </button>
          </div>

          <div className="space-y-3 max-h-[44rem] overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => setSelectedLesson('all')}
              className={`w-full border-2 theme-border p-3 text-left brutal-shadow ${selectedLesson === 'all' ? 'theme-bg-blue theme-text-on-color' : 'theme-bg-panel theme-text-primary'}`}
            >
              <div className="font-brutal-title text-base">All Lessons</div>
              <div className="font-brutal-body text-xs opacity-80">{allWords.length} words total</div>
            </button>

            {lessons.map((lesson) => {
              const progress = lessonProgressMap.get(lesson.lesson) || { savedCount: 0, totalCount: lesson.words.length };
              const percent = progress.totalCount ? Math.round((progress.savedCount / progress.totalCount) * 100) : 0;

              return (
                <button
                  key={`lesson-${lesson.lesson}`}
                  type="button"
                  onClick={() => setSelectedLesson(String(lesson.lesson))}
                  className={`w-full border-2 theme-border p-3 text-left brutal-shadow ${String(selectedLesson) === String(lesson.lesson) ? 'theme-bg-orange theme-text-on-orange' : 'theme-bg-panel theme-text-primary'}`}
                >
                  <div className="font-brutal-title text-base">{lesson.title}</div>
                  <div className="font-brutal-body text-xs opacity-80 mt-1 line-clamp-2">{lesson.theme || 'Theme unavailable'}</div>
                  <div className="w-full h-3 border-2 theme-border theme-bg-card mt-2 overflow-hidden">
                    <div className="h-full theme-bg-green" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="font-pixel-eng text-xs mt-1">{progress.savedCount}/{progress.totalCount} saved</div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg p-4 md:p-6 stripe-bg">
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索单词 / 中文 / 英文释义"
              className="flex-1 min-w-[220px] border-2 md:border-4 theme-border theme-bg-card px-3 py-2 font-brutal-body text-sm md:text-base brutal-shadow"
            />
            <span className="px-3 py-2 border-2 theme-border theme-bg-card font-pixel-eng text-xs">
              {filteredWords.length} RESULT(S)
            </span>
          </div>

          {filteredWords.length === 0 ? (
            <div className="border-2 md:border-4 theme-border theme-bg-panel p-6 brutal-shadow text-center">
              <div className="font-brutal-title text-xl md:text-2xl theme-text-muted">当前筛选下没有词条</div>
              <div className="font-brutal-body text-sm md:text-base theme-text-muted mt-2">清空检索词或切换 Lesson 即可。</div>
            </div>
          ) : (
            <div className="space-y-4 max-h-[44rem] overflow-y-auto pr-1">
              {filteredWords.map((entry) => {
                const isSaved = savedSet.has(entry.word);

                return (
                  <article key={`word-${entry.word}`} className="border-2 md:border-4 theme-border theme-bg-panel brutal-shadow p-4 md:p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="font-brutal-title text-2xl md:text-4xl leading-tight break-words">{entry.displayWord || entry.word}</div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="px-2 py-1 border-2 theme-border theme-bg-card font-pixel-eng text-xs">Lesson {entry.lesson}</span>
                          {entry.partOfSpeech ? <span className="px-2 py-1 border-2 theme-border theme-bg-card font-pixel-eng text-xs">{entry.partOfSpeech}</span> : null}
                          {entry.phonetic ? <span className="px-2 py-1 border-2 theme-border theme-bg-blue-light font-pixel-eng text-xs">{entry.phonetic}</span> : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleSaved(entry.word)}
                        className={`px-3 py-2 border-2 theme-border brutal-shadow brutal-btn font-pixel-eng text-sm ${isSaved ? 'theme-bg-orange theme-text-on-orange' : 'theme-bg-card theme-text-primary'}`}
                      >
                        {isSaved ? '★ SAVED' : '☆ SAVE'}
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 mb-4">
                      <div className="border-2 theme-border theme-bg-card p-3">
                        <div className="font-pixel-eng text-xs opacity-70 mb-1">中文释义</div>
                        <div className="font-brutal-body text-base md:text-lg leading-relaxed">{entry.barronZh || '暂无'}</div>
                      </div>
                      <div className="border-2 theme-border theme-bg-card p-3">
                        <div className="font-pixel-eng text-xs opacity-70 mb-1">English Definition</div>
                        <div className="font-brutal-body text-base md:text-lg leading-relaxed">{entry.barronEn || entry.shortDefs?.[0] || 'N/A'}</div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 mb-4">
                      {(entry.memoryHooks || []).slice(0, 2).map((hook, index) => (
                        <div key={`${entry.word}-hook-${index}`} className="border-2 theme-border theme-bg-card p-3 brutal-shadow">
                          <div className="font-pixel-eng text-xs opacity-70 mb-1">MNEMONIC {index + 1}</div>
                          <div className="font-brutal-title text-sm md:text-base theme-text-blue mb-1">{hook.title}</div>
                          <div className="font-brutal-body text-sm md:text-base leading-relaxed">{hook.text}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => playAudio(entry.audioUkUrl || entry.audioUrl, entry.word)}
                        className="px-3 py-2 border-2 theme-border theme-bg-card theme-text-primary font-pixel-eng text-xs brutal-btn"
                      >
                        PLAY UK
                      </button>
                      <button
                        type="button"
                        onClick={() => playAudio(entry.audioUsUrl || entry.audioUrl, entry.word)}
                        className="px-3 py-2 border-2 theme-border theme-bg-card theme-text-primary font-pixel-eng text-xs brutal-btn"
                      >
                        PLAY US
                      </button>
                      <button
                        type="button"
                        onClick={() => speakWord(entry.word)}
                        className="px-3 py-2 border-2 theme-border theme-bg-card theme-text-primary font-pixel-eng text-xs brutal-btn"
                      >
                        SPEAK
                      </button>
                      <a
                        href={entry.cambridgeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 border-2 theme-border theme-bg-blue-light theme-text-blue font-pixel-eng text-xs no-underline brutal-btn"
                      >
                        CAMBRIDGE
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-3 mt-8">
        <Link to="/" className="theme-text-muted font-pixel-eng hover:theme-text-primary transition-colors">
          EXIT TO MENU
        </Link>
        <Link
          to="/flashcards"
          className="theme-bg-orange theme-text-on-orange border-2 theme-border brutal-shadow brutal-btn px-4 py-2 font-brutal-title text-sm uppercase no-underline"
        >
          OPEN FLASHCARDS
        </Link>
      </div>
    </div>
  );
}
