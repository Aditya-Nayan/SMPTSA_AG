"""
SMPTSA — Phase 2: NLP Sentiment Engine.

Runs VADER on tweets/Reddit posts and FinBERT on news headlines.
Aggregates daily sentiment scores and stores them in the
`sentiment_scores` table.

Usage:
    python -m ml_service.nlp.sentiment_analyzer
"""

import logging
from datetime import datetime

import pandas as pd
import torch
from sqlalchemy import text
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from ml_service.db.database import get_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── VADER ──────────────────────────────────────────────────
vader = SentimentIntensityAnalyzer()

# ── FinBERT (loaded lazily) ────────────────────────────────
_finbert_tokenizer = None
_finbert_model = None


def _load_finbert():
    """Lazy-load FinBERT model and tokenizer from HuggingFace."""
    global _finbert_tokenizer, _finbert_model
    if _finbert_tokenizer is None:
        logger.info("Loading FinBERT model (ProsusAI/finbert) …")
        _finbert_tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
        _finbert_model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
        _finbert_model.eval()
        logger.info("FinBERT loaded.")
    return _finbert_tokenizer, _finbert_model


# ───────────────────────────────────────────────────────────
# Scoring functions
# ───────────────────────────────────────────────────────────

def vader_score(text_content: str) -> float:
    """
    Run VADER on short text (tweets, Reddit posts).

    Returns:
        Compound score in range [-1, +1].
    """
    scores = vader.polarity_scores(text_content)
    return scores["compound"]


def finbert_score(text_content: str) -> float:
    """
    Run FinBERT on a text snippet (news headline / description).

    Returns:
        Score in range [-1, +1] where:
            -1 = negative, 0 = neutral, +1 = positive.
    """
    tokenizer, model = _load_finbert()

    # Truncate to 512 tokens max
    inputs = tokenizer(
        text_content,
        return_tensors="pt",
        truncation=True,
        max_length=512,
        padding=True,
    )

    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1)

    # FinBERT labels: [positive, negative, neutral]
    positive = probs[0][0].item()
    negative = probs[0][1].item()
    # neutral  = probs[0][2].item()

    # Map to [-1, +1] range
    score = positive - negative
    return round(score, 6)


def score_document(text_content: str, source: str) -> dict:
    """
    Score a single document using the appropriate model.

    Args:
        text_content: The raw text.
        source:       'twitter', 'reddit', or 'news'.

    Returns:
        Dict with vader_score and finbert_score.
    """
    v_score = vader_score(text_content)

    # Use FinBERT for news; VADER is primary for short social posts
    if source == "news":
        f_score = finbert_score(text_content)
    else:
        # Still run FinBERT on social posts but VADER is the primary signal
        try:
            f_score = finbert_score(text_content)
        except Exception:
            f_score = None

    return {
        "vader_score": v_score,
        "finbert_score": f_score,
    }


# ───────────────────────────────────────────────────────────
# Batch processing & aggregation
# ───────────────────────────────────────────────────────────

def process_all_documents():
    """
    Read all raw_social_data from the database, score each document,
    aggregate daily means by source, and write to sentiment_scores table.
    """
    engine = get_engine()

    # Pull all raw documents
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, date, source, content FROM raw_social_data ORDER BY date")
        ).fetchall()

    if not rows:
        logger.warning("No documents found in raw_social_data. Run fetch_social first.")
        return

    logger.info("Scoring %d documents …", len(rows))

    scored = []
    for i, row in enumerate(rows):
        doc_id, doc_date, source, content = row
        if not content or len(content.strip()) < 5:
            continue

        scores = score_document(content, source)
        scored.append({
            "date": pd.Timestamp(doc_date).normalize().date(),
            "source": source,
            "vader_score": scores["vader_score"],
            "finbert_score": scores["finbert_score"],
        })

        if (i + 1) % 50 == 0:
            logger.info("  Scored %d / %d documents", i + 1, len(rows))

    if not scored:
        logger.warning("No valid documents to score.")
        return

    df = pd.DataFrame(scored)

    # Aggregate: daily mean per source
    agg = df.groupby(["date", "source"]).agg(
        vader_score=("vader_score", "mean"),
        finbert_score=("finbert_score", "mean"),
        doc_count=("vader_score", "count"),
    ).reset_index()

    # Also compute an "all" aggregate per day
    agg_all = df.groupby("date").agg(
        vader_score=("vader_score", "mean"),
        finbert_score=("finbert_score", "mean"),
        doc_count=("vader_score", "count"),
    ).reset_index()
    agg_all["source"] = "all"

    combined = pd.concat([agg, agg_all], ignore_index=True)

    # Write to DB
    _store_sentiment_scores(combined)
    logger.info("Sentiment scoring complete. %d aggregated rows stored.", len(combined))


def _store_sentiment_scores(df: pd.DataFrame):
    """Upsert aggregated sentiment scores into the database."""
    engine = get_engine()

    with engine.begin() as conn:
        for _, row in df.iterrows():
            conn.execute(
                text("""
                    INSERT INTO sentiment_scores (date, source, vader_score, finbert_score, doc_count)
                    VALUES (:date, :source, :vader_score, :finbert_score, :doc_count)
                    ON CONFLICT (date, source) DO UPDATE SET
                        vader_score  = EXCLUDED.vader_score,
                        finbert_score = EXCLUDED.finbert_score,
                        doc_count    = EXCLUDED.doc_count
                """),
                {
                    "date": row["date"],
                    "source": row["source"],
                    "vader_score": float(row["vader_score"]) if pd.notna(row["vader_score"]) else None,
                    "finbert_score": float(row["finbert_score"]) if pd.notna(row["finbert_score"]) else None,
                    "doc_count": int(row["doc_count"]),
                },
            )


def main():
    process_all_documents()


if __name__ == "__main__":
    main()
