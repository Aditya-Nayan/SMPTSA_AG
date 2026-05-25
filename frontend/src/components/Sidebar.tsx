/* ───────────────────────────────────────────────
   Sidebar — Navigation with icon + label
   ─────────────────────────────────────────────── */

import React from 'react';
import type { NavPage } from '../types';

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
}

const NAV_ITEMS: { page: NavPage; label: string }[] = [
  { page: 'dashboard', label: 'DASHBOARD' },
  { page: 'models', label: 'MODELS' },
  { page: 'sentiment', label: 'SENTIMENT' },
];

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  return (
    <nav className="sidebar" id="sidebar">
      <ul className="sidebar__nav">
        {NAV_ITEMS.map(({ page, label }) => (
          <li key={page}>
            <button
              id={`nav-${page}`}
              className={`sidebar__item ${activePage === page ? 'sidebar__item--active' : ''}`}
              onClick={() => onNavigate(page)}
            >
              <span className="sidebar__label">{label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar__footer">
        <div className="sidebar__ticker-block">
          <img
            src="/xauusd-logo.jpg"
            alt="XAUUSD"
            className="sidebar__ticker-img"
          />
          <div className="sidebar__ticker-text">
            <span className="sidebar__ticker-symbol">
              <span className="sidebar__ticker-xau">XAU</span>
              <span className="sidebar__ticker-usd">USD</span>
            </span>
            <span className="sidebar__ticker-label">GOLD / US DOLLAR</span>
          </div>
        </div>
      </div>
    </nav>
  );
};
