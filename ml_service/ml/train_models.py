"""
SMPTSA — Phase 4: Model Training & Evaluation.

Trains 4 regression models + 1 sentiment-only experiment on the
feature-engineered dataset. Evaluates with MAE, RMSE, R², and
directional accuracy. Saves trained models with joblib.

Models:
    1. Linear Regression           (baseline)
    2. Multivariate Regression     (mid — Ridge with all features)
    3. Random Forest Regressor     (mid — 150 estimators)
    4. Extra Trees Regressor       (advanced — 150 estimators)
    5. Sentiment-Only Linear Reg   (research experiment)

Usage:
    python -m ml_service.ml.train_models
"""

import logging
import os
from datetime import datetime

import joblib
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler

from ml_service.ml.feature_engineering import (
    build_features,
    get_price_feature_columns,
    get_sentiment_only_columns,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
PLOTS_DIR = os.path.join(os.path.dirname(__file__), "..", "plots")


def ensure_dirs():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(PLOTS_DIR, exist_ok=True)


# ───────────────────────────────────────────────────────────
# Model definitions
# ───────────────────────────────────────────────────────────

def get_models() -> dict:
    """Return the 4 specified models + sentiment-only experiment."""
    return {
        "linear_regression": {
            "model": LinearRegression(),
            "features": get_price_feature_columns(),
            "description": "Baseline Linear Regression (OHLCV + sentiment)",
        },
        "multivariate_regression": {
            "model": Ridge(alpha=1.0),
            "features": get_price_feature_columns(),
            "description": "Multivariate Ridge Regression (all features)",
        },
        "random_forest": {
            "model": RandomForestRegressor(
                n_estimators=150,
                max_depth=15,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1,
            ),
            "features": get_price_feature_columns(),
            "description": "Random Forest Regressor (150 trees)",
        },
        "extra_trees": {
            "model": ExtraTreesRegressor(
                n_estimators=150,
                max_depth=15,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1,
            ),
            "features": get_price_feature_columns(),
            "description": "Extra Trees Regressor (150 trees)",
        },
        "sentiment_only": {
            "model": LinearRegression(),
            "features": get_sentiment_only_columns(),
            "description": "Sentiment-Only Linear Regression (research experiment)",
        },
    }


# ───────────────────────────────────────────────────────────
# Train-test split (CHRONOLOGICAL — never shuffle time-series)
# ───────────────────────────────────────────────────────────

def chronological_split(df: pd.DataFrame, train_ratio: float = 0.8):
    """
    Split data chronologically. No shuffling.

    Returns:
        (train_df, test_df)
    """
    split_idx = int(len(df) * train_ratio)
    train = df.iloc[:split_idx].copy()
    test = df.iloc[split_idx:].copy()
    logger.info(
        "Chronological split: train=%d rows (%s → %s), test=%d rows (%s → %s)",
        len(train), train["date"].iloc[0], train["date"].iloc[-1],
        len(test), test["date"].iloc[0], test["date"].iloc[-1],
    )
    return train, test


# ───────────────────────────────────────────────────────────
# Evaluation metrics
# ───────────────────────────────────────────────────────────

def evaluate(y_true: np.ndarray, y_pred: np.ndarray, y_prev_close: np.ndarray) -> dict:
    """
    Compute MAE, RMSE, R², and directional accuracy.

    Directional accuracy: did the model predict the correct direction
    (up or down) compared to the previous close?
    """
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)

    # Directional accuracy
    actual_dir = (y_true > y_prev_close).astype(int)
    pred_dir = (y_pred > y_prev_close).astype(int)
    dir_accuracy = (actual_dir == pred_dir).mean()

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 6),
        "directional_accuracy": round(dir_accuracy, 4),
    }


# ───────────────────────────────────────────────────────────
# Plotting
# ───────────────────────────────────────────────────────────

def plot_actual_vs_predicted(
    dates: np.ndarray,
    y_true: np.ndarray,
    predictions: dict[str, np.ndarray],
    save_path: str,
):
    """Plot actual vs predicted curves for all models."""
    fig, ax = plt.subplots(figsize=(14, 7))

    ax.plot(dates, y_true, label="Actual", color="#1a1a2e", linewidth=2)

    colors = ["#e94560", "#0f3460", "#16c79a", "#f5a623", "#8b5cf6"]
    for i, (name, y_pred) in enumerate(predictions.items()):
        ax.plot(dates, y_pred, label=name.replace("_", " ").title(),
                color=colors[i % len(colors)], linewidth=1.2, alpha=0.8)

    ax.set_title("XAUUSD — Actual vs Predicted (Test Set)", fontsize=14, fontweight="bold")
    ax.set_xlabel("Date")
    ax.set_ylabel("Price (USD)")
    ax.legend(loc="upper left", fontsize=9)
    ax.grid(True, alpha=0.3)

    # Format x-axis dates
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m-%d"))
    fig.autofmt_xdate(rotation=45)

    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    logger.info("Saved plot: %s", save_path)


def plot_feature_importance(model, feature_names: list, model_name: str, save_path: str):
    """Plot feature importance for tree-based models."""
    if not hasattr(model, "feature_importances_"):
        return

    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1][:20]  # Top 20

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.barh(
        [feature_names[i] for i in indices][::-1],
        importances[indices][::-1],
        color="#0f3460",
        alpha=0.85,
    )
    ax.set_title(f"Feature Importance — {model_name.replace('_', ' ').title()}", fontsize=13)
    ax.set_xlabel("Importance")
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    logger.info("Saved feature importance plot: %s", save_path)


# ───────────────────────────────────────────────────────────
# Main training pipeline
# ───────────────────────────────────────────────────────────

def train_all():
    """
    Full training pipeline:
      1. Build features
      2. Chronological split
      3. Train each model
      4. Evaluate
      5. Save models + plots + metrics
    """
    ensure_dirs()

    # 1. Build features
    logger.info("═" * 60)
    logger.info("PHASE 4: MODEL TRAINING & EVALUATION")
    logger.info("═" * 60)

    df = build_features(include_tfidf=False)  # TF-IDF optional for first pass
    logger.info("Feature matrix shape: %s", df.shape)

    # 2. Split
    train_df, test_df = chronological_split(df, train_ratio=0.8)

    # 3. Train & evaluate each model
    models_config = get_models()
    results = {}
    predictions = {}
    scalers = {}

    for name, config in models_config.items():
        logger.info("─" * 50)
        logger.info("Training: %s", config["description"])
        logger.info("─" * 50)

        feature_cols = [c for c in config["features"] if c in df.columns]
        if not feature_cols:
            logger.error("No valid feature columns for %s. Skipping.", name)
            continue

        # Scale features
        scaler = StandardScaler()
        X_train = scaler.fit_transform(train_df[feature_cols].values)
        X_test = scaler.transform(test_df[feature_cols].values)
        y_train = train_df["target"].values
        y_test = test_df["target"].values
        prev_close_test = test_df["close"].values

        # Train
        model = config["model"]
        model.fit(X_train, y_train)

        # Predict
        y_pred = model.predict(X_test)

        # Evaluate
        metrics = evaluate(y_test, y_pred, prev_close_test)
        results[name] = {
            "description": config["description"],
            **metrics,
            "n_features": len(feature_cols),
            "feature_columns": feature_cols,
        }
        predictions[name] = y_pred
        scalers[name] = scaler

        logger.info("  MAE: %.4f | RMSE: %.4f | R²: %.6f | Dir Acc: %.2f%%",
                     metrics["mae"], metrics["rmse"], metrics["r2"],
                     metrics["directional_accuracy"] * 100)

        # Save model + scaler
        model_path = os.path.join(MODELS_DIR, f"{name}.joblib")
        scaler_path = os.path.join(MODELS_DIR, f"{name}_scaler.joblib")
        joblib.dump(model, model_path)
        joblib.dump(scaler, scaler_path)
        logger.info("  Saved: %s", model_path)

        # Feature importance for tree models
        if hasattr(model, "feature_importances_"):
            fi_path = os.path.join(PLOTS_DIR, f"{name}_feature_importance.png")
            plot_feature_importance(model, feature_cols, name, fi_path)

    # 4. Results summary
    logger.info("═" * 60)
    logger.info("RESULTS SUMMARY")
    logger.info("═" * 60)

    results_df = pd.DataFrame(results).T
    results_df.index.name = "model"
    print("\n" + results_df[["mae", "rmse", "r2", "directional_accuracy"]].to_string())

    # Save results
    results_path = os.path.join(MODELS_DIR, "evaluation_results.json")
    results_df_export = results_df.copy()
    # Convert feature_columns lists to strings for JSON serialization
    if "feature_columns" in results_df_export.columns:
        results_df_export["feature_columns"] = results_df_export["feature_columns"].apply(
            lambda x: x if isinstance(x, str) else str(x)
        )
    results_df_export.to_json(results_path, orient="index", indent=2)
    logger.info("Saved evaluation results: %s", results_path)

    # 5. Plot actual vs predicted
    test_dates = pd.to_datetime(test_df["date"]).values
    plot_path = os.path.join(PLOTS_DIR, "actual_vs_predicted.png")
    plot_actual_vs_predicted(test_dates, test_df["target"].values, predictions, plot_path)

    # 6. Sentiment-only comparison highlight
    logger.info("═" * 60)
    logger.info("RESEARCH HIGHLIGHT: Sentiment-Only vs Price+Sentiment")
    logger.info("═" * 60)
    if "sentiment_only" in results and "linear_regression" in results:
        s_only = results["sentiment_only"]
        baseline = results["linear_regression"]
        logger.info("Sentiment-Only  → Dir Acc: %.2f%% | MAE: %.4f",
                     s_only["directional_accuracy"] * 100, s_only["mae"])
        logger.info("Baseline (L.R.) → Dir Acc: %.2f%% | MAE: %.4f",
                     baseline["directional_accuracy"] * 100, baseline["mae"])
        delta = s_only["directional_accuracy"] - baseline["directional_accuracy"]
        logger.info("Delta (sentiment-only − baseline): %+.2f%% directional accuracy", delta * 100)

    return results


def main():
    train_all()


if __name__ == "__main__":
    main()
