import React from 'react';
import { Link } from 'react-router-dom';
import { DataManager } from '../lib/data';

function formatTime(value) {
  if (!value) return 'No record yet';
  try {
    return new Date(value).toLocaleString();
  } catch (_error) {
    return value;
  }
}

function StatCard({ label, value, tone = 'theme-text-primary', note }) {
  return (
    <div className="border-2 md:border-4 theme-border p-4 md:p-6 theme-bg-panel brutal-shadow">
      <div className="font-pixel-eng text-sm md:text-lg opacity-70 mb-2 theme-text-primary">{label}</div>
      <div className={`font-brutal-title text-3xl md:text-5xl ${tone}`}>{value}</div>
      {note ? <div className="mt-2 font-brutal-body text-sm theme-text-muted">{note}</div> : null}
    </div>
  );
}

export default function Dashboard() {
  const dashboard = DataManager.getDashboardData();
  const { overview, sectionStats, focusQueue, bookmarkedQuestions, savedOptions, recentActivity } = dashboard;

  return (
    <div className="w-full max-w-6xl flex flex-col items-center animate-fade-in-up z-10 px-4 pb-16">
      <div className="theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg p-4 md:p-8 w-full stripe-bg mt-6 md:mt-10">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
          <div>
            <h2 className="font-pixel-title text-2xl md:text-4xl theme-text-blue uppercase pixel-text-outline leading-tight">
              Mission Report
            </h2>
            <p className="font-brutal-body text-sm md:text-base theme-text-muted mt-3 max-w-2xl">
              这个页面现在直接读取本地答题历史、错题、收藏题和单词数据，不再只是 demo。你可以从这里继续练题、跳到具体错题，或者打开完整数据看板。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/quiz"
              className="theme-bg-green theme-text-on-color border-2 md:border-4 theme-border brutal-shadow brutal-btn px-4 py-3 font-brutal-title text-sm md:text-base uppercase no-underline"
            >
              Continue Practice
            </Link>
            <Link
              to="/wordbook"
              className="theme-bg-orange theme-text-on-orange border-2 md:border-4 theme-border brutal-shadow brutal-btn px-4 py-3 font-brutal-title text-sm md:text-base uppercase no-underline"
            >
              Wordbook
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 mb-8">
          <StatCard label="Accuracy" value={`${overview.accuracy}%`} tone="theme-text-green" note={`${overview.correctCount || 0} correct attempts`} />
          <StatCard label="Total Attempts" value={overview.totalAttempts} tone="theme-text-blue" note={`${overview.todayAttempts} attempts today`} />
          <StatCard label="Current / Best Streak" value={`${overview.currentStreak} / ${overview.bestStreak}`} tone="theme-text-orange" note="实时根据本地答题历史计算" />
          <StatCard label="Mistakes / Words / Options" value={`${overview.mistakes} / ${overview.wordBookmarks} / ${overview.optionBookmarks}`} tone="theme-text-red" note={`${overview.bookmarks} bookmarked questions`} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.95fr] gap-6 mb-8">
          <section className="border-2 md:border-4 theme-border p-4 md:p-6 theme-bg-panel brutal-shadow">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-brutal-title text-xl md:text-2xl">Section Performance</h3>
              <span className="font-pixel-eng text-sm theme-text-muted">accuracy by section</span>
            </div>
            <div className="grid gap-4">
              {sectionStats.map((section) => (
                <div key={section.code} className="border-2 theme-border bg-white/80 p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                    <div>
                      <div className="font-brutal-title text-lg">{section.code}</div>
                      <div className="font-brutal-body text-sm theme-text-muted">{section.displayName}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 font-pixel-eng text-sm">
                      <span className="px-2 py-1 border-2 theme-border">{section.attempts} attempts</span>
                      <span className="px-2 py-1 border-2 theme-border">{section.mistakeCount} mistakes</span>
                      <span className="px-2 py-1 border-2 theme-border">{section.bookmarkCount} saved</span>
                      <span className="px-2 py-1 border-2 theme-border">{section.optionBookmarkCount} option saves</span>
                    </div>
                  </div>
                  <div className="w-full h-5 border-2 theme-border theme-bg-card overflow-hidden">
                    <div
                      className="h-full theme-bg-blue transition-all duration-500"
                      style={{ width: `${Math.max(section.accuracy, section.attempts ? 4 : 0)}%` }}
                    />
                  </div>
                  <div className="mt-2 font-brutal-body text-sm theme-text-primary">
                    Accuracy: <strong>{section.attempts ? `${section.accuracy}%` : 'No attempts yet'}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border-2 md:border-4 theme-border p-4 md:p-6 theme-bg-panel brutal-shadow">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-brutal-title text-xl md:text-2xl">Focus Queue</h3>
              <span className="font-pixel-eng text-sm theme-text-muted">priority mistake review</span>
            </div>

            {focusQueue.length === 0 ? (
              <div className="font-brutal-body theme-text-muted">No active mistakes yet. Start a practice round first.</div>
            ) : (
              <div className="grid gap-3">
                {focusQueue.map((item) => (
                  <div key={item.id} className="border-2 theme-border bg-white/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-brutal-title text-lg">{item.id}</div>
                        <div className="font-brutal-body text-sm theme-text-muted">{item.question.localId} · {item.question.sectionCode}</div>
                      </div>
                      <Link
                        to={`/quiz-error?question=${item.id}`}
                        className="button theme-bg-red theme-text-on-color border-2 theme-border brutal-shadow px-3 py-2 font-brutal-title text-xs uppercase no-underline"
                      >
                        Review
                      </Link>
                    </div>
                    <p className="font-brutal-body text-sm mt-3 leading-relaxed">
                      {item.question.sentence.slice(0, 140)}
                      {item.question.sentence.length > 140 ? '...' : ''}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3 font-pixel-eng text-sm">
                      <span className="px-2 py-1 border-2 theme-border">{item.wrong} wrong</span>
                      <span className="px-2 py-1 border-2 theme-border">{item.correct} correct</span>
                      <span className="px-2 py-1 border-2 theme-border">last {formatTime(item.lastSeen)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <section className="border-2 md:border-4 theme-border p-4 md:p-6 theme-bg-panel brutal-shadow">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-brutal-title text-xl md:text-2xl">Recent Activity</h3>
              <span className="font-pixel-eng text-sm theme-text-muted">last 10 attempts</span>
            </div>
            {recentActivity.length === 0 ? (
              <div className="font-brutal-body theme-text-muted">No activity yet.</div>
            ) : (
              <div className="grid gap-3">
                {recentActivity.map((item) => (
                  <Link
                    key={item.id}
                    to={`/quiz?question=${item.questionId}`}
                    className="border-2 theme-border bg-white/80 p-4 no-underline brutal-btn"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-brutal-title text-base md:text-lg">{item.questionId}</div>
                        <div className="font-brutal-body text-sm theme-text-muted">{item.question.localId} · {item.question.sectionCode}</div>
                      </div>
                      <span className={`px-2 py-1 border-2 theme-border font-pixel-eng text-sm ${item.correct ? 'theme-bg-green theme-text-on-color' : 'theme-bg-red theme-text-on-color'}`}>
                        {item.correct ? 'CORRECT' : 'WRONG'}
                      </span>
                    </div>
                    <div className="font-brutal-body text-sm mt-3 leading-relaxed">
                      {item.question.sentence.slice(0, 160)}
                      {item.question.sentence.length > 160 ? '...' : ''}
                    </div>
                    <div className="font-pixel-eng text-xs theme-text-muted mt-3">{formatTime(item.at)}</div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="border-2 md:border-4 theme-border p-4 md:p-6 theme-bg-panel brutal-shadow">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-brutal-title text-xl md:text-2xl">Saved Question Queue</h3>
              <span className="font-pixel-eng text-sm theme-text-muted">bookmark jump links</span>
            </div>
            {bookmarkedQuestions.length === 0 ? (
              <div className="font-brutal-body theme-text-muted">No bookmarked questions yet.</div>
            ) : (
              <div className="grid gap-3">
                {bookmarkedQuestions.map((question) => (
                  <Link
                    key={question.id}
                    to={`/quiz?question=${question.id}`}
                    className="border-2 theme-border bg-white/80 p-4 no-underline brutal-btn"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-brutal-title text-base md:text-lg">{question.id}</div>
                      <span className="px-2 py-1 border-2 theme-border font-pixel-eng text-sm">{question.sectionCode}</span>
                    </div>
                    <div className="font-brutal-body text-sm theme-text-muted mt-2">{question.localId}</div>
                    <div className="font-brutal-body text-sm mt-3 leading-relaxed">
                      {question.sentence.slice(0, 160)}
                      {question.sentence.length > 160 ? '...' : ''}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="border-2 md:border-4 theme-border p-4 md:p-6 theme-bg-panel brutal-shadow mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-brutal-title text-xl md:text-2xl">Saved Options</h3>
            <span className="font-pixel-eng text-sm theme-text-muted">option-level bookmarks</span>
          </div>
          {savedOptions.length === 0 ? (
            <div className="font-brutal-body theme-text-muted">No saved options yet.</div>
          ) : (
            <div className="grid gap-3">
              {savedOptions.map((item) => (
                <Link
                  key={item.id}
                  to={`/quiz?question=${item.questionId}`}
                  className="border-2 theme-border bg-white/80 p-4 no-underline brutal-btn"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-brutal-title text-base md:text-lg">
                        {item.questionId} · {item.option.label}. {item.option.text}
                      </div>
                      <div className="font-brutal-body text-sm theme-text-muted mt-1">{item.option.translation}</div>
                    </div>
                    <span className="px-2 py-1 border-2 theme-border font-pixel-eng text-sm">{item.question.sectionCode}</span>
                  </div>
                  <div className="font-brutal-body text-sm mt-3 leading-relaxed">
                    {item.question.sentence.slice(0, 160)}
                    {item.question.sentence.length > 160 ? '...' : ''}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/"
            className="theme-bg-card theme-text-primary border-2 md:border-4 theme-border brutal-shadow brutal-btn px-4 py-3 font-brutal-title text-sm md:text-base uppercase no-underline"
          >
            Return Home
          </Link>
          <Link
            to="/quiz-error"
            className="theme-bg-red theme-text-on-color border-2 md:border-4 theme-border brutal-shadow brutal-btn px-4 py-3 font-brutal-title text-sm md:text-base uppercase no-underline"
          >
            Review Wrong Book
          </Link>
        </div>
      </div>
    </div>
  );
}
