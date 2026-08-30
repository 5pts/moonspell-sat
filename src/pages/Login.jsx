import { ArrowRight, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataManager } from '../lib/data';

export default function Login({ onLogin, currentUser, onLogout }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '' });
  const [error, setError] = useState('');

  const continueWith = (user) => {
    onLogin(user);
    navigate('/');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    const email = form.email.trim().toLowerCase();
    const name = form.name.trim();

    if (!email) {
      setError('请输入用于区分学习档案的邮箱。');
      return;
    }

    const existing = DataManager.findUserByEmail(email);
    if (existing) {
      const result = DataManager.loginUser({ email });
      if (result.user) continueWith(result.user);
      else setError('无法打开这个本机档案。');
      return;
    }

    if (!name) {
      setError('这是一个新档案，请填写你的称呼。');
      return;
    }

    const result = DataManager.registerUser({ username: name, email });
    if (result.user) continueWith(result.user);
    else setError('无法创建学习档案，请检查输入。');
  };

  return (
    <main className="login-page" id="main-content">
      <div className="login-bauhaus" aria-hidden="true">
        <span className="login-bauhaus__circle" />
        <span className="login-bauhaus__square" />
        <span className="login-bauhaus__line" />
      </div>

      <section className="login-story" aria-labelledby="login-title">
        <a className="wordmark wordmark--large" href="./">MOONSPELL</a>
        <div className="login-poster">
          <span className="login-poster__index">00</span>
          <h1 id="login-title">SAT<br />VOCAB</h1>
          <div className="login-poster__shapes" aria-hidden="true"><i /><i /><i /></div>
        </div>
      </section>

      <section className="profile-panel" aria-labelledby="profile-title">
        {currentUser ? (
          <div className="current-profile">
            <span className="profile-icon"><UserRound size={24} /></span>
            <p>当前档案</p>
            <h2 id="profile-title">{currentUser.username || currentUser.name}</h2>
            <span>{currentUser.email}</span>
            <button type="button" className="primary-action" onClick={() => continueWith(currentUser)}>
              进入 <ArrowRight size={20} />
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                onLogout?.();
                setError('');
              }}
            >
              使用其他档案
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <span className="profile-icon"><UserRound size={24} /></span>
            <p className="panel-kicker">PROFILE</p>
            <h2 id="profile-title">学习档案</h2>
            <div className="form-field">
              <label htmlFor="profile-name">称呼</label>
              <input
                id="profile-name"
                autoComplete="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="新档案时填写"
              />
              <small>已有档案可以留空。</small>
            </div>
            <div className="form-field">
              <label htmlFor="profile-email">邮箱</label>
              <input
                id="profile-email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="name@example.com"
                aria-describedby={error ? 'profile-error' : 'profile-local-note'}
              />
              <small id="profile-local-note">仅用于区分本机档案。</small>
            </div>
            {error ? <p className="form-error" id="profile-error" role="alert">{error}</p> : null}
            <button type="submit" className="primary-action">
              进入 <ArrowRight size={20} />
            </button>
          </form>
        )}

        <p className="local-data-note">数据保存在本机。</p>
      </section>
    </main>
  );
}
