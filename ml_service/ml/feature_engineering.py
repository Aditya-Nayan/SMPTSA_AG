"""
SMPTSA — Phase 3: Feature Engineering.

Merges OHLCV price data with sentiment scores, computes technical
indicators (RSI-14, MACD, Bollinger Bands), applies TF-IDF on raw
text, and creates the target column (next_day_close).

Usage:
    python -m ml_service.ml.feature_engineering
"""

import logging

import numpy as np
import pandas as pd
import pandas_ta as ta
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler
from sqlalchemy import text

from ml_service.db.database import get_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
logger = logging.getLogger(__name__)


def load_ohlcv() -> pd.DataFrame:
    """Load OHLCV data from PostgreSQL, indexed by date."""
    engine = get_engine()
    query = """
        SELECT time, open, high, low, close, volume
        FROM ohlcv_data
        WHERE ticker = 'XAUUSD'
        ORDER BY time ASC
    """
    df = pd.read_sql(query, engine, parse_dates=["time"])
    df["date"] = df["time"].dt.date
    df = df.drop(columns=["time"])
    # Keep one row per date (latest if duplicates exist)
    df = df.drop_duplicates(subset=["date"], keep="last")
    logger.info("Loaded %d OHLCV rows", len(df))
    return df


def load_sentiment() -> pd.DataFrame:
    """Load aggregated ('all' source) sentiment scores from PostgreSQL."""
    engine = get_engine()
    query = """
        SELECT date, vader_score, finbert_score, doc_count
        FROM sentiment_scores
        WHERE source = 'all'
        ORDER BY date ASC
    """
    df = pd.read_sql(query, engine, parse_dates=["date"])
    df["date"] = df["date"].dt.date if hasattr(df["date"].dt, "date") else df["date"]
    logger.info("Loaded %d sentiment rows", len(df))
    return df


def load_raw_texts() -> pd.DataFrame:
    """Load raw social/news texts for TF-IDF, grouped by date."""
    engine = get_engine()
    query = """
        SELECT date, content
        FROM raw_social_data
        ORDER BY date ASC
    """
    df = pd.read_sql(query, engine, parse_dates=["date"])
    df["date"] = df["date"].dt.date if hasattr(df["date"].dt, "date") else df["date"]
    # Concatenate all docs per day into a single string
    grouped = df.groupby("date")["content"].apply(lambda x: " ".join(x)).reset_index()
    grouped.columns = ["date", "daily_text"]
    logger.info("Loaded raw texts for %d unique dates", len(grouped))
    return grouped


def compute_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add RSI-14, MACD (12,26,9), and Bollinger Bands (20,2) to the DataFrame.
    """
    df = df.copy()

    # RSI-14
    df["rsi"] = ta.rsi(df["close"], length=14)

    # MACD (12, 26, 9)
    macd_result = ta.macd(df["close"], fast=12, slow=26, signal=9)
    if macd_result is not None:
        df["macd"] = macd_result.iloc[:, 0]         # MACD line
        df["macd_signal"] = macd_result.iloc[:, 1]  # Signal line
        df["macd_hist"] = macd_result.iloc[:, 2]     # Histogram
    else:
        df["macd"] = np.nan
        df["macd_signal"] = np.nan
        df["macd_hist"] = np.nan

    # Bollinger Bands (20, 2)
    bb = ta.bbands(df["close"], length=20, std=2)
    if bb is not None:
        df["bb_lower"] = bb.iloc[:, 0]
        df["bb_mid"] = bb.iloc[:, 1]
        df["bb_upper"] = bb.iloc[:, 2]
        df["bb_bandwidth"] = bb.iloc[:, 3] if bb.shape[1] > 3 else np.nan
    else:
        df["bb_lower"] = np.nan
        df["bb_mid"] = np.nan
        df["bb_upper"] = np.nan
        df["bb_bandwidth"] = np.nan

    logger.info("Technical indicators computed.")
    return df


def compute_tfidf(texts_df: pd.DataFrame, max_features: int = 50) -> pd.DataFrame:
    """
    Apply TF-IDF on daily concatenated texts.

    Returns:
        DataFrame with columns: date, tfidf_0, tfidf_1, ..., tfidf_{max_features-1}
    """
    if texts_df.empty:
        logger.warning("No text data available for TF-IDF. Skipping.")
        return pd.DataFrame()

    vectorizer = TfidfVectorizer(
        max_features=max_features,
        stop_words="english",
        max_df=0.95,
        min_df=2,
    )

    tfidf_matrix = vectorizer.fit_transform(texts_df["daily_text"])
    tfidf_df = pd.DataFrame(
        tfidf_matrix.toarray(),
        columns=[f"tfidf_{i}" for i in range(tfidf_matrix.shape[1])],
    )
    tfidf_df["date"] = texts_df["date"].values
    logger.info("TF-IDF computed: %d features x %d dates", tfidf_matrix.shape[1], len(tfidf_df))
    return tfidf_df


def build_features(
    ohlcv_df: pd.DataFrame = None,
    sentiment_df: pd.DataFrame = None,
    texts_df: pd.DataFrame = None,
    include_tfidf: bool = True,
) -> pd.DataFrame:
    """
    Master function: merge OHLCV + technical indicators + sentiment + TF-IDF.
    Creates the target column `next_day_close` = Close shifted by -1.

    Args:
        ohlcv_df:     DataFrame with OHLCV columns (if None, loads from DB).
        sentiment_df: DataFrame with sentiment scores (if None, loads from DB).
        texts_df:     DataFrame with daily texts (if None, loads from DB).
        include_tfidf: Whether to include TF-IDF features.

    Returns:
        Feature-engineered DataFrame ready for model training.
    """
    if ohlcv_df is None:
        ohlcv_df = load_ohlcv()
    if sentiment_df is None:
        sentiment_df = load_sentiment()

    # Sort by date
    df = ohlcv_df.sort_values("date").reset_index(drop=True)

    # Add technical indicators
    df = compute_technical_indicators(df)

    # Merge sentiment scores
    df = df.merge(
        sentiment_df[["date", "vader_score", "finbert_score"]],
        on="date",
        how="left",
    )

    # Fill missing sentiment with 0 (neutral)
    df["vader_score"] = df["vader_score"].fillna(0.0)
    df["finbert_score"] = df["finbert_score"].fillna(0.0)

    # Combined sentiment score (average of VADER and FinBERT)
    df["sentiment_combined"] = (df["vader_score"] + df["finbert_score"]) / 2

    # TF-IDF features
    if include_tfidf:
        if texts_df is None:
            texts_df = load_raw_texts()
        tfidf_df = compute_tfidf(texts_df)
        if not tfidf_df.empty:
            df = df.merge(tfidf_df, on="date", how="left")
            tfidf_cols = [c for c in df.columns if c.startswith("tfidf_")]
            df[tfidf_cols] = df[tfidf_cols].fillna(0.0)

    # ── Target: next-day closing price ──
    df["target"] = df["close"].shift(-1)

    # ── Direction label (for directional accuracy metric) ──
    df["direction"] = (df["target"] > df["close"]).astype(int)  # 1=UP, 0=DOWN

    # Drop NaN rows from indicator warmup and target shift
    initial_len = len(df)
    df = df.dropna(subset=["target", "rsi", "macd", "bb_upper"]).reset_index(drop=True)
    dropped = initial_len - len(df)
    logger.info("Dropped %d rows (warmup / NaN). Final dataset: %d rows.", dropped, len(df))

    return df


def get_feature_columns(df: pd.DataFrame) -> list[str]:
    """
    Return the list of feature column names (everything except
    date, target, direction, and identifiers).
    """
    exclude = {"date", "target", "direction"}
    return [c for c in df.columns if c not in exclude]


def get_price_feature_columns() -> list[str]:
    """Feature columns for price-based models (OHLCV + technicals + sentiment)."""
    return [
        "open", "high", "low", "close", "volume",
        "rsi", "macd", "macd_signal", "macd_hist",
        "bb_lower", "bb_mid", "bb_upper", "bb_bandwidth",
        "vader_score", "finbert_score", "sentiment_combined",
    ]


def get_sentiment_only_columns() -> list[str]:
    """Feature columns for the sentiment-only experiment."""
    return ["vader_score", "finbert_score", "sentiment_combined"]


def main():
    """Build features and save to CSV for inspection."""
    df = build_features(include_tfidf=True)
    output_path = "ml_service/data/features.csv"

    import os
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    logger.info("Features saved to %s (%d rows, %d columns)", output_path, len(df), len(df.columns))
    print(f"\nFeature columns:\n{list(df.columns)}")
    print(f"\nShape: {df.shape}")
    print(f"\nFirst 3 rows:\n{df.head(3)}")


if __name__ == "__main__":
    main()
