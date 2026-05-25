package com.smptsa.ingestion.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/**
 * JPA entity for raw social/news data.
 */
@Entity
@Table(name = "raw_social_data")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RawSocialData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "date", nullable = false)
    private Instant date;

    @Column(name = "source", length = 50, nullable = false)
    private String source;

    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "author", length = 255)
    private String author;

    @Column(name = "url", columnDefinition = "TEXT")
    private String url;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
