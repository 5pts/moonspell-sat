import {
  BarChart3,
  BookOpenText,
  LogOut,
  Moon,
  NotebookPen,
  Settings2,
  Sun,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

const primaryNav = [
  { to: '/', label: '今日', icon: BookOpenText, end: true },
  { to: '/quiz', label: '练习', icon: NotebookPen },
  { to: '/wordbook', label: '单词本', icon: BookOpenText },
  { to: '/data-board', label: '数据', icon: BarChart3 },
];

export default function AppShell({ currentUser, onLogout, theme, onToggleTheme, children }) {
  const location = useLocation();
  const immersive = location.pathname.startsWith('/quiz');

  return (
    <div className={`app-shell ${immersive ? 'app-shell--immersive' : ''}`}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>

      {!immersive ? (
        <header className="topbar">
          <NavLink to="/" className="wordmark" aria-label="Moonspell 首页">
            MOONSPELL
          </NavLink>
          <nav className="desktop-nav" aria-label="主要导航">
            {primaryNav.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className="nav-link">
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-actions">
            <button
              className="icon-button"
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
            >
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <details className="account-menu">
              <summary aria-label="打开账户菜单">
                <span>{String(currentUser?.username || currentUser?.name || 'M').slice(0, 1).toUpperCase()}</span>
              </summary>
              <div className="account-menu__panel">
                <div className="account-menu__name">{currentUser?.username || currentUser?.name}</div>
                <div className="account-menu__email">{currentUser?.email || '本机档案'}</div>
                <NavLink to="/data-board" className="account-menu__row">
                  <Settings2 size={17} /> 设置
                </NavLink>
                <button type="button" onClick={onLogout} className="account-menu__row">
                  <LogOut size={17} /> 切换档案
                </button>
              </div>
            </details>
          </div>
        </header>
      ) : null}

      <main id="main-content" className="app-main" tabIndex="-1">
        {children}
      </main>

      {!immersive ? (
        <nav className="mobile-nav" aria-label="移动端主要导航">
          {primaryNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="mobile-nav__link">
              <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
