import {
  ArrowRight,
  BarChart3,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Target,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataManager } from '../lib/data';

function percent(value, fallback = '—') {
  return value === null || value === undefined ? fallback : `${value}%`;
}

function formatRelative(value) {
  if (!value) return '尚未练习';
  const diff = Date.now() - new Date(value).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days} 天前`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours} 小时前`;
  return '刚刚';
}

export default function Dashboard() {
  const dashboard = DataManager.getDashboardData();
  const learning = DataManager.getLearningSummary();

  return (
    <div className="insights-page page-enter">
      <header className="page-title-row">
        <div>
          <p className="page-kicker">05 / DATA</p>
          <h1>数据</h1>
        </div>
        <div className="page-title-actions">
          <Link to="/quiz?review=due" className="primary-action">复习到期内容 <ArrowRight size={18} /></Link>
          <Link to="/quiz" className="secondary-action">继续练习</Link>
        </div>
      </header>

      <section className="evidence-strip" aria-label="关键学习指标">
        <div>
          <Target size={22} />
          <span>隔日正确率</span>
          <strong>{percent(learning.delayedRetention)}</strong>
          <small>跨天复习</small>
        </div>
        <div>
          <CheckCircle2 size={22} />
          <span>总正确率</span>
          <strong>{percent(dashboard.overview.accuracy)}</strong>
          <small>{dashboard.overview.correctCount} 次正确</small>
        </div>
        <div>
          <CalendarClock size={22} />
          <span>当前到期</span>
          <strong>{learning.counts.due}</strong>
          <small>约 {learning.estimatedMinutes} 分钟</small>
        </div>
        <div>
          <BarChart3 size={22} />
          <span>累计作答</span>
          <strong>{dashboard.overview.totalAttempts}</strong>
          <small>{dashboard.overview.uniqueAnswered} 道不同题目</small>
        </div>
      </section>

      <div className="insights-grid">
        <section className="mastery-panel">
          <div className="section-heading-row">
            <div><p className="page-kicker">STATUS</p><h2>记忆状态</h2></div>
            <span>{learning.counts.new + learning.counts.learning + learning.counts.due + learning.counts.stable} 个学习项目</span>
          </div>
          <div className="mastery-bars">
            {[
              ['新内容', learning.counts.new, 'new'],
              ['学习中', learning.counts.learning, 'learning'],
              ['已到期', learning.counts.due, 'due'],
              ['已稳定', learning.counts.stable, 'stable'],
            ].map(([label, value, status]) => {
              const total = Math.max(1, learning.counts.new + learning.counts.learning + learning.counts.due + learning.counts.stable);
              return (
                <div key={status}>
                  <span>{label}<b>{value}</b></span>
                  <div><i className={`is-${status}`} style={{ width: `${Math.max(value ? 2 : 0, (value / total) * 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="calibration-panel practice-summary-panel">
          <div className="section-heading-row">
            <div><p className="page-kicker">PRACTICE</p><h2>练习概况</h2></div>
          </div>
          <dl className="practice-summary">
            <div><dt>累计作答</dt><dd>{dashboard.overview.totalAttempts}</dd></div>
            <div><dt>已做题目</dt><dd>{dashboard.overview.uniqueAnswered}</dd></div>
            <div><dt>当前错题</dt><dd>{dashboard.overview.mistakes}</dd></div>
            <div><dt>今日作答</dt><dd>{dashboard.overview.todayAttempts}</dd></div>
          </dl>
        </section>
      </div>

      <section className="section-performance">
        <div className="section-heading-row">
          <div><p className="page-kicker">SECTIONS</p><h2>题组表现</h2></div>
          <span>按全部历史记录计算</span>
        </div>
        <div className="section-performance__table">
          <div className="section-performance__head"><span>题组</span><span>已作答</span><span>正确率</span><span>待修复</span><span>进度</span></div>
          {dashboard.sectionStats.map((section) => (
            <div key={section.code} className="section-performance__row">
              <span><strong>{section.code}</strong><small>{section.displayName}</small></span>
              <span>{section.attempts}</span>
              <span>{section.attempts ? `${section.accuracy}%` : '—'}</span>
              <span>{section.mistakeCount}</span>
              <span className="row-progress"><i style={{ width: `${section.accuracy}%` }} /></span>
            </div>
          ))}
        </div>
      </section>

      <div className="insights-grid insights-grid--lower">
        <section className="focus-panel">
          <div className="section-heading-row">
            <div><p className="page-kicker">WRONG</p><h2>错题</h2></div>
            <CircleAlert size={21} />
          </div>
          {dashboard.focusQueue.length ? (
            <div className="focus-list">
              {dashboard.focusQueue.slice(0, 6).map((item, index) => (
                <Link key={item.id} to={`/quiz-error?question=${item.id}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{item.question.answerText || item.id}</strong><small>{item.id} · 错 {item.wrong} 次 · {formatRelative(item.lastSeen)}</small></div>
                  <ArrowRight size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-inline"><Target size={27} /><div><strong>暂无错题</strong></div></div>
          )}
        </section>

        <section className="saved-panel">
          <div className="section-heading-row">
            <div><p className="page-kicker">SAVED</p><h2>收藏</h2></div>
            <Bookmark size={21} />
          </div>
          <dl>
            <div><dt>收藏题目</dt><dd>{dashboard.overview.bookmarks}</dd></div>
            <div><dt>收藏选项</dt><dd>{dashboard.overview.optionBookmarks}</dd></div>
            <div><dt>生词本</dt><dd>{dashboard.overview.wordBookmarks}</dd></div>
          </dl>
          <div className="saved-panel__links">
            <Link to="/wordbook">查看单词本 <ArrowRight size={16} /></Link>
            <Link to="/quiz-error">进入错题修复 <ArrowRight size={16} /></Link>
          </div>
        </section>
      </div>

    </div>
  );
}
