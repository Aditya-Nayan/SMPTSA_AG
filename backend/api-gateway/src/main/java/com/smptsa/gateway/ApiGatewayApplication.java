package com.smptsa.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * SMPTSA API Gateway — Entry point.
 *
 * REST endpoints for the React frontend, WebSocket channel
 * for live push updates, JWT auth via Spring Security,
 * and calls to the Python FastAPI ML service internally.
 */
@SpringBootApplication
@EnableScheduling
public class ApiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }
}
