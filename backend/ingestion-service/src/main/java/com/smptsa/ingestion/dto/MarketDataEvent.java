package com.smptsa.ingestion.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import java.time.Instant;

/**
 * Kafka message DTO for market data events.
 */
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class MarketDataEvent {

    private String ticker;
    private Instant timestamp;

    @JsonProperty("open")
    private Double openPrice;

    @JsonProperty("high")
    private Double highPrice;

    @JsonProperty("low")
    private Double lowPrice;

    @JsonProperty("close")
    private Double closePrice;

    private Double volume;
    private String source;
}
