package com.smptsa.gateway.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

/**
 * Service that calls the Python FastAPI ML service internally.
 * No ML logic lives here — this is purely a REST client proxy.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MlServiceClient {

    private final WebClient.Builder webClientBuilder;

    @Value("${ml-service.base-url}")
    private String mlServiceBaseUrl;

    /**
     * Call POST /predict on FastAPI with today's OHLCV + sentiment.
     */
    public JsonNode predict(Map<String, Object> requestBody) {
        log.debug("Calling FastAPI POST /predict with payload: {}", requestBody);

        return webClientBuilder.build()
                .post()
                .uri(mlServiceBaseUrl + "/predict")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .doOnError(e -> log.error("FastAPI /predict call failed: {}", e.getMessage()))
                .onErrorResume(e -> Mono.empty())
                .block();
    }

    /**
     * Call GET /backtest on FastAPI.
     */
    public JsonNode getBacktest(String ticker, String model) {
        String url = mlServiceBaseUrl + "/backtest?ticker=" + ticker;
        if (model != null && !model.isBlank()) {
            url += "&model=" + model;
        }
        log.debug("Calling FastAPI GET {}", url);

        return webClientBuilder.build()
                .get()
                .uri(url)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .doOnError(e -> log.error("FastAPI /backtest call failed: {}", e.getMessage()))
                .onErrorResume(e -> Mono.empty())
                .block();
    }

    /**
     * Call GET /sentiment/history on FastAPI.
     */
    public JsonNode getSentimentHistory(int days) {
        String url = mlServiceBaseUrl + "/sentiment/history?days=" + days;
        log.debug("Calling FastAPI GET {}", url);

        return webClientBuilder.build()
                .get()
                .uri(url)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .doOnError(e -> log.error("FastAPI /sentiment/history call failed: {}", e.getMessage()))
                .onErrorResume(e -> Mono.empty())
                .block();
    }

    /**
     * Health check on the ML service.
     */
    public JsonNode healthCheck() {
        return webClientBuilder.build()
                .get()
                .uri(mlServiceBaseUrl + "/health")
                .retrieve()
                .bodyToMono(JsonNode.class)
                .onErrorResume(e -> Mono.empty())
                .block();
    }
}
