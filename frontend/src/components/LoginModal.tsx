/* ───────────────────────────────────────────────
   LoginModal — Sign In / Sign Up with toggle
   Glassmorphism overlay
   ─────────────────────────────────────────────── */

import React, { useState } from 'react';
import { login, register } from '../hooks/useApi';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  const switchMode = (newMode: 'signin' | 'signup') => {
    resetForm();
    setMode(newMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (mode === 'signup') {
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
      onLoginSuccess();
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-card" onClick={(e) => e.stopPropagation()} id="login-modal">
        <button className="modal__close" onClick={onClose}>✕</button>

        <h2 className="modal__title">
          {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="modal__subtitle">
          {mode === 'signin'
            ? 'Sign in to access the SMPTSA dashboard'
            : 'Sign up to get started with SMPTSA'}
        </p>

        {/* Toggle tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'signin' ? 'auth-tab--active' : ''}`}
            onClick={() => switchMode('signin')}
            id="tab-signin"
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'auth-tab--active' : ''}`}
            onClick={() => switchMode('signup')}
            id="tab-signup"
          >
            Sign Up
          </button>
        </div>

        <form className="modal__form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="auth-username" className="form-label">Username</label>
            <input
              id="auth-username"
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={mode === 'signin' ? 'Enter username' : 'Choose a username'}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password" className="form-label">Password</label>
            <input
              id="auth-password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signin' ? 'Enter password' : 'Create a password (min 6 chars)'}
              required
            />
          </div>

          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="auth-confirm-password" className="form-label">Confirm Password</label>
              <input
                id="auth-confirm-password"
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
              />
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
            id="auth-submit"
          >
            {loading
              ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
              : (mode === 'signin' ? 'Sign In' : 'Sign Up')
            }
          </button>
        </form>

        <p className="auth-footer">
          {mode === 'signin' ? (
            <>Don't have an account?{' '}
              <button type="button" className="auth-link" onClick={() => switchMode('signup')}>
                Sign Up
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button type="button" className="auth-link" onClick={() => switchMode('signin')}>
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};
