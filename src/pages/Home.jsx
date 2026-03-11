import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DataManager } from '../lib/data';

export default function Home({ username, currentUser, onLogout, setTimeAttack, timeAttack }) {
  const navigate = useNavigate();
  const mistakes = DataManager.getMistakes();
  const dashboard = DataManager.getDashboardData();

  return (
    <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in-up z-10 px-4">
      <div className="theme-bg-card border-2 md:border-4 theme-border brutal-shadow-lg p-6 md:p-12 w-full relative stripe-bg text-center">
        <div className="absolute -top-5 -left-4 theme-bg-blue border-2 md:border-4 theme-border px-4 py-1 font-brutal-title text-lg md:text-xl rotate-[-2deg] brutal-shadow z-10 theme-text-on-color">
          ☾ AGENT TERMINAL
        </div>

        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="absolute top-4 right-4 theme-bg-card theme-text-primary border-2 theme-border brutal-shadow brutal-btn px-3 py-2 font-brutal-title text-xs md:text-sm uppercase"
          >
            Log Out
          </button>
        ) : null}
        
        <h2 className="font-pixel-title text-xl md:text-4xl theme-text-primary mb-6 md:mb-8 tracking-widest leading-tight">
          WELCOME, <br/><span className="theme-text-blue">{username.toUpperCase()}</span>
        </h2>
        {currentUser?.email ? (
          <div className="font-brutal-body text-sm md:text-base theme-text-muted -mt-2 mb-6">
            Tracking account: {currentUser.email}
          </div>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 md:mb-8 text-left">
          <div className="theme-bg-panel border-2 md:border-4 theme-border p-3 brutal-shadow">
            <div className="font-pixel-eng text-sm md:text-base opacity-70">ATTEMPTS</div>
            <div className="font-brutal-title text-2xl md:text-3xl theme-text-blue">{dashboard.overview.totalAttempts}</div>
          </div>
          <div className="theme-bg-panel border-2 md:border-4 theme-border p-3 brutal-shadow">
            <div className="font-pixel-eng text-sm md:text-base opacity-70">ACCURACY</div>
            <div className="font-brutal-title text-2xl md:text-3xl theme-text-green">{dashboard.overview.accuracy}%</div>
          </div>
          <div className="theme-bg-panel border-2 md:border-4 theme-border p-3 brutal-shadow">
            <div className="font-pixel-eng text-sm md:text-base opacity-70">MISTAKES</div>
            <div className="font-brutal-title text-2xl md:text-3xl theme-text-red">{mistakes.length}</div>
          </div>
          <div className="theme-bg-panel border-2 md:border-4 theme-border p-3 brutal-shadow">
            <div className="font-pixel-eng text-sm md:text-base opacity-70">WORDS / OPTS</div>
            <div className="font-brutal-title text-2xl md:text-3xl theme-text-orange">{dashboard.overview.wordBookmarks} / {dashboard.overview.optionBookmarks}</div>
          </div>
        </div>
        
        <div className="flex flex-col space-y-4 md:space-y-6 w-full text-left">
          <button onClick={() => navigate('/quiz')} className="w-full py-3 md:py-5 px-4 md:px-6 theme-bg-green theme-text-on-color border-2 md:border-4 theme-border brutal-shadow brutal-btn flex flex-col items-start">
            <span className="font-brutal-title text-lg md:text-2xl uppercase">START PRACTICE -{'>'}</span>
            <span className="font-brutal-body text-sm md:text-base opacity-80 mt-1">从本地题库开始 SAT 句子填空练习</span>
          </button>

          <button
            onClick={() => navigate('/quiz-error')}
            disabled={mistakes.length === 0}
            className={`w-full py-3 md:py-5 px-4 md:px-6 border-2 md:border-4 theme-border brutal-shadow brutal-btn transition-colors flex flex-col items-start ${mistakes.length > 0 ? 'theme-bg-red theme-text-on-color' : 'theme-bg-panel theme-text-muted opacity-60'}`}
          >
            <span className="font-brutal-title text-lg md:text-2xl uppercase">ERROR REVIEW ({mistakes.length}) -{'>'}</span>
            <span className="font-brutal-body text-sm md:text-base opacity-80 mt-1">{mistakes.length > 0 ? '重新练习你答错过的题目' : '还没有错题，先去做题吧'}</span>
          </button>

          <button onClick={() => navigate('/wordbook')} className="w-full py-3 md:py-5 px-4 md:px-6 theme-bg-orange theme-text-on-orange border-2 md:border-4 theme-border brutal-shadow brutal-btn flex flex-col items-start">
            <span className="font-brutal-title text-lg md:text-2xl uppercase">WORDBOOK ({DataManager.getWordBookmarks().length}) -{'>'}</span>
            <span className="font-brutal-body text-sm md:text-base opacity-80 mt-1">查看收藏生词，规划复习，并从里面进入 flashcards</span>
          </button>

          <button onClick={() => navigate('/data-board')} className="w-full py-3 md:py-5 px-4 md:px-6 theme-bg-card theme-text-primary border-2 md:border-4 theme-border brutal-shadow brutal-btn flex flex-col items-start">
            <span className="font-brutal-title text-lg md:text-2xl uppercase">DATA BOARD -{'>'}</span>
            <span className="font-brutal-body text-sm md:text-base opacity-60 mt-1">查看正确率、分组表现、错题优先队列、收藏题和收藏选项</span>
          </button>

        </div>

        <div className="mt-6 md:mt-10 border-t-2 md:border-t-4 theme-border pt-6 md:pt-8 text-left">
          <label className="flex items-center space-x-4 cursor-pointer group">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={timeAttack} onChange={(e) => setTimeAttack(e.target.checked)} />
              <div className={`w-14 h-8 border-4 theme-border transition-colors ${timeAttack ? 'theme-bg-orange' : 'bg-gray-300'}`}></div>
              <div className={`absolute top-0 w-8 h-8 border-4 theme-border bg-white transition-transform ${timeAttack ? 'translate-x-6' : 'translate-x-0'}`} style={{marginTop: '-4px', marginLeft: '-4px', width: '38px', height: '38px'}}></div>
            </div>
            <div className="flex flex-col">
              <span className="font-brutal-title text-xl theme-text-primary group-hover:theme-text-orange transition-colors">TIME ATTACK MODE (15S)</span>
              <span className="font-brutal-body text-sm theme-text-muted mt-1">开启后每题限时 15 秒作答</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
