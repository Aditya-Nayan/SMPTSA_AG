-- ============================================================
-- SMPTSA  —  Database Schema
-- PostgreSQL 15 + TimescaleDB
-- ============================================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ──────────────────────────────────────────────
-- 1. OHLCV price data  (TimescaleDB hypertable)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ohlcv_data (
    time        TIMESTAMPTZ  NOT NULL,
    ticker      VARCHAR(20)  NOT NULL DEFAULT 'XAUUSD',
    open        DOUBLE PRECISION,
    high        DOUBLE PRECISION,
    low         DOUBLE PRECISION,
    close       DOUBLE PRECISION,
    volume      DOUBLE PRECISION,
    source      VARCHAR(50)  DEFAULT 'yahoo_finance',
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Convert to hypertable partitioned by time
SELECT create_hypertable('ohlcv_data', 'time', if_not_exists => TRUE);

-- Index for fast ticker + time lookups
CREATE INDEX IF NOT EXISTS idx_ohlcv_ticker_time
    ON ohlcv_data (ticker, time DESC);

-- ──────────────────────────────────────────────
-- 2. Raw social / news text data
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_social_data (
    id           BIGSERIAL    PRIMARY KEY,
    date         TIMESTAMPTZ  NOT NULL,
    source       VARCHAR(50)  NOT NULL,          -- 'twitter', 'reddit', 'news'
    content      TEXT         NOT NULL,
    author       VARCHAR(255),
    url          TEXT,
    metadata     JSONB,                           -- flexible extra fields
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_date
    ON raw_social_data (date DESC);
CREATE INDEX IF NOT EXISTS idx_social_source
    ON raw_social_data (source);

-- ──────────────────────────────────────────────
-- 3. Aggregated daily sentiment scores
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sentiment_scores (
    id             BIGSERIAL    PRIMARY KEY,
    date           DATE         NOT NULL,
    source         VARCHAR(50)  NOT NULL,         -- 'twitter', 'reddit', 'news', 'all'
    vader_score    DOUBLE PRECISION,
    finbert_score  DOUBLE PRECISION,
    doc_count      INTEGER      DEFAULT 0,
    created_at     TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (date, source)
);

CREATE INDEX IF NOT EXISTS idx_sentiment_date
    ON sentiment_scores (date DESC);

-- ──────────────────────────────────────────────
-- 4. Model predictions (for backtest history)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions (
    id              BIGSERIAL    PRIMARY KEY,
    date            DATE         NOT NULL,
    ticker          VARCHAR(20)  NOT NULL DEFAULT 'XAUUSD',
    model_name      VARCHAR(100) NOT NULL,
    predicted_price DOUBLE PRECISION,
    actual_price    DOUBLE PRECISION,
    direction       VARCHAR(10),                  -- 'UP', 'DOWN', 'NEUTRAL'
    confidence      DOUBLE PRECISION,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_date_model
    ON predictions (date DESC, model_name);

-- ──────────────────────────────────────────────
-- 5. Users (for JWT auth in the dashboard)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL    PRIMARY KEY,
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(50)  DEFAULT 'USER',
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);
