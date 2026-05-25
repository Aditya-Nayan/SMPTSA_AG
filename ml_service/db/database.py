"""
SMPTSA ML Service — Database configuration module.
"""
import os;
from sqlalchemy import create_engine;
from sqlalchemy.orm import sessionmaker, declarative_base;
from dotenv import load_dotenv;

load_dotenv()

# Railway provides DATABASE_URL directly; fall back to individual vars for local dev
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "smptsa_db")
    DB_USER = os.getenv("DB_USER", "smptsa")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "smptsa_secret")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Yield a database session, auto-close on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_engine():
    """Return the SQLAlchemy engine."""
    return engine
