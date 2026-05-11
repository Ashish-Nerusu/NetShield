package com.example.demo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import io.jsonwebtoken.Claims;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.HashMap;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/")
public class TrafficController {

    @Autowired
    private ThreatEventService threatEventService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepository usersRepo;

    @Autowired
    private PasswordEncoder encoder;

    @Autowired
    private AnalysisJobService jobService;

    private final String aiBase =
            Optional.ofNullable(System.getenv("AI_ENGINE_URL"))
                    .orElse(Optional.ofNullable(System.getenv("FASTAPI_BASE_URL"))
                            .orElse("http://localhost:8000"));

    // ================= HEALTH & ROOT =================

    @GetMapping("/")
    public ResponseEntity<?> root() {
        return ResponseEntity.ok(Map.of(
            "status", "live",
            "service", "NetShield Gatekeeper",
            "timestamp", LocalDateTime.now().toString()
        ));
    }

    @GetMapping("/api/netshield/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of("status", "up", "bridge", "Gatekeeper"));
    }

    @GetMapping("/api/netshield/ping")
    public ResponseEntity<?> ping() {
        return ResponseEntity.ok(Map.of("ping", "pong", "origin", "Gatekeeper"));
    }

    @GetMapping("/api/netshield/test-ai")
    public ResponseEntity<?> testAi() {
        try {
            return ResponseEntity.ok(Map.of(
                "ai_target", aiBase,
                "reachable", client().getForObject(aiBase + "/", Map.class) != null
            ));
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of("ai_target", aiBase, "error", e.getMessage()));
        }
    }

    private RestTemplate client() {
        var f = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        f.setConnectTimeout(45000);
        f.setReadTimeout(120000);
        return new RestTemplate(f);
    }

    private <T> ResponseEntity<T> postWithRetry(String url, HttpEntity<?> req, Class<T> type) throws InterruptedException {
        int attempts = 0;
        Exception last = null;
        while (attempts < 5) { // Reduced attempts to stay within frontend timeout
            attempts++;
            try {
                return client().postForEntity(url, req, type);
            } catch (org.springframework.web.client.RestClientResponseException e) {
                last = e;
                int code = e.getRawStatusCode();
                // 502/503 (Cold start) or 429 (Rate limit)
                if (code == HttpStatus.BAD_GATEWAY.value() || code == HttpStatus.SERVICE_UNAVAILABLE.value() || code == HttpStatus.TOO_MANY_REQUESTS.value()) {
                    String ra = e.getResponseHeaders() != null ? e.getResponseHeaders().getFirst("Retry-After") : null;
                    long waitMs = (ra != null) ? parseRetryAfterMillis(ra) : (long) attempts * 2000L; // Linear wait
                    // Add some jitter
                    waitMs += (long) (Math.random() * 1000L);
                    Thread.sleep(waitMs);
                    continue;
                }
                throw e;
            } catch (org.springframework.web.client.ResourceAccessException e) {
                last = e;
                Thread.sleep((long) attempts * 2000L);
            }
        }
        if (last instanceof RuntimeException) throw (RuntimeException) last;
        throw new RuntimeException(last != null ? last.getMessage() : "Upstream error after retries");
    }

    private long parseRetryAfterMillis(String ra) {
        try {
            return Long.parseLong(ra.trim()) * 1000L;
        } catch (Exception ignored) {
            return 2000L;
        }
    }

    // ================= HISTORY =================

    @GetMapping("/api/netshield/history")
    public ResponseEntity<?> history(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        System.out.println("[TrafficController] Serving /api/netshield/history request");

        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                Claims c = jwtUtil.parse(auth.substring(7));
                Object uidObj = c.get("uid");
                Long uid = null;
                if (uidObj instanceof Number) {
                    uid = ((Number) uidObj).longValue();
                }
                
                if (uid != null) {
                    List<ThreatEventDTO> hist = threatEventService.getHistoryForUser(uid);
                    System.out.println("[TrafficController] History returned count for user: " + (hist != null ? hist.size() : 0));
                    return ResponseEntity.ok(hist);
                }
            } catch (Exception ignored) {}
        }
        List<ThreatEventDTO> allHist = threatEventService.getAllHistory();
        System.out.println("[TrafficController] History returned global count: " + (allHist != null ? allHist.size() : 0));
        return ResponseEntity.ok(allHist);
    }

    @GetMapping("/api/netshield/metrics")
    public ResponseEntity<?> getMetrics() {
        System.out.println("[TrafficController] Serving /api/netshield/metrics request");
        MetricsDTO metrics = threatEventService.getGlobalMetrics();
        System.out.println("[TrafficController] Metrics returned. Total threats: " + metrics.getTotalThreats() + ", Recent incidents count: " + (metrics.getRecentIncidents() != null ? metrics.getRecentIncidents().size() : 0));
        return ResponseEntity.ok(metrics);
    }

    // ================= GEO =================

    @GetMapping("/api/netshield/geo")
    public ResponseEntity<?> geo(@RequestParam String ip) {

        String[] cities = {"London", "New York", "Tokyo", "Singapore", "Frankfurt", "Sydney", "Bengaluru"};

        double[][] coords = {
                {51.5074, -0.1278},
                {40.7128, -74.0060},
                {35.6762, 139.6503},
                {1.3521, 103.8198},
                {50.1109, 8.6821},
                {-33.8688, 151.2093},
                {12.9716, 77.5946}
        };

        int idx = Math.abs(ip.hashCode()) % cities.length;

        return ResponseEntity.ok(Map.of(
                "ip", ip,
                "city", cities[idx],
                "lat", coords[idx][0],
                "lng", coords[idx][1]
        ));
    }

    // ================= FILE ANALYSIS =================

    @PostMapping("/api/netshield/analyze-file")
    public ResponseEntity<?> analyzeFile(
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = "Authorization", required = false) String auth) {

        try {
            String jobId = UUID.randomUUID().toString();
            User user = null;
            if (auth != null && auth.startsWith("Bearer ")) {
                try {
                    Claims c = jwtUtil.parse(auth.substring(7));
                    Object uidObj = c.get("uid");
                    Long uid = null;
                    if (uidObj instanceof Number) {
                        uid = ((Number) uidObj).longValue();
                    }
                    if (uid != null) {
                        user = usersRepo.findById(uid).orElse(null);
                    }
                } catch (Exception ignored) {}
            }

            jobService.submitJob(jobId);
            jobService.processAnalysis(jobId, aiBase, file.getBytes(), file.getOriginalFilename(), user, client());

            return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("jobId", jobId));

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Gatekeeper Error: " + e.getMessage());
        }
    }

    @GetMapping("/api/netshield/analysis-status/{jobId}")
    public ResponseEntity<?> getAnalysisStatus(@PathVariable String jobId) {
        AnalysisJobService.JobStatus status = jobService.getStatus(jobId);
        if (status == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(status);
    }

    // ================= AUTH =================
    // ================= MANUAL ANALYSIS =================

    @PostMapping("/api/netshield/analyze-manual")
    public ResponseEntity<?> analyzeManual(@RequestBody Map<String, Object> payload) {
        System.out.println("[TrafficController] Received manual analysis probe");
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> req = new HttpEntity<>(payload, headers);
            ResponseEntity<Map> response = postWithRetry(aiBase + "/analyze-manual", req, Map.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                ThreatEvent event = new ThreatEvent();
                event.setSourceModule("Manual Probe");
                event.setFilename("Manual Input");
                event.setAttackType((String) body.get("prediction"));
                
                if (payload.containsKey("sourceIp")) {
                    event.setSourceIp((String) payload.get("sourceIp"));
                }
                if (payload.containsKey("destinationIp")) {
                    event.setDestinationIp((String) payload.get("destinationIp"));
                }
                
                Object conf = body.get("threat_score");
                if (conf instanceof Number) {
                    event.setConfidence(((Number) conf).doubleValue());
                } else {
                    event.setConfidence(0.0);
                }
                
                if ("Attack".equalsIgnoreCase(event.getAttackType())) {
                    if (event.getConfidence() >= 0.9) event.setSeverity("Critical");
                    else if (event.getConfidence() >= 0.7) event.setSeverity("High");
                    else event.setSeverity("Medium");
                } else {
                    event.setSeverity("Safe");
                }
                
                event.setModelUsed("sdn_hybrid");
                event.setDatasetType("sdn");
                threatEventService.saveEvent(event);
            }
            return response;
        } catch (Exception e) {
            String msg = e.getMessage();
            if (e instanceof org.springframework.web.client.ResourceAccessException || 
               (msg != null && (msg.contains("Connection refused") || msg.contains("I/O error")))) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "status", 503,
                    "error", "ML_SERVICE_OFFLINE",
                    "message", "FastAPI ML engine is unavailable on port 8000"
                ));
            }
            if (msg != null && (msg.contains("429") || msg.contains("DOCTYPE html"))) {
                return ResponseEntity.status(429).body(Map.of("detail", "NetShield is currently under heavy load or platform rate-limiting. Please wait 30-60 seconds and try again."));
            }
            return ResponseEntity.status(500).body(Map.of("detail", "Gatekeeper Error: " + e.getMessage()));
        }
    }

    @PostMapping("/api/netshield/explain-manual")
    public ResponseEntity<?> explainManual(@RequestBody Map<String, Object> payload) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> req = new HttpEntity<>(payload, headers);
            ResponseEntity<Map> response = postWithRetry(aiBase + "/explain-manual", req, Map.class);
            return response;
        } catch (Exception e) {
            String msg = e.getMessage();
            if (e instanceof org.springframework.web.client.ResourceAccessException || 
               (msg != null && (msg.contains("Connection refused") || msg.contains("I/O error")))) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "status", 503,
                    "error", "ML_SERVICE_OFFLINE",
                    "message", "FastAPI ML engine is unavailable on port 8000"
                ));
            }
            if (msg != null && (msg.contains("429") || msg.contains("DOCTYPE html"))) {
                return ResponseEntity.status(429).body(Map.of("detail", "NetShield is currently under heavy load or platform rate-limiting. Please wait 30-60 seconds and try again."));
            }
            return ResponseEntity.status(500).body(Map.of("detail", "Gatekeeper Error: " + e.getMessage()));
        }
    }

    // ================= AGENT BOT =================

    @PostMapping("/api/netshield/agent")
    public ResponseEntity<?> agentBot(@RequestBody Map<String, String> payload) {
        try {
            String message = payload.getOrDefault("message", "");
            if (message.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Message cannot be empty"));
            }
            
            return ResponseEntity.ok(Map.of(
                "reply", "NetShield AI Assistant is currently operating in demo mode. I received your message: \"" + message + "\""
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "An internal error occurred."));
        }
    }

}
