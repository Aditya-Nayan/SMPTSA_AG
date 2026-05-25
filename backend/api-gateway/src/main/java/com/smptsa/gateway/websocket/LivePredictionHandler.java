package com.smptsa.gateway.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smptsa.gateway.service.MlServiceClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * WebSocket handler for live prediction push updates.
 *
 * Maintains a list of connected clients and pushes updated
 * predictions every 30 seconds via a scheduled task.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LivePredictionHandler extends TextWebSocketHandler {

    private final MlServiceClient mlServiceClient;
    private final ObjectMapper objectMapper;

    private final CopyOnWriteArrayList<WebSocketSession> sessions = new CopyOnWriteArrayList<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        log.info("WebSocket client connected: {} (total: {})", session.getId(), sessions.size());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        log.info("WebSocket client disconnected: {} (total: {})", session.getId(), sessions.size());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // Clients can send messages (e.g., subscribe to specific tickers)
        log.debug("Received from {}: {}", session.getId(), message.getPayload());
    }

    /**
     * Push prediction updates to all connected WebSocket clients every 30 seconds.
     */
    @Scheduled(fixedRateString = "${websocket.push-interval-ms}")
    public void pushPredictions() {
        if (sessions.isEmpty()) return;

        try {
            // Call ML service for latest prediction
            Map<String, Object> requestBody = Map.of(
                "open", 0.0, "high", 0.0, "low", 0.0, "close", 0.0,
                "volume", 0.0, "vader_score", 0.0, "finbert_score", 0.0
            );

            JsonNode prediction = mlServiceClient.predict(requestBody);
            if (prediction == null) return;

            // Build WebSocket payload
            Map<String, Object> payload = Map.of(
                "ticker", "XAUUSD",
                "timestamp", Instant.now().toString(),
                "prediction", prediction
            );

            String jsonPayload = objectMapper.writeValueAsString(payload);
            TextMessage wsMessage = new TextMessage(jsonPayload);

            // Broadcast to all connected clients
            int sent = 0;
            for (WebSocketSession session : sessions) {
                if (session.isOpen()) {
                    try {
                        session.sendMessage(wsMessage);
                        sent++;
                    } catch (IOException e) {
                        log.warn("Failed to send to session {}: {}", session.getId(), e.getMessage());
                        sessions.remove(session);
                    }
                } else {
                    sessions.remove(session);
                }
            }

            log.debug("Pushed prediction update to {} clients", sent);

        } catch (Exception e) {
            log.error("Failed to push predictions: {}", e.getMessage());
        }
    }
}
