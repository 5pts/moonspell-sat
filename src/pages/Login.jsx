import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MoonAscii from '../components/MoonAscii';
import { DataManager } from '../lib/data';

export default function Login({ onLogin, currentUser, onLogout }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loginForm, setLoginForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (!loginForm.username.trim() || !loginForm.email.trim() || !loginForm.password.trim()) {
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
    } else {
      if (!loginForm.email.trim() || !loginForm.password.trim()) {
        setError('请输入邮箱和密码');
        return;
      }
      const result = DataManager.loginUser({ email: loginForm.email, password: loginForm.password });
      if (result.error === 'not_found') {
        setError('该邮箱未注册，请先注册');
        return;
      }
      if (result.error === 'wrong_password') {
        setError('密码错误');
        return;
      }
      if (result.error) {
        setError('登录失败');
        return;
      }
      onLogin(result.user);
      navigate('/');
    }
  };

  return (
    <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center z-10 px-4 md:px-8">
      <div className="flex flex-col items-start animate-fade-in-up relative">
        <MoonAscii />
        <h1 className="font-pixel-title text-6xl md:text-[7rem] lg:text-[8rem] theme-text-blue uppercase mb-8 pixel-text-outline leading-none animate-float tracking-tighter">
          Moon<br/>spell
        </h1>
        <div className="theme-bg-card border-4 theme-border p-8 brutal-shadow-lg relative stripe-bg w-full max-w-lg">
          <div className="absolute -top-5 -left-4 theme-bg-orange border-4 theme-border px-4 py-1 font-brutal-title text-xl rotate-[-4deg] brutal-shadow z-10 flex items-center gap-2">
            <span>☽</span> SYSTEM_INFO
          </div>
          <p className="font-brutal-body text-xl md:text-2xl font-bold leading-relaxed mt-3 theme-text-primary">
            The ultimate <span className="theme-bg-blue-light px-2 py-0.5 border-2 theme-border inline-block transform -rotate-1 brutal-shadow">SAT Sentence Completion</span> training protocol.
            <br/><br/>
            Enter the brutalist arena, summon the AI Tutor, and break the test.
          </p>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}>
        <form onSubmit={handleSubmit} className="w-full theme-bg-card border-4 theme-border brutal-shadow-lg p-8 relative stripe-bg">
          <div className="absolute -top-5 -left-4 theme-bg-orange border-4 theme-border px-3 py-1 font-brutal-title text-xl rotate-[3deg] brutal-shadow z-10">
            {mode === 'register' ? 'NEW AGENT' : 'SECURE LOGIN'}
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
                    setLoginForm({ username: '', email: '', password: '' });
                    setError('');
                  }}
                  className="theme-bg-card theme-text-primary border-2 theme-border brutal-shadow brutal-btn px-3 py-2 font-brutal-title text-sm uppercase"
                >
                  Switch
                </button>
              </div>
            </div>
          ) : null}

          {/* Mode Toggle */}
          <div className="mt-8 mb-6 flex border-4 theme-border brutal-shadow overflow-hidden">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-3 font-brutal-title text-base md:text-lg uppercase transition-colors ${mode === 'login' ? 'theme-bg-blue theme-text-on-color' : 'theme-bg-card theme-text-primary'}`}
            >
              LOGIN
            </button>
            <div className="w-1 theme-bg-primary"></div>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-3 font-brutal-title text-base md:text-lg uppercase transition-colors ${mode === 'register' ? 'theme-bg-orange theme-text-on-orange' : 'theme-bg-card theme-text-primary'}`}
            >
              REGISTER
            </button>
          </div>

          {error ? (
            <div className="mb-6 border-4 theme-border-red theme-bg-red theme-text-on-color p-3 font-brutal-body text-sm">
              {error}
            </div>
          ) : null}

          {mode === 'register' ? (
            <div className="mb-6 relative">
              <label className="font-brutal-title text-sm uppercase theme-bg-inverse theme-text-inverse px-2 py-1 absolute -top-3 left-4 border-2 theme-border z-10">Agent ID</label>
              <input type="text" required value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} placeholder="Your Name..." className="w-full border-4 theme-border p-4 pt-5 font-brutal-body text-xl brutal-input brutal-shadow" />
            </div>
          ) : null}

          <div className="mb-6 relative">
            <label className="font-brutal-title text-sm uppercase theme-bg-inverse theme-text-inverse px-2 py-1 absolute -top-3 left-4 border-2 theme-border z-10">Email Address</label>
            <input type="email" required value={loginForm.email} onChange={(e) => setLoginForm({...loginForm, email: e.target.value})} placeholder="your@email.com" className="w-full border-4 theme-border p-4 pt-5 font-brutal-body text-xl brutal-input brutal-shadow" />
          </div>
          <div className="mb-8 relative">
            <label className="font-brutal-title text-sm uppercase theme-bg-inverse theme-text-inverse px-2 py-1 absolute -top-3 left-4 border-2 theme-border z-10">Passcode</label>
            <input type="password" required value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} placeholder="••••••••" className="w-full border-4 theme-border p-4 pt-5 font-brutal-body text-xl brutal-input brutal-shadow" />
          </div>

          <button type="submit" className={`w-full py-4 font-pixel-eng text-3xl uppercase border-4 theme-border brutal-shadow brutal-btn relative overflow-hidden group ${mode === 'register' ? 'theme-bg-orange' : 'theme-bg-blue'}`}>
            <span className="relative z-10">{mode === 'register' ? 'REGISTER ->' : 'INITIALIZE ->'}</span>
            <div className={`absolute inset-0 ${mode === 'register' ? 'theme-bg-blue' : 'theme-bg-orange'} transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out z-0`}></div>
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
  );
}
