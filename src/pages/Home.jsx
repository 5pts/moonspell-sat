import { ArrowRight, Clock3 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DataManager } from '../lib/data';

function formatDueLabel(dueAt) {
  if (!dueAt || new Date(dueAt).getTime() <= Date.now()) return '现在';
  const hours = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 3600000);
  return hours < 24 ? `${hours} 小时后` : `${Math.ceil(hours / 24)} 天后`;
}

export default function Home({ timeAttack, setTimeAttack }) {
  const navigate = useNavigate();
  const dashboard = DataManager.getDashboardData();
  const learning = DataManager.getLearningSummary();
  const { counts } = learning;
  const queue = learning.dueQueue.slice(0, 5);
  const answered = dashboard.overview.uniqueAnswered;
  const total = dashboard.overview.totalQuestions;
  const progress = total ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="today-page page-enter">
      <header className="bauhaus-page-head">
        <div className="bauhaus-page-head__index">01</div>
        <div>
          <h1>今日</h1>
          <span>{answered} / {total} 已完成</span>
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={() => navigate(counts.due ? '/quiz?review=due' : '/quiz')}
        >
          {counts.due ? `复习 ${counts.due} 题` : '开始做题'}
          <ArrowRight size={20} />
        </button>
      </header>

      <section className="bauhaus-status-grid" aria-label="题目状态">
        <div className="status-block status-block--blue"><span>待复习</span><strong>{counts.due}</strong></div>
        <div className="status-block status-block--yellow"><span>学习中</span><strong>{counts.learning}</strong></div>
        <div className="status-block status-block--red"><span>错题</span><strong>{dashboard.overview.mistakes}</strong></div>
        <div className="status-block status-block--plain"><span>新题</span><strong>{counts.new}</strong></div>
      </section>

      <div className="home-work-grid">
        <section className="due-panel" aria-labelledby="due-title">
          <div className="section-heading-row">
            <h2 id="due-title">复习队列</h2>
            {queue.length ? <Link to="/quiz?review=due">全部</Link> : null}
          </div>
          {queue.length ? (
            <ol className="due-list">
              {queue.map((item, index) => (
                <li key={item.itemId || item.questionId}>
                  <span className="due-list__index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="due-list__word">
                    <strong>{item.word || item.questionId}</strong>
                    <span>{item.translation || item.questionId}</span>
                  </div>
                  <em>{formatDueLabel(item.dueAt)}</em>
                </li>
              ))}
            </ol>
          ) : <div className="empty-inline"><strong>暂无到期项目</strong></div>}
        </section>

        <nav className="home-directory" aria-label="学习入口">
          <Link to="/quiz"><span>02</span><strong>题库</strong><em>{total} 题</em></Link>
          <Link to="/barron"><span>03</span><strong>Barron</strong><em>399 词</em></Link>
          <Link to="/wordbook"><span>04</span><strong>单词本</strong><em>{dashboard.overview.wordBookmarks} 词</em></Link>
          <Link to="/data-board"><span>05</span><strong>数据</strong><em>{progress}%</em></Link>
        </nav>
      </div>

      <section className="timing-setting" aria-label="计时设置">
        <div><Clock3 size={21} /><h2>每题 75 秒</h2></div>
        <label className="switch-control">
          <input type="checkbox" checked={timeAttack} onChange={(event) => setTimeAttack(event.target.checked)} />
          <span aria-hidden="true" />
          <span className="sr-only">启用计时</span>
        </label>
        <span>{timeAttack ? '已开启' : '未开启'}</span>
      </section>
    </div>
  );
}
