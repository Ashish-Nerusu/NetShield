package com.example.demo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HistoryRepository extends JpaRepository<AnalysisHistory, Long> {
    java.util.List<AnalysisHistory> findByUserId(Long userId);
    java.util.List<AnalysisHistory> findBySrcIp(String srcIp);
    java.util.List<AnalysisHistory> findByDstIp(String dstIp);
}
