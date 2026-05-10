package com.example.demo;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "threat_events", indexes = {
    @Index(name = "idx_threat_event_timestamp", columnList = "timestamp"),
    @Index(name = "idx_threat_event_severity", columnList = "severity"),
    @Index(name = "idx_threat_event_attack_type", columnList = "attackType")
})
@Data
public class ThreatEvent {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, updatable = false)
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
    
    private String eventStatus; // Active, Investigating, Mitigated, Resolved
    private String riskLevel;
    
    @Column(length = 1000)
    private String recommendationSummary;
    
    // Geolocation Support (Required for Live Map)
    private String srcCountry;
    private String srcCity;
    private Double srcLat;
    private Double srcLng;

    private String dstCountry;
    private String dstCity;
    private Double dstLat;
    private Double dstLng;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private User user;
    
    @PrePersist
    public void prePersist() {
        if (this.eventUuid == null) {
            this.eventUuid = UUID.randomUUID();
        }
        if (this.timestamp == null) {
            this.timestamp = LocalDateTime.now();
        }
        if (this.eventStatus == null) {
            this.eventStatus = "Active";
        }
    }
}
