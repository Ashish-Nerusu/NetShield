package com.example.demo;

import lombok.Data;
import java.util.Map;
import java.util.List;

@Data
public class MetricsDTO {
    private long totalThreats;
    private long highSeverityThreats;
    private long criticalThreats;
    private Map<String, Long> threatDistribution; // attackType -> count
    private Map<String, Long> activeModels; // modelUsed -> count
    private List<ThreatEventDTO> recentIncidents;
    private double averageConfidence;
    private Map<String, Long> detectionTimeline;
    private Map<String, String> liveStatusMetrics;
    private String overallSeverity;
    
    public MetricsDTO() {}
}
