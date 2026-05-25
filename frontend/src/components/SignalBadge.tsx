/* ───────────────────────────────────────────────
   SignalBadge — Directional signal indicator
   Shows UP ▲ / DOWN ▼ / NEUTRAL ◆ with pulse
   ─────────────────────────────────────────────── */

import React from 'react';

interface SignalBadgeProps {
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  modelName?: string;
  size?: 'sm' | 'md' | 'lg';
}

const DIRECTION_CONFIG = {
  UP: { symbol: '▲', label: 'Bullish', className: 'signal--up' },
  DOWN: { symbol: '▼', label: 'Bearish', className: 'signal--down' },
  NEUTRAL: { symbol: '◆', label: 'Neutral', className: 'signal--neutral' },
};

export const SignalBadge: React.FC<SignalBadgeProps> = ({
  direction,
  confidence,
  modelName,
  size = 'md',
}) => {
  const config = DIRECTION_CONFIG[direction];
  const circumference = 2 * Math.PI * 18;
  const progress = (confidence / 100) * circumference;

  return (
    <div className={`signal-badge signal-badge--${size} ${config.className}`}>
      {/* Confidence ring */}
      <div className="signal-badge__ring">
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle
            cx="24" cy="24" r="18"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
          />
          <circle
            cx="24" cy="24" r="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${progress} ${circumference}`}
            strokeDashoffset="0"
            strokeLinecap="round"
            transform="rotate(-90 24 24)"
            className="signal-badge__progress"
          />
        </svg>
        <span className="signal-badge__symbol">{config.symbol}</span>
      </div>

      <div className="signal-badge__info">
        <span className="signal-badge__label">{config.label}</span>
        <span className="signal-badge__confidence">{confidence.toFixed(1)}%</span>
        {modelName && (
          <span className="signal-badge__model">{modelName}</span>
        )}
      </div>
    </div>
  );
};
