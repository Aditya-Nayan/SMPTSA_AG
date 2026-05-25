package com.smptsa.gateway.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.*;

/**
 * WebSocket configuration — registers the live prediction handler.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final LivePredictionHandler livePredictionHandler;

    public WebSocketConfig(LivePredictionHandler livePredictionHandler) {
        this.livePredictionHandler = livePredictionHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(livePredictionHandler, "/ws/live-prediction")
                .setAllowedOrigins("*");
    }
}
