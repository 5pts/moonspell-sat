import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import BarronStudy from './pages/BarronStudy';
import Dashboard from './pages/Dashboard';
import Flashcards from './pages/Flashcards';
import Home from './pages/Home';
import Login from './pages/Login';
import Quiz from './pages/Quiz';
import { DataManager } from './lib/data';
import './styles/app.css';

function ProtectedLayout({ currentUser, onLogout, theme, onToggleTheme }) {
  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <AppShell
      currentUser={currentUser}
      onLogout={onLogout}
      theme={theme}
      onToggleTheme={onToggleTheme}
    >
      <Outlet />
    </AppShell>
  );
}

function AppRoutes() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() => DataManager.getCurrentUser());
  const [theme, setTheme] = useState(() => DataManager.getPreference('theme', 'light'));
  const [timeAttack, setTimeAttack] = useState(() => DataManager.getPreference('examTiming', false));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = 'zh-CN';
  }, [theme]);

  useEffect(() => {
    document.title = location.pathname.startsWith('/quiz')
      ? '练习 | Moonspell'
      : 'Moonspell | SAT 词汇';
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.pathname]);

  const handleLogin = (user) => setCurrentUser(user);
  const handleLogout = () => {
    DataManager.logoutUser();
    setCurrentUser(null);
  };
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    DataManager.setPreference('theme', nextTheme);
  };
  const updateExamTiming = (enabled) => {
    setTimeAttack(enabled);
    DataManager.setPreference('examTiming', enabled);
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={(
          <Login
            onLogin={handleLogin}
            currentUser={currentUser}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}
      />

      <Route
        element={(
          <ProtectedLayout
            currentUser={currentUser}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}
      >
        <Route
          index
          element={(
            <Home
              currentUser={currentUser}
              timeAttack={timeAttack}
              setTimeAttack={updateExamTiming}
            />
          )}
        />
        <Route path="quiz" element={<Quiz mode="LOCAL" timeAttack={timeAttack} />} />
        <Route path="quiz-error" element={<Quiz mode="ERROR" timeAttack={false} />} />
        <Route path="wordbook" element={<Flashcards defaultTab="wordbook" />} />
        <Route path="flashcards" element={<Flashcards defaultTab="flashcards" />} />
        <Route path="barron" element={<BarronStudy />} />
        <Route path="data-board" element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
      </Route>

      <Route path="*" element={<Navigate to={currentUser ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
