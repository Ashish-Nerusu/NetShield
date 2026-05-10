package com.example.demo;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class ThreatEventDTO {
    private UUID eventUuid;
    private LocalDateTime timestamp;
    private String sourceModule;
    private String filename;
    
    private String sourceIp;
    private String destinationIp;
    
    private String attackType;
    private String severity;
    private Double confidence;
    private String modelUsed;
    private String datasetType;
    
    private String eventStatus;
    private String riskLevel;
    private String recommendationSummary;
    
    private String srcCountry;
    private String srcCity;
    private Double srcLat;
    private Double srcLng;

    private String dstCountry;
    private String dstCity;
    private Double dstLat;
    private Double dstLng;
    
    public ThreatEventDTO(ThreatEvent event) {
        this.eventUuid = event.getEventUuid();
        this.timestamp = event.getTimestamp();
        this.sourceModule = event.getSourceModule();
        this.filename = event.getFilename();
        this.sourceIp = event.getSourceIp();
        this.destinationIp = event.getDestinationIp();
        this.attackType = event.getAttackType();
        this.severity = event.getSeverity();
        this.confidence = event.getConfidence();
        this.modelUsed = event.getModelUsed();
        this.datasetType = event.getDatasetType();
        this.eventStatus = event.getEventStatus();
        this.riskLevel = event.getRiskLevel();
        this.recommendationSummary = event.getRecommendationSummary();
        this.srcCountry = event.getSrcCountry();
        this.srcCity = event.getSrcCity();
        this.srcLat = event.getSrcLat();
        this.srcLng = event.getSrcLng();
        this.dstCountry = event.getDstCountry();
        this.dstCity = event.getDstCity();
        this.dstLat = event.getDstLat();
        this.dstLng = event.getDstLng();
    }
}
