"""
SMPTSA — Phase 1: Fetch XAUUSD OHLCV data from Yahoo Finance.

Pulls daily OHLCV candles for the XAUUSD ticker and inserts them
into the PostgreSQL TimescaleDB `ohlcv_data` hypertable.

Usage:
    python -m ml_service.scripts.fetch_ohlcv [--start 2024-03-01] [--end 2025-11-30]
"""

import argparse
import logging
from datetime import datetime

import pandas as pd
import yfinance as yf
from sqlalchemy import text

from ml_service.db.database import get_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
logger = logging.getLogger(__name__)

TICKER = "GC=F"  # Gold futures — Yahoo's proxy for XAUUSD


def fetch_ohlcv(start: str, end: str) -> pd.DataFrame:
    """
    Download daily OHLCV from Yahoo Finance.

    Args:
        start: ISO date string, e.g. '2024-03-01'
        end:   ISO date string, e.g. '2025-11-30'

    Returns:
        DataFrame with columns: time, open, high, low, close, volume
    """
    logger.info("Downloading %s  %s → %s", TICKER, start, end)
    data = yf.download(TICKER, start=start, end=end, interval="1d", progress=False)

    if data.empty:
        logger.warning("No data returned from Yahoo Finance for %s", TICKER)
        return pd.DataFrame()

    # yfinance may return MultiIndex columns when downloading a single ticker
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    df = data[["Open", "High", "Low", "Close", "Volume"]].copy()
    df = df.rename(columns={
        "Open": "open",
        "High": "high",
        "Low": "low",
        "Close": "close",
        "Volume": "volume",
    })
    df.index.name = "time"
    df = df.reset_index()
    df["time"] = pd.to_datetime(df["time"], utc=True)
    df["ticker"] = "XAUUSD"
    df["source"] = "yahoo_finance"

    logger.info("Fetched %d rows", len(df))
    return df


def store_ohlcv(df: pd.DataFrame) -> int:
    """
    Upsert OHLCV rows into PostgreSQL.

    Uses an INSERT ... ON CONFLICT DO NOTHING strategy keyed on (time, ticker)
    to allow safe re-runs without duplicates.
    """
    if df.empty:
        return 0

    engine = get_engine()
    inserted = 0

    with engine.begin() as conn:
        for _, row in df.iterrows():
            result = conn.execute(
                text("""
                    INSERT INTO ohlcv_data (time, ticker, open, high, low, close, volume, source)
                    VALUES (:time, :ticker, :open, :high, :low, :close, :volume, :source)
                    ON CONFLICT DO NOTHING
                """),
                {
                    "time": row["time"],
                    "ticker": row["ticker"],
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": float(row["volume"]),
                    "source": row["source"],
                },
            )
            inserted += result.rowcount

    logger.info("Inserted %d new rows into ohlcv_data", inserted)
    return inserted


def main():
    parser = argparse.ArgumentParser(description="Fetch XAUUSD OHLCV from Yahoo Finance")
    parser.add_argument("--start", default="2024-03-01", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", default=datetime.now().strftime("%Y-%m-%d"), help="End date (YYYY-MM-DD)")
    args = parser.parse_args()

    df = fetch_ohlcv(args.start, args.end)
    store_ohlcv(df)
    logger.info("Done.")


if __name__ == "__main__":
    main()
