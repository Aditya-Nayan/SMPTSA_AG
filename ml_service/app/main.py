"""
SMPTSA — Phase 5: FastAPI ML Service.

Serves trained models via REST endpoints:
    POST /predict      — predict next-day price from today's OHLCV + sentiment
    GET  /backtest     — evaluation metrics for all models
    GET  /models       — list available models
    GET  /health       — health check

Usage:
    uvicorn ml_service.app.main:app --host 0.0.0.0 --port 8000 --reload
"""

import json
import logging
import os
from datetime import datetime
from typing import Optional

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ml_service.ml.feature_engineering import (
    get_price_feature_columns,
    get_sentiment_only_columns,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
logger = logging.getLogger(__name__)

# ───────────────────────────────────────────────────────────
# FastAPI app
# ───────────────────────────────────────────────────────────

app = FastAPI(
    title="SMPTSA ML Prediction Service",
    description="Real-time XAUUSD prediction engine with 4 ML models + sentiment analysis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ───────────────────────────────────────────────────────────
# Model loading (at startup)
# ───────────────────────────────────────────────────────────

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

loaded_models = {}
loaded_scalers = {}
evaluation_results = {}

MODEL_NAMES = [
    "linear_regression",
    "multivariate_regression",
    "random_forest",
    "extra_trees",
    "sentiment_only",
]


@app.on_event("startup")
async def load_models():
    """Load all trained models and scalers at startup."""
    logger.info("Loading trained models from %s …", MODELS_DIR)

    for name in MODEL_NAMES:
        model_path = os.path.join(MODELS_DIR, f"{name}.joblib")
        scaler_path = os.path.join(MODELS_DIR, f"{name}_scaler.joblib")

        if os.path.exists(model_path):
            loaded_models[name] = joblib.load(model_path)
            logger.info("  ✓ Loaded model: %s", name)
        else:
            logger.warning("  ✗ Model not found: %s", model_path)

        if os.path.exists(scaler_path):
            loaded_scalers[name] = joblib.load(scaler_path)

    # Load evaluation results
    results_path = os.path.join(MODELS_DIR, "evaluation_results.json")
    if os.path.exists(results_path):
        with open(results_path, "r") as f:
            evaluation_results.update(json.load(f))
        logger.info("  ✓ Loaded evaluation results")

    logger.info("Models loaded: %d / %d", len(loaded_models), len(MODEL_NAMES))


# ───────────────────────────────────────────────────────────
# Request / Response schemas
# ───────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """Input for prediction: today's OHLCV + sentiment scores."""
    open: float = Field(..., description="Today's opening price")
    high: float = Field(..., description="Today's high price")
    low: float = Field(..., description="Today's low price")
    close: float = Field(..., description="Today's closing price")
    volume: float = Field(0, description="Today's volume")
    vader_score: float = Field(0.0, description="VADER sentiment score [-1, +1]")
    finbert_score: float = Field(0.0, description="FinBERT sentiment score [-1, +1]")
    rsi: Optional[float] = Field(None, description="RSI-14 value")
    macd: Optional[float] = Field(None, description="MACD value")
    macd_signal: Optional[float] = Field(None, description="MACD signal")
    macd_hist: Optional[float] = Field(None, description="MACD histogram")
    bb_lower: Optional[float] = Field(None, description="Bollinger lower band")
    bb_mid: Optional[float] = Field(None, description="Bollinger middle band")
    bb_upper: Optional[float] = Field(None, description="Bollinger upper band")
    bb_bandwidth: Optional[float] = Field(None, description="Bollinger bandwidth")


class SinglePrediction(BaseModel):
    model_name: str
    predicted_price: float
    direction: str  # UP, DOWN, NEUTRAL
    confidence: float


class PredictResponse(BaseModel):
    ticker: str = "XAUUSD"
    timestamp: str
    current_close: float
    sentiment_score: float
    predictions: list[SinglePrediction]


class BacktestMetrics(BaseModel):
    model_name: str
    description: str
    mae: float
    rmse: float
    r2: float
    directional_accuracy: float
    n_features: int


class BacktestResponse(BaseModel):
    ticker: str = "XAUUSD"
    models: list[BacktestMetrics]


# ───────────────────────────────────────────────────────────
# Endpoints
# ───────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "models_loaded": len(loaded_models),
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/models")
async def list_models():
    """List all available models."""
    return {
        "available": list(loaded_models.keys()),
        "total": len(loaded_models),
    }


@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """
    Predict next-day XAUUSD price using all loaded models.

    Accepts today's OHLCV + sentiment scores and returns predictions
    from each model with direction and confidence.
    """
    if not loaded_models:
        raise HTTPException(status_code=503, detail="No models loaded. Train models first.")

    sentiment_combined = (request.vader_score + request.finbert_score) / 2
    predictions = []

    for name, model in loaded_models.items():
        scaler = loaded_scalers.get(name)

        # Build feature vector based on model type
        if name == "sentiment_only":
            features = get_sentiment_only_columns()
            values = [request.vader_score, request.finbert_score, sentiment_combined]
        else:
            features = get_price_feature_columns()
            values = [
                request.open, request.high, request.low, request.close, request.volume,
                request.rsi or 50.0,  # Default RSI to neutral
                request.macd or 0.0,
                request.macd_signal or 0.0,
                request.macd_hist or 0.0,
                request.bb_lower or request.low,
                request.bb_mid or request.close,
                request.bb_upper or request.high,
                request.bb_bandwidth or 0.0,
                request.vader_score,
                request.finbert_score,
                sentiment_combined,
            ]

        X = np.array([values])

        # Scale if scaler exists
        if scaler:
            X = scaler.transform(X)

        pred_price = float(model.predict(X)[0])

        # Direction
        diff = pred_price - request.close
        if abs(diff) < 0.5:  # Threshold for NEUTRAL
            direction = "NEUTRAL"
        elif diff > 0:
            direction = "UP"
        else:
            direction = "DOWN"

        # Confidence (simple heuristic based on % change)
        pct_change = abs(diff / request.close) * 100
        confidence = min(pct_change * 10, 100.0)

        predictions.append(SinglePrediction(
            model_name=name,
            predicted_price=round(pred_price, 2),
            direction=direction,
            confidence=round(confidence, 2),
        ))

    return PredictResponse(
        timestamp=datetime.utcnow().isoformat(),
        current_close=request.close,
        sentiment_score=round(sentiment_combined, 4),
        predictions=predictions,
    )


@app.get("/backtest", response_model=BacktestResponse)
async def backtest(
    ticker: str = Query("XAUUSD", description="Ticker symbol"),
    model: Optional[str] = Query(None, description="Filter to a specific model"),
):
    """
    Return backtesting evaluation metrics for trained models.
    """
    if not evaluation_results:
        raise HTTPException(status_code=404, detail="No evaluation results found. Train models first.")

    models_out = []
    for name, metrics in evaluation_results.items():
        if model and name != model:
            continue
        models_out.append(BacktestMetrics(
            model_name=name,
            description=metrics.get("description", ""),
            mae=metrics.get("mae", 0),
            rmse=metrics.get("rmse", 0),
            r2=metrics.get("r2", 0),
            directional_accuracy=metrics.get("directional_accuracy", 0),
            n_features=metrics.get("n_features", 0),
        ))

    if not models_out:
        raise HTTPException(status_code=404, detail=f"Model '{model}' not found.")

    return BacktestResponse(ticker=ticker, models=models_out)


@app.get("/sentiment/history")
async def sentiment_history(days: int = Query(30, description="Number of days")):
    """
    Return daily sentiment scores over the last N days.
    Broken down by source (twitter, reddit, news).
    """
    from sqlalchemy import text as sql_text
    from ml_service.db.database import get_engine

    engine = get_engine()
    query = sql_text("""
        SELECT date, source, vader_score, finbert_score, doc_count
        FROM sentiment_scores
        WHERE date >= CURRENT_DATE - :days
        ORDER BY date DESC, source
    """)

    with engine.connect() as conn:
        rows = conn.execute(query, {"days": days}).fetchall()

    return {
        "days": days,
        "count": len(rows),
        "data": [
            {
                "date": str(row[0]),
                "source": row[1],
                "vader_score": row[2],
                "finbert_score": row[3],
                "doc_count": row[4],
            }
            for row in rows
        ],
    }
