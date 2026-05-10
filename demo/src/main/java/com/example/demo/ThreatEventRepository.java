package com.example.demo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ThreatEventRepository extends JpaRepository<ThreatEvent, Long> {
    List<ThreatEvent> findByUser_IdOrderByTimestampDesc(Long userId);
    List<ThreatEvent> findByUser_UsernameOrderByTimestampDesc(String username);
    List<ThreatEvent> findAllByOrderByTimestampDesc();
}
