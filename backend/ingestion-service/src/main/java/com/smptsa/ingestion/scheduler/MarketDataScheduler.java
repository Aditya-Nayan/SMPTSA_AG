package com.smptsa.ingestion.scheduler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smptsa.ingestion.dto.MarketDataEvent;
import com.smptsa.ingestion.model.OhlcvData;
import com.smptsa.ingestion.repository.OhlcvRepository;
import com.smptsa.ingestion.service.KafkaProducerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;

/**
 * Scheduled job: fetches XAUUSD (Gold Futures) OHLCV data
 * every 5 minutes from Yahoo Finance, normalizes it,
 * persists to PostgreSQL, and publishes to Kafka.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MarketDataScheduler {

    private final WebClient.Builder webClientBuilder;
    private final OhlcvRepository ohlcvRepository;
    private final KafkaProducerService kafkaProducer;
    private final ObjectMapper objectMapper;

    @Value("${ingestion.yahoo-finance-symbol}")
    private String yahooSymbol;

    @Value("${ingestion.ticker}")
    private String ticker;

    /**
     * Fetch latest market data every 5 minutes.
     */
    @Scheduled(fixedRateString = "${ingestion.schedule.ohlcv-rate-ms}")
    public void fetchMarketData() {
        log.info("⏱  Fetching market data for {} …", yahooSymbol);

        try {
            // Yahoo Finance v8 API (chart endpoint)
            String url = String.format(
                "https://query1.finance.yahoo.com/v8/finance/chart/%s?interval=1d&range=1d",
                yahooSymbol
            );

            WebClient client = webClientBuilder.build();
            String response = client.get()
                    .uri(url)
                    .header("User-Agent", "SMPTSA/1.0")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            if (response == null) {
                log.warn("Empty response from Yahoo Finance");
                return;
            }

            JsonNode root = objectMapper.readTree(response);
            JsonNode result = root.path("chart").path("result").get(0);
            JsonNode quote = result.path("indicators").path("quote").get(0);
            JsonNode timestamps = result.path("timestamp");

            if (timestamps.isEmpty()) {
                log.warn("No timestamp data in Yahoo response");
                return;
            }

            // Process the latest data point
            int lastIdx = timestamps.size() - 1;
            Instant time = Instant.ofEpochSecond(timestamps.get(lastIdx).asLong());

            double open  = quote.path("open").get(lastIdx).asDouble();
            double high  = quote.path("high").get(lastIdx).asDouble();
            double low   = quote.path("low").get(lastIdx).asDouble();
            double close = quote.path("close").get(lastIdx).asDouble();
            double vol   = quote.path("volume").get(lastIdx).asDouble(0);

            // Check for duplicate
            if (ohlcvRepository.existsByTimeAndTicker(time, ticker)) {
                log.debug("Market data for {} at {} already exists — skipping.", ticker, time);
                return;
            }

            // Persist to PostgreSQL
            OhlcvData entity = OhlcvData.builder()
                    .time(time).ticker(ticker)
                    .open(open).high(high).low(low).close(close).volume(vol)
                    .source("yahoo_finance")
                    .build();
            ohlcvRepository.save(entity);

            // Publish to Kafka
            MarketDataEvent event = MarketDataEvent.builder()
                    .ticker(ticker).timestamp(time)
                    .openPrice(open).highPrice(high).lowPrice(low).closePrice(close)
                    .volume(vol).source("yahoo_finance")
                    .build();
            kafkaProducer.sendMarketData(event);

            log.info("✓  Market data ingested: {} @ {} — close={}", ticker, time, close);

        } catch (Exception e) {
            log.error("✗  Failed to fetch market data: {}", e.getMessage(), e);
        }
    }
}
