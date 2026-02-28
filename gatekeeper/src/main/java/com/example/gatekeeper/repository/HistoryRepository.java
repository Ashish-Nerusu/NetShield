package com.example.gatekeeper.repository;

import com.example.gatekeeper.model.AnalysisHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HistoryRepository extends JpaRepository<AnalysisHistory, Long> {
}