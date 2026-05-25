/* ───────────────────────────────────────────────
   SMPTSA — TypeScript Interfaces
   Matches API Gateway + FastAPI response schemas
   ─────────────────────────────────────────────── */

// ── Prediction API ──

export interface SinglePrediction {
  model_name: string;
  predicted_price: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
}

export interface PredictResponse {
  ticker: string;
  timestamp: string;
  current_close: number;
  sentiment_score: number;
  predictions: SinglePrediction[];
}

export interface PredictRequest {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vader_score: number;
  finbert_score: number;
  rsi?: number;
  macd?: number;
  macd_signal?: number;
  macd_hist?: number;
  bb_lower?: number;
  bb_mid?: number;
  bb_upper?: number;
  bb_bandwidth?: number;
}

// ── Backtest API ──

export interface BacktestMetrics {
  model_name: string;
  description: string;
  mae: number;
  rmse: number;
  r2: number;
  directional_accuracy: number;
  n_features: number;
}

export interface BacktestResponse {
  ticker: string;
  models: BacktestMetrics[];
}

// ── Sentiment API ──

export interface SentimentDataPoint {
  date: string;
  source: string;
  vader_score: number;
  finbert_score: number;
  doc_count: number;
}

export interface SentimentHistoryResponse {
  days: number;
  count: number;
  data: SentimentDataPoint[];
}

// ── WebSocket ──

export interface WebSocketPayload {
  ticker: string;
  timestamp: string;
  prediction: PredictResponse;
}

// ── Auth ──

export interface AuthResponse {
  access_token?: string;
  token?: string;
  token_type?: string;
  username: string;
  expires_in?: number;
  expiresIn?: number;
}

// ── Chart Data ──

export interface PriceDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sentiment: number;
  predictions?: Record<string, number>;
}

export type TimeRange = '1W' | '1M' | '3M' | '6M' | 'ALL';
export type NavPage = 'dashboard' | 'models' | 'sentiment';
