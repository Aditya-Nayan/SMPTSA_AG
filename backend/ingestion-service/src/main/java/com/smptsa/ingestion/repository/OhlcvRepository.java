package com.smptsa.ingestion.repository;

import com.smptsa.ingestion.model.OhlcvData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface OhlcvRepository extends JpaRepository<OhlcvData, Instant> {

    Optional<OhlcvData> findTopByTickerOrderByTimeDesc(String ticker);

    boolean existsByTimeAndTicker(Instant time, String ticker);
}
