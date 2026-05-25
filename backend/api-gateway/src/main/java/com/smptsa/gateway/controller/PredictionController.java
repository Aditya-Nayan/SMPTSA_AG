package com.smptsa.gateway.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.smptsa.gateway.service.MlServiceClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST controller — proxies prediction and backtest requests
 * to the Python FastAPI ML service.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class PredictionController {

    private final MlServiceClient mlServiceClient;

    /**
     * GET /api/predict/{ticker}
     *
     * Returns latest prediction from all 4 models for the given ticker.
     */
    @GetMapping("/predict/{ticker}")
    public ResponseEntity<?> predict(@PathVariable String ticker) {
        log.info("GET /api/predict/{}", ticker);

        // Build a request with default values for a live query
        // In production, this would fetch the latest OHLCV + sentiment from DB/cache
        Map<String, Object> body = Map.of(
            "open", 0.0,
            "high", 0.0,
            "low", 0.0,
            "close", 0.0,
            "volume", 0.0,
            "vader_score", 0.0,
            "finbert_score", 0.0
        );

        JsonNode result = mlServiceClient.predict(body);
        if (result == null) {
            return ResponseEntity.status(503).body(Map.of(
                "error", "ML service unavailable"
            ));
        }

        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/predict
     *
     * Accepts OHLCV + sentiment payload, forwards to FastAPI.
     */
    @PostMapping("/predict")
    public ResponseEntity<?> predictWithData(@RequestBody Map<String, Object> body) {
        log.info("POST /api/predict with payload");

        JsonNode result = mlServiceClient.predict(body);
        if (result == null) {
            return ResponseEntity.status(503).body(Map.of(
                "error", "ML service unavailable"
            ));
        }

        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/backtest/{ticker}?model=random_forest
     *
     * Returns backtesting results from the ML service.
     */
    @GetMapping("/backtest/{ticker}")
    public ResponseEntity<?> backtest(
            @PathVariable String ticker,
            @RequestParam(required = false) String model) {
        log.info("GET /api/backtest/{} model={}", ticker, model);

        JsonNode result = mlServiceClient.getBacktest(ticker, model);
        if (result == null) {
            return ResponseEntity.status(503).body(Map.of(
                "error", "ML service unavailable"
            ));
        }

        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/sentiment/history?days=30
     *
     * Returns daily sentiment scores over the last N days.
     */
    @GetMapping("/sentiment/history")
    public ResponseEntity<?> sentimentHistory(
            @RequestParam(defaultValue = "30") int days) {
        log.info("GET /api/sentiment/history days={}", days);

        JsonNode result = mlServiceClient.getSentimentHistory(days);
        if (result == null) {
            return ResponseEntity.status(503).body(Map.of(
                "error", "ML service unavailable"
            ));
        }

        return ResponseEntity.ok(result);
    }

    /**
     * GET /health — API gateway health check.
     */
    @GetMapping("/health")
    public ResponseEntity<?> health() {
        JsonNode mlHealth = mlServiceClient.healthCheck();

        return ResponseEntity.ok(Map.of(
            "gateway", "healthy",
            "ml_service", mlHealth != null ? "healthy" : "unavailable"
        ));
    }
}
