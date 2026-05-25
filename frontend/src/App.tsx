/* ───────────────────────────────────────────────
   App — Main application shell
   Sidebar + Header + Content area
   ─────────────────────────────────────────────── */

import React, { useState } from 'react';
import type { NavPage } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import { isAuthenticated, clearToken } from './hooks/useApi';
import {
  mockPriceHistory,
  mockPredictions,
  mockBacktestMetrics,
  mockSentimentHistory,
} from './data/mockData';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PredictionCards } from './components/PredictionCards';
import { LiveChart } from './components/LiveChart';
import { ModelComparisonPanel } from './components/ModelComparisonPanel';
import { SentimentTimeline } from './components/SentimentTimeline';
import { LoginModal } from './components/LoginModal';

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [showLogin, setShowLogin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(isAuthenticated());

  const { data: wsData, isConnected } = useWebSocket();

  // Use live data if available, otherwise mock
  const predictions = wsData?.prediction?.predictions || mockPredictions;
  const currentPrice = wsData?.prediction?.current_close || mockPriceHistory[mockPriceHistory.length - 1].close;
  const lastUpdate = wsData?.timestamp || null;

  const handleLogout = () => {
    clearToken();
    setLoggedIn(false);
  };

  return (
    <div className="app" id="app-root">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div className="app__main">
        <Header
          isConnected={isConnected}
          lastUpdate={lastUpdate}
          isLoggedIn={loggedIn}
          onLoginClick={() => setShowLogin(true)}
          onLogoutClick={handleLogout}
        />

        <main className="app__content">
          {activePage === 'dashboard' && (
            <div className="dashboard-view fade-in" id="dashboard-view">
              {/* Price summary bar */}
              <div className="price-summary glass-card">
                <div className="price-summary__main">
                  <span className="price-summary__label">XAUUSD</span>
                  <span className="price-summary__price">${currentPrice.toFixed(2)}</span>
                  <span className="price-summary__tag">Gold / US Dollar</span>
                </div>
                <div className="price-summary__signal">
                  {predictions.length > 0 && (() => {
                    const upCount = predictions.filter(p => p.direction === 'UP').length;
                    const downCount = predictions.filter(p => p.direction === 'DOWN').length;
                    const consensus = upCount > downCount ? 'UP' : downCount > upCount ? 'DOWN' : 'NEUTRAL';
                    const avgConfidence = predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length;
                    return (
                      <div className={`consensus consensus--${consensus.toLowerCase()}`}>
                        <span className="consensus__arrow">
                          {consensus === 'UP' ? '▲' : consensus === 'DOWN' ? '▼' : '◆'}
                        </span>
                        <div>
                          <span className="consensus__label">Consensus: {consensus}</span>
                          <span className="consensus__detail">
                            {upCount} bullish · {downCount} bearish · {avgConfidence.toFixed(0)}% avg conf
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Prediction cards */}
              <PredictionCards predictions={predictions} currentPrice={currentPrice} />

              {/* Main chart */}
              <LiveChart data={mockPriceHistory} />

              {/* Model comparison teaser */}
              <div className="glass-card section-teaser" onClick={() => setActivePage('models')}>
                <span className="section-teaser__icon">🤖</span>
                <div>
                  <h3 className="section-teaser__title">Model Performance</h3>
                  <p className="section-teaser__text">Compare MAE, RMSE, R², and directional accuracy across all 5 models →</p>
                </div>
              </div>
            </div>
          )}

          {activePage === 'models' && (
            <div className="models-view fade-in" id="models-view">
              <ModelComparisonPanel metrics={mockBacktestMetrics} />
            </div>
          )}

          {activePage === 'sentiment' && (
            <div className="sentiment-view fade-in" id="sentiment-view">
              <SentimentTimeline data={mockSentimentHistory} />

              {/* Source stats */}
              <div className="source-stats">
                {['twitter', 'reddit', 'news'].map((source) => {
                  const sourceData = mockSentimentHistory.filter((d) => d.source === source);
                  const avgVader = sourceData.reduce((s, d) => s + d.vader_score, 0) / sourceData.length;
                  const avgFinbert = sourceData.reduce((s, d) => s + d.finbert_score, 0) / sourceData.length;
                  const totalDocs = sourceData.reduce((s, d) => s + d.doc_count, 0);

                  const sourceColors: Record<string, string> = {
                    twitter: '#1da1f2', reddit: '#ff4500', news: '#22c55e',
                  };
                  const sourceLabels: Record<string, string> = {
                    twitter: 'Twitter / X', reddit: 'Reddit', news: 'News',
                  };

                  return (
                    <div key={source} className="glass-card source-stat-card" style={{ '--card-accent': sourceColors[source] } as React.CSSProperties}>
                      <h3 className="source-stat-card__title">{sourceLabels[source]}</h3>
                      <div className="source-stat-card__metrics">
                        <div>
                          <span className="source-stat-card__label">VADER</span>
                          <span className={`source-stat-card__value ${avgVader >= 0 ? 'text-up' : 'text-down'}`}>
                            {avgVader >= 0 ? '+' : ''}{avgVader.toFixed(3)}
                          </span>
                        </div>
                        <div>
                          <span className="source-stat-card__label">FinBERT</span>
                          <span className={`source-stat-card__value ${avgFinbert >= 0 ? 'text-up' : 'text-down'}`}>
                            {avgFinbert >= 0 ? '+' : ''}{avgFinbert.toFixed(3)}
                          </span>
                        </div>
                        <div>
                          <span className="source-stat-card__label">Documents</span>
                          <span className="source-stat-card__value">{totalDocs.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLoginSuccess={() => setLoggedIn(true)}
      />
    </div>
  );
};
