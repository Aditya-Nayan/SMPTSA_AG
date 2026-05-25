/* ───────────────────────────────────────────────
   PredictionCards — Grid of model prediction cards
   One card per model with price, direction, confidence
   ─────────────────────────────────────────────── */

import React from 'react';
import type { SinglePrediction } from '../types';
import { MODEL_COLORS, MODEL_LABELS } from '../data/mockData';
import { SignalBadge } from './SignalBadge';

interface PredictionCardsProps {
  predictions: SinglePrediction[];
  currentPrice: number;
}

export const PredictionCards: React.FC<PredictionCardsProps> = ({
  predictions,
  currentPrice,
}) => {
  return (
    <div className="prediction-cards" id="prediction-cards">
      {predictions.map((pred) => {
        const diff = pred.predicted_price - currentPrice;
        const pctChange = ((diff / currentPrice) * 100).toFixed(3);
        const color = MODEL_COLORS[pred.model_name] || '#6366f1';
        const label = MODEL_LABELS[pred.model_name] || pred.model_name;

        return (
          <div
            key={pred.model_name}
            className="prediction-card glass-card"
            style={{ '--card-accent': color } as React.CSSProperties}
            id={`prediction-card-${pred.model_name}`}
          >
            <div className="prediction-card__header">
              <span className="prediction-card__name">{label}</span>
              <span
                className="prediction-card__dot"
                style={{ background: color }}
              />
            </div>

            <div className="prediction-card__price">
              ${pred.predicted_price.toFixed(2)}
            </div>

            <div className="prediction-card__change">
              <span className={`prediction-card__diff prediction-card__diff--${pred.direction.toLowerCase()}`}>
                {diff >= 0 ? '+' : ''}{diff.toFixed(2)} ({diff >= 0 ? '+' : ''}{pctChange}%)
              </span>
            </div>

            <div className="prediction-card__signal">
              <SignalBadge
                direction={pred.direction}
                confidence={pred.confidence}
                size="sm"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
