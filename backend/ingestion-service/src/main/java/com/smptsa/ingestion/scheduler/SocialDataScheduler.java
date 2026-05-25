package com.smptsa.ingestion.scheduler;

import com.smptsa.ingestion.dto.SocialDataEvent;
import com.smptsa.ingestion.repository.SocialDataRepository;
import com.smptsa.ingestion.service.KafkaProducerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;


/**
 * Scheduled job: placeholder for social data ingestion.
 *
 * In production, this would call the Reddit API (via PRAW-equivalent
 * Java library or a REST wrapper), Twitter/Apify API, and NewsAPI.
 * For now it logs the scheduled tick — the heavy social scraping
 * is handled by the Python scripts (fetch_social.py), and this
 * scheduler primarily consumes from the database or triggers
 * the Python pipeline via an HTTP call.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SocialDataScheduler {

    private final SocialDataRepository socialRepo;
    private final KafkaProducerService kafkaProducer;

    /**
     * Check for new social data every 5 minutes and push to Kafka.
     *
     * This reads any recently-inserted rows from raw_social_data
     * (inserted by the Python fetch_social.py script) and publishes
     * them to the Kafka social-data topic for downstream NLP processing.
     */
    @Scheduled(fixedRateString = "${ingestion.schedule.social-rate-ms}")
    public void publishNewSocialData() {
        log.info("⏱  Checking for new social data to publish to Kafka …");

        try {
            // In a full implementation, we would track a cursor / last-processed ID.
            // For now, fetch the latest 50 records and publish them.
            var recentPosts = socialRepo.findAll()
                    .stream()
                    .sorted((a, b) -> b.getDate().compareTo(a.getDate()))
                    .limit(50)
                    .toList();

            int published = 0;
            for (var post : recentPosts) {
                SocialDataEvent event = SocialDataEvent.builder()
                        .source(post.getSource())
                        .timestamp(post.getDate())
                        .content(post.getContent())
                        .author(post.getAuthor())
                        .url(post.getUrl())
                        .metadata(post.getMetadata())
                        .build();

                kafkaProducer.sendSocialData(event);
                published++;
            }

            log.info("✓  Published {} social data events to Kafka", published);

        } catch (Exception e) {
            log.error("✗  Failed to publish social data: {}", e.getMessage(), e);
        }
    }
}
