package com.smptsa.ingestion.dto;

import lombok.*;
import java.time.Instant;

/**
 * Kafka message DTO for social/news data events.
 */
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SocialDataEvent {

    private String source;      // "twitter", "reddit", "news"
    private Instant timestamp;
    private String content;
    private String author;
    private String url;
    private String metadata;    // JSON string
}
