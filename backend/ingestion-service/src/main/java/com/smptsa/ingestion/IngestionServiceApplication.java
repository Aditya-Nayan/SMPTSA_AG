package com.smptsa.ingestion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * SMPTSA Ingestion Service — Entry point.
 *
 * Scheduled jobs fetch market data (Yahoo Finance) and social data
 * (Reddit, Twitter, News), normalize them, push to Kafka topics,
 * and persist raw data to PostgreSQL.
 */
@SpringBootApplication
@EnableScheduling
public class IngestionServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(IngestionServiceApplication.class, args);
    }
}
