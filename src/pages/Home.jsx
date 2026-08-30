import { ArrowRight, Clock3 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import MoonAscii from '../components/MoonAscii';
import { DataManager } from '../lib/data';

export default function Home({ currentUser, timeAttack, setTimeAttack }) {
  const navigate = useNavigate();
  const dashboard = DataManager.getDashboardData();
  const learning = DataManager.getLearningSummary();
  const { counts } = learning;
  const answered = dashboard.overview.uniqueAnswered;
  const total = dashboard.overview.totalQuestions;
  const accuracy = dashboard.overview.accuracy;
  const primaryRoute = counts.due ? '/quiz?review=due' : '/quiz';
  const primaryLabel = counts.due ? `REVIEW ${counts.due}` : 'START PRACTICE';
  const username = currentUser?.username || currentUser?.name || 'PLAYER';

  return (
    <div className="launch-page page-enter">
      <section className="launch-hero" aria-labelledby="launch-title">
        <div className="launch-hero__copy">
          <p className="launch-player">01 / {String(username).toUpperCase()}</p>
          <h1 id="launch-title">MOONSPELL</h1>
          <p className="launch-subtitle">SAT SENTENCE COMPLETION</p>
          <button type="button" className="launch-primary" onClick={() => navigate(primaryRoute)}>
            <span>{primaryLabel}</span>
            <ArrowRight size={28} strokeWidth={2.4} />
          </button>
        </div>

        <div className="launch-moon" aria-hidden="true">
          <MoonAscii />
          <span className="launch-orbit launch-orbit--one" />
          <span className="launch-orbit launch-orbit--two" />
          <span className="launch-spark">✦</span>
        </div>
      </section>

      <section className="launch-stats" aria-label="学习数据">
        <div><span>DONE</span><strong>{answered}<small> / {total}</small></strong></div>
        <div><span>ACCURACY</span><strong>{accuracy}<small>%</small></strong></div>
        <div><span>ERRORS</span><strong>{dashboard.overview.mistakes}</strong></div>
        <div><span>WORDS</span><strong>{dashboard.overview.wordBookmarks}</strong></div>
      </section>

      <nav className="launch-menu" aria-label="学习入口">
        <Link className="launch-menu__practice" to="/quiz"><span>02</span><strong>START PRACTICE</strong><ArrowRight size={22} /></Link>
        <Link className="launch-menu__errors" to="/quiz-error"><span>03</span><strong>ERROR REVIEW</strong><em>{dashboard.overview.mistakes}</em></Link>
        <Link className="launch-menu__words" to="/wordbook"><span>04</span><strong>WORDBOOK</strong><em>{dashboard.overview.wordBookmarks}</em></Link>
        <Link className="launch-menu__barron" to="/barron"><span>05</span><strong>BARRON 399</strong><ArrowRight size={22} /></Link>
        <Link className="launch-menu__data" to="/data-board"><span>06</span><strong>DATA BOARD</strong><ArrowRight size={22} /></Link>
      </nav>

      <section className="launch-timer" aria-label="计时设置">
        <div><Clock3 size={20} /><strong>75 SEC TIMER</strong></div>
        <label className="switch-control">
          <input type="checkbox" checked={timeAttack} onChange={(event) => setTimeAttack(event.target.checked)} />
          <span aria-hidden="true" />
          <span className="sr-only">启用计时</span>
        </label>
        <span>{timeAttack ? 'ON' : 'OFF'}</span>
      </section>
    </div>
  );
}
