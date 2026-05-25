package com.smptsa.ingestion.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/**
 * JPA entity for raw market data (OHLCV).
 * Maps to the existing ohlcv_data TimescaleDB hypertable.
 */
@Entity
@Table(name = "ohlcv_data")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OhlcvData {

    @Id
    @Column(name = "time")
    private Instant time;

    @Column(name = "ticker", length = 20)
    private String ticker;

    @Column(name = "open")
    private Double open;

    @Column(name = "high")
    private Double high;

    @Column(name = "low")
    private Double low;

    @Column(name = "close")
    private Double close;

    @Column(name = "volume")
    private Double volume;

    @Column(name = "source", length = 50)
    private String source;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
