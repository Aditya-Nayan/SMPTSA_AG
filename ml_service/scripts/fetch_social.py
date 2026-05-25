"""
SMPTSA — Phase 1: Fetch social & news data.

Pulls posts from Reddit (via PRAW) and news headlines from NewsAPI,
stores them in the `raw_social_data` table for downstream NLP processing.

Usage:
    python -m ml_service.scripts.fetch_social [--days 30]
"""

import argparse
import json
import logging
import os
from datetime import datetime, timedelta, timezone

import praw
from newsapi import NewsApiClient
from sqlalchemy import text
from dotenv import load_dotenv

from ml_service.db.database import get_engine

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── Reddit configuration ──
SUBREDDITS = ["Gold", "investing", "economics"]
REDDIT_SEARCH_QUERIES = ["gold", "XAUUSD", "gold price", "inflation", "Fed rate"]

# ── News configuration ──
NEWS_QUERIES = ["gold price", "XAUUSD", "gold inflation", "Federal Reserve gold"]


def fetch_reddit_posts(days: int = 30) -> list[dict]:
    """
    Fetch recent posts from target subreddits about gold / XAUUSD.

    Args:
        days: Look-back window in days.

    Returns:
        List of dicts with keys: date, source, content, author, url, metadata.
    """
    client_id = os.getenv("REDDIT_CLIENT_ID", "")
    client_secret = os.getenv("REDDIT_CLIENT_SECRET", "")
    user_agent = os.getenv("REDDIT_USER_AGENT", "smptsa:v1.0")

    if not client_id or not client_secret:
        logger.warning("Reddit credentials missing — skipping Reddit fetch. "
                        "Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env")
        return []

    reddit = praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
    )

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    posts = []

    for sub_name in SUBREDDITS:
        logger.info("Fetching from r/%s ...", sub_name)
        subreddit = reddit.subreddit(sub_name)

        for query in REDDIT_SEARCH_QUERIES:
            try:
                for submission in subreddit.search(query, sort="new", time_filter="month", limit=100):
                    created = datetime.fromtimestamp(submission.created_utc, tz=timezone.utc)
                    if created < cutoff:
                        continue

                    content = f"{submission.title}"
                    if submission.selftext:
                        content += f" {submission.selftext[:500]}"

                    posts.append({
                        "date": created.isoformat(),
                        "source": "reddit",
                        "content": content.strip(),
                        "author": str(submission.author) if submission.author else None,
                        "url": f"https://reddit.com{submission.permalink}",
                        "metadata": json.dumps({
                            "subreddit": sub_name,
                            "score": submission.score,
                            "num_comments": submission.num_comments,
                            "query": query,
                        }),
                    })
            except Exception as e:
                logger.error("Error searching r/%s for '%s': %s", sub_name, query, e)

    logger.info("Fetched %d Reddit posts", len(posts))
    return posts


def fetch_news_articles(days: int = 30) -> list[dict]:
    """
    Fetch gold-related news articles from NewsAPI.

    Args:
        days: Look-back window in days.

    Returns:
        List of dicts with keys: date, source, content, author, url, metadata.
    """
    api_key = os.getenv("NEWSAPI_KEY", "")
    if not api_key:
        logger.warning("NewsAPI key missing — skipping news fetch. Set NEWSAPI_KEY in .env")
        return []

    newsapi = NewsApiClient(api_key=api_key)
    from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    articles_list = []

    for query in NEWS_QUERIES:
        try:
            response = newsapi.get_everything(
                q=query,
                from_param=from_date,
                language="en",
                sort_by="publishedAt",
                page_size=100,
            )
            for article in response.get("articles", []):
                content = article.get("title", "")
                desc = article.get("description", "")
                if desc:
                    content += f" {desc}"

                articles_list.append({
                    "date": article.get("publishedAt", datetime.now(timezone.utc).isoformat()),
                    "source": "news",
                    "content": content.strip(),
                    "author": article.get("author"),
                    "url": article.get("url"),
                    "metadata": json.dumps({
                        "news_source": article.get("source", {}).get("name"),
                        "query": query,
                    }),
                })
        except Exception as e:
            logger.error("Error fetching news for '%s': %s", query, e)

    logger.info("Fetched %d news articles", len(articles_list))
    return articles_list


def store_social_data(records: list[dict]) -> int:
    """
    Insert social/news records into `raw_social_data`.
    Uses content + date uniqueness check to avoid duplicates.
    """
    if not records:
        return 0

    engine = get_engine()
    inserted = 0

    with engine.begin() as conn:
        for rec in records:
            # Simple dedup: skip if identical content + source + date exists
            existing = conn.execute(
                text("""
                    SELECT 1 FROM raw_social_data
                    WHERE source = :source AND content = :content
                    LIMIT 1
                """),
                {"source": rec["source"], "content": rec["content"]},
            ).fetchone()

            if existing:
                continue

            conn.execute(
                text("""
                    INSERT INTO raw_social_data (date, source, content, author, url, metadata)
                    VALUES (:date, :source, :content, :author, :url, :metadata::jsonb)
                """),
                rec,
            )
            inserted += 1

    logger.info("Inserted %d new social/news records", inserted)
    return inserted


def main():
    parser = argparse.ArgumentParser(description="Fetch social & news data for SMPTSA")
    parser.add_argument("--days", type=int, default=30, help="Look-back window in days")
    args = parser.parse_args()

    reddit_posts = fetch_reddit_posts(days=args.days)
    news_articles = fetch_news_articles(days=args.days)

    all_records = reddit_posts + news_articles
    store_social_data(all_records)
    logger.info("Done. Total records processed: %d", len(all_records))


if __name__ == "__main__":
    main()
