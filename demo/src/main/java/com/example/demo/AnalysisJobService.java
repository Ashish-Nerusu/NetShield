package com.example.demo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AnalysisJobService {

    @Autowired
    private ThreatEventService threatEventService;

    @Autowired
    private UserRepository usersRepo;

    private final Map<String, JobStatus> jobs = new ConcurrentHashMap<>();

    public static class JobStatus {
        public String status; // PENDING, PROCESSING, COMPLETED, FAILED
        public Object result;
        public String error;
        
        public JobStatus(String status) {
            this.status = status;
        }
    }

    public void submitJob(String jobId) {
        jobs.put(jobId, new JobStatus("PENDING"));
    }

    public JobStatus getStatus(String jobId) {
        return jobs.get(jobId);
    }

    @Async
    public void processAnalysis(String jobId, String aiBase, byte[] fileBytes, String filename, User user, RestTemplate client) {
        jobs.get(jobId).status = "PROCESSING";
        
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource res = new ByteArrayResource(fileBytes) {
                @Override
                public String getFilename() {
                    return filename;
                }
            };
            body.add("file", res);

            HttpEntity<MultiValueMap<String, Object>> req = new HttpEntity<>(body, headers);
            
            // Re-using a simple post for simplicity in this async worker
            ResponseEntity<Map> response = client.postForEntity(aiBase + "/analyze/auto/dl", req, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> resBody = response.getBody();
                
                ThreatEvent event = new ThreatEvent();
                event.setSourceModule("Automated Shield");
                event.setFilename(filename);
                event.setAttackType((String) resBody.get("prediction"));
                event.setSeverity((String) resBody.get("severity"));
                event.setModelUsed((String) resBody.get("detection_mode"));
                event.setDatasetType((String) resBody.get("detected_dataset"));

                Object conf = resBody.get("confidence_score");
                if (conf instanceof Number) {
                    event.setConfidence(((Number) conf).doubleValue());
                } else {
                    event.setConfidence(0.0);
                }

                event.setTimestamp(LocalDateTime.now());
                
                if (user != null) {
                    event.setUser(user);
                }
                
                threatEventService.saveEvent(event);

                JobStatus status = jobs.get(jobId);
                status.status = "COMPLETED";
                status.result = resBody;
            } else {
                throw new RuntimeException("Upstream AI error: " + response.getStatusCode());
            }
        } catch (Exception e) {
            JobStatus status = jobs.get(jobId);
            if (status != null) {
                status.status = "FAILED";
                String msg = e.getMessage();
                if (e instanceof org.springframework.web.client.ResourceAccessException || 
                   (msg != null && (msg.contains("Connection refused") || msg.contains("I/O error")))) {
                    status.error = "ML_SERVICE_OFFLINE: FastAPI ML engine is unavailable on port 8000";
                } else {
                    status.error = msg;
                }
            }
        }
    }
}
