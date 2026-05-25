package com.smptsa.ingestion.service;

import com.smptsa.ingestion.dto.MarketDataEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

/**
 * Kafka producer — publishes normalized market and social data
 * events to their respective topics.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KafkaProducerService {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${ingestion.kafka.topic.market-data}")
    private String marketDataTopic;

    @Value("${ingestion.kafka.topic.social-data}")
    private String socialDataTopic;

    /**
     * Publish a market data event to Kafka.
     */
    public void sendMarketData(MarketDataEvent event) {
        String key = event.getTicker() + ":" + event.getTimestamp();
        CompletableFuture<SendResult<String, Object>> future =
                kafkaTemplate.send(marketDataTopic, key, event);

        future.whenComplete((result, ex) -> {
            if (ex != null) {
                log.error("Failed to send market data to Kafka: {}", ex.getMessage());
            } else {
                log.debug("Market data sent → topic={}, offset={}",
                        result.getRecordMetadata().topic(),
                        result.getRecordMetadata().offset());
            }
        });
    }

    /**
     * Publish a social data event to Kafka.
     */
    public void sendSocialData(Object event) {
        CompletableFuture<SendResult<String, Object>> future =
                kafkaTemplate.send(socialDataTopic, event);

        future.whenComplete((result, ex) -> {
            if (ex != null) {
                log.error("Failed to send social data to Kafka: {}", ex.getMessage());
            } else {
                log.debug("Social data sent → topic={}, offset={}",
                        result.getRecordMetadata().topic(),
                        result.getRecordMetadata().offset());
            }
        });
    }
}
