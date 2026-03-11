import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import FloatingBackground from './components/FloatingBackground';
import Login from './pages/Login';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import Dashboard from './pages/Dashboard';
import Flashcards from './pages/Flashcards';
import { DataManager } from './lib/data';
import './styles/app.css';

import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const [currentUser, setCurrentUser] = useState(() => DataManager.getCurrentUser());
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [timeAttack, setTimeAttack] = useState(false);

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    DataManager.logoutUser();
    setCurrentUser(null);
  };

  return (
    <BrowserRouter>
      <ErrorBoundary>
      <div className={`min-h-screen flex flex-col items-center justify-center relative moonspell-container theme-bg-body theme-text-primary overflow-x-hidden ${isDarkMode ? 'dark-mode' : ''}`}>
        <div className="grain-overlay"></div>
        <FloatingBackground />

        {/* Theme Toggle */}
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="fixed top-4 right-4 md:top-6 md:right-6 z-[100] w-12 h-12 md:w-14 md:h-14 flex items-center justify-center border-4 theme-border theme-bg-card theme-text-primary brutal-shadow brutal-btn text-2xl"
          title="Toggle Theme Protocol"
        >
          {isDarkMode ? '☼' : '☾'}
        </button>

        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} currentUser={currentUser} onLogout={handleLogout} />} />
          <Route
            path="/"
            element={currentUser ? (
              <Home
                username={currentUser.username || currentUser.name}
                currentUser={currentUser}
                onLogout={handleLogout}
                setTimeAttack={setTimeAttack}
                timeAttack={timeAttack}
              />
            ) : <Navigate to="/login" />}
          />
          <Route path="/quiz" element={currentUser ? <Quiz mode="LOCAL" timeAttack={timeAttack} /> : <Navigate to="/login" />} />
          <Route path="/quiz-error" element={currentUser ? <Quiz mode="ERROR" timeAttack={timeAttack} /> : <Navigate to="/login" />} />
          <Route path="/wordbook" element={currentUser ? <Flashcards defaultTab="wordbook" /> : <Navigate to="/login" />} />
          <Route path="/flashcards" element={currentUser ? <Flashcards defaultTab="flashcards" /> : <Navigate to="/login" />} />
          <Route path="/data-board" element={currentUser ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/dashboard" element={currentUser ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
