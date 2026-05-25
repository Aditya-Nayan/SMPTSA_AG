/* ───────────────────────────────────────────────
   Header — Top bar with logo, status, and auth
   ─────────────────────────────────────────────── */

import React from 'react';

interface HeaderProps {
  isConnected: boolean;
  lastUpdate: string | null;
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  lastUpdate,
  isLoggedIn,
  onLoginClick,
  onLogoutClick,
}) => {
  return (
    <header className="header" id="header">
      <div className="header__brand">
        <div className="header__logo">
          <img
            src="/smptsa-logo.jpg"
            alt="SMPTSA Logo"
            className="header__logo-img"
          />
        </div>
        <div>
          <h1 className="header__title">SMPTSA</h1>
          <span className="header__subtitle">Gold Prediction Engine</span>
        </div>
      </div>

      <div className="header__info">
        <div className="header__status">
          <span className={`status-dot ${isConnected ? 'status-dot--live' : 'status-dot--offline'}`} />
          <span className="header__status-text">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        {lastUpdate && (
          <span className="header__update-time">
            Updated: {new Date(lastUpdate).toLocaleTimeString()}
          </span>
        )}

        <button
          id="auth-button"
          className="btn btn--ghost"
          onClick={isLoggedIn ? onLogoutClick : onLoginClick}
        >
          {isLoggedIn ? 'Logout' : 'Login'}
        </button>
      </div>
    </header>
  );
};
