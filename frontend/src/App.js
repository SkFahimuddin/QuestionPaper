import React, { useState } from 'react';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [showLogin, setShowLogin] = useState(true);

  function onLogin(token, user) {
    setToken(token);
    setUser(user);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }

  function onLogout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  function toggleAuthMode() {
    setShowLogin(!showLogin);
  }

  if (token && user) {
    return (
      <div className="container">
        <h1>📚 Question Paper App</h1>
        <Dashboard token={token} user={user} onLogout={onLogout} />
      </div>
    );
  }

  return (
    <div className="auth-container">
      <h1>📚 Question Paper App</h1>
      
      <div className="auth-card">
        <div className="auth-tabs">
          <button 
            className={`auth-tab ${showLogin ? 'active' : ''}`}
            onClick={() => setShowLogin(true)}
          >
            Login
          </button>
          <button 
            className={`auth-tab ${!showLogin ? 'active' : ''}`}
            onClick={() => setShowLogin(false)}
          >
            Sign Up
          </button>
        </div>

        <div className="auth-content">
          {showLogin ? (
            <Login onLogin={onLogin} />
          ) : (
            <Signup onSignupSuccess={() => setShowLogin(true)} />
          )}
        </div>

        <div className="auth-footer">
          {showLogin ? (
            <p>
              Don't have an account?{' '}
              <button className="link-btn" onClick={toggleAuthMode}>
                Create one here
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button className="link-btn" onClick={toggleAuthMode}>
                Login here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;