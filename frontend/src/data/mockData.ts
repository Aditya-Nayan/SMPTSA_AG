/* ───────────────────────────────────────────────
   SMPTSA — Mock Data for Development
   Realistic XAUUSD data in the $2,300–2,450 range
   ─────────────────────────────────────────────── */

import type {
  PriceDataPoint,
  BacktestMetrics,
  SinglePrediction,
  SentimentDataPoint,
} from '../types';

// ── Helper: generate dates going back N days ──
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── 60-day price history ──
const BASE_PRICE = 2340;

function generatePriceHistory(days: number): PriceDataPoint[] {
  const data: PriceDataPoint[] = [];
  let price = BASE_PRICE;

  for (let i = days; i >= 0; i--) {
    const change = (Math.random() - 0.48) * 18; // slight upward bias
    price = Math.max(2250, Math.min(2500, price + change));
    const high = price + Math.random() * 12;
    const low = price - Math.random() * 12;
    const open = price + (Math.random() - 0.5) * 8;
    const sentiment = (Math.random() - 0.5) * 0.6;

    data.push({
      date: daysAgo(i),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(price * 100) / 100,
      volume: Math.round(80000 + Math.random() * 40000),
      sentiment: Math.round(sentiment * 10000) / 10000,
      predictions: {
        linear_regression: Math.round((price + (Math.random() - 0.45) * 15) * 100) / 100,
        multivariate_regression: Math.round((price + (Math.random() - 0.45) * 12) * 100) / 100,
        random_forest: Math.round((price + (Math.random() - 0.46) * 10) * 100) / 100,
        extra_trees: Math.round((price + (Math.random() - 0.46) * 11) * 100) / 100,
        sentiment_only: Math.round((price + (Math.random() - 0.5) * 30) * 100) / 100,
      },
    });
  }
  return data;
}

export const mockPriceHistory: PriceDataPoint[] = generatePriceHistory(60);

// ── Latest prediction ──
const latestPrice = mockPriceHistory[mockPriceHistory.length - 1];

export const mockPredictions: SinglePrediction[] = [
  {
    model_name: 'linear_regression',
    predicted_price: latestPrice.close + 5.32,
    direction: 'UP',
    confidence: 67.4,
  },
  {
    model_name: 'multivariate_regression',
    predicted_price: latestPrice.close + 3.18,
    direction: 'UP',
    confidence: 58.2,
  },
  {
    model_name: 'random_forest',
    predicted_price: latestPrice.close + 8.91,
    direction: 'UP',
    confidence: 74.6,
  },
  {
    model_name: 'extra_trees',
    predicted_price: latestPrice.close + 6.44,
    direction: 'UP',
    confidence: 71.3,
  },
  {
    model_name: 'sentiment_only',
    predicted_price: latestPrice.close - 2.15,
    direction: 'DOWN',
    confidence: 32.8,
  },
];

// ── Backtest metrics ──
export const mockBacktestMetrics: BacktestMetrics[] = [
  {
    model_name: 'linear_regression',
    description: 'Baseline Linear Regression (OHLCV + sentiment)',
    mae: 8.4321,
    rmse: 12.1045,
    r2: 0.9842,
    directional_accuracy: 0.5714,
    n_features: 16,
  },
  {
    model_name: 'multivariate_regression',
    description: 'Multivariate Ridge Regression (all features)',
    mae: 7.8912,
    rmse: 11.4523,
    r2: 0.9867,
    directional_accuracy: 0.5918,
    n_features: 16,
  },
  {
    model_name: 'random_forest',
    description: 'Random Forest Regressor (150 trees)',
    mae: 5.2134,
    rmse: 8.3412,
    r2: 0.9921,
    directional_accuracy: 0.6327,
    n_features: 16,
  },
  {
    model_name: 'extra_trees',
    description: 'Extra Trees Regressor (150 trees)',
    mae: 4.8765,
    rmse: 7.9234,
    r2: 0.9934,
    directional_accuracy: 0.6531,
    n_features: 16,
  },
  {
    model_name: 'sentiment_only',
    description: 'Sentiment-Only Linear Regression (research experiment)',
    mae: 24.5612,
    rmse: 31.2345,
    r2: 0.8812,
    directional_accuracy: 0.5102,
    n_features: 3,
  },
];

// ── Sentiment history (30 days, 3 sources) ──
export function generateSentimentHistory(days: number): SentimentDataPoint[] {
  const sources = ['twitter', 'reddit', 'news'];
  const data: SentimentDataPoint[] = [];

  for (let i = days; i >= 0; i--) {
    for (const source of sources) {
      data.push({
        date: daysAgo(i),
        source,
        vader_score: Math.round((Math.random() - 0.45) * 1000) / 1000,
        finbert_score: Math.round((Math.random() - 0.42) * 1000) / 1000,
        doc_count: Math.round(20 + Math.random() * 80),
      });
    }
  }
  return data;
}

export const mockSentimentHistory: SentimentDataPoint[] = generateSentimentHistory(30);

// ── Model color map ──
export const MODEL_COLORS: Record<string, string> = {
  linear_regression: '#ef4444',
  multivariate_regression: '#f59e0b',
  random_forest: '#22c55e',
  extra_trees: '#6366f1',
  sentiment_only: '#8b5cf6',
};

export const MODEL_LABELS: Record<string, string> = {
  linear_regression: 'Linear Regression',
  multivariate_regression: 'Multivariate Ridge',
  random_forest: 'Random Forest',
  extra_trees: 'Extra Trees',
  sentiment_only: 'Sentiment Only',
};
