package com.example.demo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;

@Service
public class ThreatEventService {

    @Autowired
    private ThreatEventRepository repository;
    @Autowired
    private UserRepository userRepository;

    private User getCurrentUser() {
        org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !auth.getPrincipal().equals("anonymousUser")) {
            String username = auth.getName();
            return userRepository.findByUsername(username).orElse(null);
        }
        return null;
    }

    public ThreatEvent saveEvent(ThreatEvent event) {
        // Normalize severity
        if (event.getSeverity() == null) {
            event.setSeverity("None");
        } else {
            String sev = event.getSeverity().toLowerCase();
            if (sev.contains("critical")) event.setSeverity("Critical");
            else if (sev.contains("high")) event.setSeverity("High");
            else if (sev.contains("medium")) event.setSeverity("Medium");
            else if (sev.contains("low")) event.setSeverity("Low");
            else event.setSeverity("Safe");
        }

        if (event.getRiskLevel() == null) {
            event.setRiskLevel(event.getSeverity());
        }
        
        // Generate recommendation summary if not present
        if (event.getRecommendationSummary() == null) {
            if ("Safe".equals(event.getSeverity()) || "None".equals(event.getSeverity())) {
                event.setRecommendationSummary("No immediate action required. Traffic appears normal.");
            } else {
                event.setRecommendationSummary("Investigate source IP and consider rate-limiting or blocking if traffic persists.");
            }
        }

        // Generate mock geolocation if not provided (required for Live Map)
        if (event.getSrcLat() == null) {
            String[] cities = {"London", "New York", "Tokyo", "Singapore", "Frankfurt", "Sydney", "Bengaluru"};
            String[] countries = {"UK", "USA", "Japan", "Singapore", "Germany", "Australia", "India"};
            double[][] coords = {
                    {51.5074, -0.1278},
                    {40.7128, -74.0060},
                    {35.6762, 139.6503},
                    {1.3521, 103.8198},
                    {50.1109, 8.6821},
                    {-33.8688, 151.2093},
                    {12.9716, 77.5946}
            };
            
            int hash = (event.getSourceIp() != null) ? Math.abs(event.getSourceIp().hashCode()) : (int)(Math.random() * 100);
            int idx = hash % cities.length;
            
            event.setSrcCity(cities[idx]);
            event.setSrcCountry(countries[idx]);
            event.setSrcLat(coords[idx][0]);
            event.setSrcLng(coords[idx][1]);
            
            // Generate a different destination mock
            int dstIdx = (idx + 1) % cities.length;
            event.setDstCity(cities[dstIdx]);
            event.setDstCountry(countries[dstIdx]);
            event.setDstLat(coords[dstIdx][0]);
            event.setDstLng(coords[dstIdx][1]);
        }

        // Attach user if not already attached
        if (event.getUser() == null) {
            User currentUser = getCurrentUser();
            if (currentUser != null) {
                event.setUser(currentUser);
            }
        }

        return repository.save(event);
    }

    public List<ThreatEventDTO> getHistoryForUser(Long userId) {
        User currentUser = getCurrentUser();
        List<ThreatEvent> events;
        if (currentUser != null) {
            events = repository.findByUser_IdOrderByTimestampDesc(currentUser.getId());
        } else {
            events = repository.findAllByOrderByTimestampDesc();
        }
        return events.stream().map(ThreatEventDTO::new).collect(Collectors.toList());
    }
    
    public List<ThreatEventDTO> getAllHistory() {
        return getHistoryForUser(null);
    }

    public MetricsDTO getGlobalMetrics() {
        User currentUser = getCurrentUser();
        List<ThreatEvent> allEvents;
        
        if (currentUser != null) {
            allEvents = repository.findByUser_IdOrderByTimestampDesc(currentUser.getId());
        } else {
            allEvents = repository.findAll();
        }
        
        MetricsDTO metrics = new MetricsDTO();
        
        metrics.setTotalThreats(allEvents.size());
        
        long highSeverity = allEvents.stream()
            .filter(e -> "High".equals(e.getSeverity()) || "Critical".equals(e.getSeverity()))
            .count();
        metrics.setHighSeverityThreats(highSeverity);
        
        long critical = allEvents.stream()
            .filter(e -> "Critical".equals(e.getSeverity()))
            .count();
        metrics.setCriticalThreats(critical);
        
        Map<String, Long> distribution = allEvents.stream()
            .filter(e -> e.getAttackType() != null && !"Normal".equalsIgnoreCase(e.getAttackType()) && !"Safe".equalsIgnoreCase(e.getAttackType()))
            .collect(Collectors.groupingBy(ThreatEvent::getAttackType, Collectors.counting()));
        metrics.setThreatDistribution(distribution);
        
        Map<String, Long> activeModels = allEvents.stream()
            .filter(e -> e.getModelUsed() != null)
            .collect(Collectors.groupingBy(ThreatEvent::getModelUsed, Collectors.counting()));
        metrics.setActiveModels(activeModels);
        
        double avgConf = allEvents.stream()
            .filter(e -> e.getConfidence() != null)
            .mapToDouble(ThreatEvent::getConfidence)
            .average()
            .orElse(0.0);
        metrics.setAverageConfidence(avgConf);
        
        List<ThreatEventDTO> recent = allEvents.stream()
            .sorted((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()))
            .limit(10)
            .map(ThreatEventDTO::new)
            .collect(Collectors.toList());
        metrics.setRecentIncidents(recent);
        
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:00");
        Map<String, Long> timeline = allEvents.stream()
            .filter(e -> e.getTimestamp() != null)
            .collect(Collectors.groupingBy(e -> e.getTimestamp().format(formatter), Collectors.counting()));
        metrics.setDetectionTimeline(timeline);
        
        Map<String, String> liveStatus = new HashMap<>();
        liveStatus.put("System Status", "Operational");
        long activeEvents = allEvents.stream().filter(e -> "Active".equals(e.getEventStatus())).count();
        liveStatus.put("Active Events", String.valueOf(activeEvents));
        long investigatingEvents = allEvents.stream().filter(e -> "Investigating".equals(e.getEventStatus())).count();
        liveStatus.put("Investigating", String.valueOf(investigatingEvents));
        metrics.setLiveStatusMetrics(liveStatus);
        
        String overallSev = "Safe";
        if (critical > 0) overallSev = "Critical";
        else if (highSeverity > 0) overallSev = "High";
        else {
            long medium = allEvents.stream().filter(e -> "Medium".equals(e.getSeverity())).count();
            if (medium > 0) overallSev = "Medium";
            else if (allEvents.stream().filter(e -> "Low".equals(e.getSeverity())).count() > 0) overallSev = "Low";
        }
        metrics.setOverallSeverity(overallSev);
        
        return metrics;
    }
}
