package com.smptsa.ingestion.repository;

import com.smptsa.ingestion.model.RawSocialData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SocialDataRepository extends JpaRepository<RawSocialData, Long> {

    boolean existsBySourceAndContent(String source, String content);
}
