import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FloatingBackground from '../components/FloatingBackground';
import MoonAscii from '../components/MoonAscii';
import { DataManager } from '../lib/data';

export default function Login({ onLogin, currentUser, onLogout, theme, onToggleTheme }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ username: '', email: '' });
  const [error, setError] = useState('');
  const localProfiles = DataManager.getAllUsers().slice(0, 3);
  const questionCount = DataManager.getAllQuestions().length;

  const openProfile = (email) => {
    const result = DataManager.loginUser({ email });
    if (!result.user) {
      setError('无法打开这个本机档案');
      return;
    }
    onLogin(result.user);
    navigate('/');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    if (mode === 'register') {
      if (!loginForm.username.trim() || !loginForm.email.trim()) {
        setError('请填写所有字段');
        return;
      }
      const result = DataManager.registerUser(loginForm);
      if (result.error === 'email_taken') {
        setError('该邮箱已注册，请直接登录');
        return;
      }
      if (result.error) {
        setError('注册失败，请检查输入');
        return;
      }
      onLogin(result.user);
      navigate('/');
      return;
    }

    if (!loginForm.email.trim()) {
      setError('请输入邮箱');
      return;
    }
    const result = DataManager.loginUser({ email: loginForm.email });
    if (result.error === 'not_found') {
      setError('该邮箱未注册，请先注册');
      return;
    }
    if (result.error) {
      setError('登录失败');
      return;
    }
    onLogin(result.user);
    navigate('/');
  };

  return (
    <main className={`legacy-login-shell moonspell-container ${theme === 'dark' ? 'dark-mode' : ''}`} id="main-content">
      <div className="grain-overlay" aria-hidden="true" />
      <FloatingBackground variant="legacy" />

      <button
        type="button"
        onClick={onToggleTheme}
        className="legacy-theme-toggle fixed top-4 right-4 md:top-6 md:right-6 z-[100] w-12 h-12 md:w-14 md:h-14 flex items-center justify-center border-4 theme-border theme-bg-card theme-text-primary brutal-shadow brutal-btn text-2xl"
        title="Toggle Theme Protocol"
        aria-label="切换明暗主题"
      >
        {theme === 'dark' ? '☼' : '☾'}
      </button>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center z-10 px-4 md:px-8">
        <div className="flex flex-col items-start animate-fade-in-up relative">
          <MoonAscii />
          <h1 className="font-pixel-title text-6xl md:text-[7rem] lg:text-[8rem] theme-text-blue uppercase mb-8 pixel-text-outline leading-none animate-float tracking-tighter">
            Moon<br />spell
          </h1>
          <div className="theme-bg-card border-4 theme-border p-8 brutal-shadow-lg relative stripe-bg w-full max-w-lg">
            <div className="absolute -top-5 -left-4 theme-bg-orange border-4 theme-border px-4 py-1 font-brutal-title text-xl rotate-[-4deg] brutal-shadow z-10 flex items-center gap-2">
              <span>☽</span> SYSTEM_INFO
            </div>
            <div className="legacy-system-grid mt-3">
              <div><span>QUESTIONS</span><strong>{questionCount}</strong></div>
              <div><span>MODE</span><strong>LOCAL</strong></div>
            </div>
            <p className="legacy-system-note font-brutal-body theme-text-primary">
              SAT Sentence Completion<br />数据保存在当前设备。
            </p>
          </div>
        </div>

        <div className="w-full max-w-md mx-auto animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
          <form onSubmit={handleSubmit} className="w-full theme-bg-card border-4 theme-border brutal-shadow-lg p-8 relative stripe-bg">
            <div className="absolute -top-5 -left-4 theme-bg-orange border-4 theme-border px-3 py-1 font-brutal-title text-xl rotate-[3deg] brutal-shadow z-10">
              {mode === 'register' ? 'NEW AGENT' : 'PROFILE CONTROL'}
            </div>

            {currentUser ? (
              <div className="mt-8 mb-6 border-4 theme-border theme-bg-panel brutal-shadow p-4 text-left">
                <div className="font-pixel-eng text-sm theme-text-muted mb-2">CURRENT SESSION</div>
                <div className="font-brutal-title text-lg theme-text-blue">{currentUser.username || currentUser.name}</div>
                <div className="font-brutal-body text-sm theme-text-muted mt-1">{currentUser.email || 'No email on file'}</div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="theme-bg-green theme-text-on-color border-2 theme-border brutal-shadow brutal-btn px-3 py-2 font-brutal-title text-sm uppercase"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLogout?.();
                      setLoginForm({ username: '', email: '' });
                      setError('');
                    }}
                    className="theme-bg-card theme-text-primary border-2 theme-border brutal-shadow brutal-btn px-3 py-2 font-brutal-title text-sm uppercase"
                  >
                    Switch
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-8 mb-6 flex border-4 theme-border brutal-shadow overflow-hidden">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 py-3 font-brutal-title text-base md:text-lg uppercase transition-colors ${mode === 'login' ? 'theme-bg-blue theme-text-on-color' : 'theme-bg-card theme-text-primary'}`}
              >
                LOGIN
              </button>
              <div className="w-1 theme-bg-primary" />
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                className={`flex-1 py-3 font-brutal-title text-base md:text-lg uppercase transition-colors ${mode === 'register' ? 'theme-bg-orange theme-text-on-orange' : 'theme-bg-card theme-text-primary'}`}
              >
                REGISTER
              </button>
            </div>

            {error ? (
              <div className="mb-6 border-4 theme-border-red theme-bg-red theme-text-on-color p-3 font-brutal-body text-sm" role="alert">
                {error}
              </div>
            ) : null}

            {mode === 'login' && !currentUser && localProfiles.length ? (
              <section className="legacy-recent-profiles" aria-labelledby="recent-profiles-title">
                <div id="recent-profiles-title">RECENT AGENTS</div>
                <div>
                  {localProfiles.map((profile) => (
                    <button key={profile.id || profile.email} type="button" onClick={() => openProfile(profile.email)}>
                      <span>{String(profile.username || profile.name || '?').slice(0, 1).toUpperCase()}</span>
                      <strong>{profile.username || profile.name}</strong>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {mode === 'register' ? (
              <div className="mb-6 relative">
                <label htmlFor="legacy-username" className="font-brutal-title text-sm uppercase theme-bg-inverse theme-text-inverse px-2 py-1 absolute -top-3 left-4 border-2 theme-border z-10">Agent ID</label>
                <input id="legacy-username" type="text" required value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} placeholder="Your Name..." className="w-full border-4 theme-border p-4 pt-5 font-brutal-body text-xl brutal-input brutal-shadow" />
              </div>
            ) : null}

            <div className="mb-6 relative">
              <label htmlFor="legacy-email" className="font-brutal-title text-sm uppercase theme-bg-inverse theme-text-inverse px-2 py-1 absolute -top-3 left-4 border-2 theme-border z-10">Email Address</label>
              <input id="legacy-email" type="email" required value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} placeholder="your@email.com" className="w-full border-4 theme-border p-4 pt-5 font-brutal-body text-xl brutal-input brutal-shadow" />
            </div>
            <button type="submit" className={`w-full py-4 font-pixel-eng text-3xl uppercase border-4 theme-border brutal-shadow brutal-btn relative overflow-hidden group ${mode === 'register' ? 'theme-bg-orange' : 'theme-bg-blue'}`}>
              <span className="relative z-10">{mode === 'register' ? 'REGISTER ->' : 'INITIALIZE ->'}</span>
              <span className={`absolute inset-0 ${mode === 'register' ? 'theme-bg-blue' : 'theme-bg-orange'} transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out z-0`} aria-hidden="true" />
            </button>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="font-brutal-body text-sm theme-text-muted hover:theme-text-blue transition-colors underline"
              >
                {mode === 'login' ? '没有账号？点击注册' : '已有账号？点击登录'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <footer className="legacy-login-footer fixed bottom-3 left-1/2 -translate-x-1/2 z-[90] text-center text-[11px] md:text-xs theme-text-muted px-3">
        <div>created by IsoLab</div>
        <div>Any issues, contact linjh0811@gmail.com</div>
      </footer>
    </main>
  );
}
