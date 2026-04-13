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
@CrossOrigin(origins = "https://net-shield-gules.vercel.app", allowCredentials = "true", allowedHeaders = "*")
public class TrafficController {

    @Autowired
    private HistoryRepository historyRepo;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepository usersRepo;

    @Autowired
    private PasswordEncoder encoder;

    private final String aiBase =
            Optional.ofNullable(System.getenv("AI_ENGINE_URL"))
                    .orElse(Optional.ofNullable(System.getenv("FASTAPI_BASE_URL"))
                            .orElse("http://localhost:8003"));

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
        while (attempts < 8) {
            attempts++;
            try {
                return client().postForEntity(url, req, type);
            } catch (org.springframework.web.client.RestClientResponseException e) {
                last = e;
                int code = e.getRawStatusCode();
                // 502/503 (Cold start) or 429 (Rate limit)
                if (code == HttpStatus.BAD_GATEWAY.value() || code == HttpStatus.SERVICE_UNAVAILABLE.value() || code == HttpStatus.TOO_MANY_REQUESTS.value()) {
                    String ra = e.getResponseHeaders() != null ? e.getResponseHeaders().getFirst("Retry-After") : null;
                    long waitMs = (ra != null) ? parseRetryAfterMillis(ra) : (long) Math.pow(2, attempts) * 1000L;
                    // Add some jitter
                    waitMs += (long) (Math.random() * 2000L);
                    Thread.sleep(waitMs);
                    continue;
                }
                throw e;
            } catch (org.springframework.web.client.ResourceAccessException e) {
                last = e;
                Thread.sleep((long) Math.pow(2, attempts) * 1000L);
            }
        }
        if (last instanceof RuntimeException) throw (RuntimeException) last;
        throw new RuntimeException(last != null ? last.getMessage() : "Upstream error after 8 retries");
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

        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                Claims c = jwtUtil.parse(auth.substring(7));
                Long uid = c.get("uid", Long.class);
                return ResponseEntity.ok(historyRepo.findByUserId(uid));
            } catch (Exception ignored) {}
        }
        // If not logged in, return empty list instead of all data
        return ResponseEntity.ok(new ArrayList<>());
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

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

            ByteArrayResource res = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            };

            body.add("file", res);

            HttpEntity<MultiValueMap<String, Object>> req =
                    new HttpEntity<>(body, headers);

            ResponseEntity<Map> response =
                    postWithRetry(aiBase + "/analyze/sdn/ml", req, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {

                AnalysisHistory h = new AnalysisHistory();
                h.setFilename(file.getOriginalFilename());
                h.setResult((String) response.getBody().get("prediction"));

                Object conf = response.getBody().get("confidence_score");
                if (conf instanceof Number) {
                    h.setConfidence(((Number) conf).doubleValue());
                } else {
                    h.setConfidence(0.0);
                }

                h.setTimestamp(LocalDateTime.now());

                if (auth != null && auth.startsWith("Bearer ")) {
                    try {
                        Claims c = jwtUtil.parse(auth.substring(7));
                        Long uid = c.get("uid", Long.class);
                        User u = usersRepo.findById(uid).orElse(null);
                        h.setUser(u);
                    } catch (Exception ignored) {}
                }

                historyRepo.save(h);
            }

            return response;

        } catch (Exception e) {
            String msg = e.getMessage();
            if (msg != null && (msg.contains("429") || msg.contains("DOCTYPE html"))) {
                return ResponseEntity.status(429).body("NetShield is currently under heavy load or platform rate-limiting. Please wait 30-60 seconds and try again.");
            }
            return ResponseEntity.status(500)
                    .body("Gatekeeper Error: " + e.getMessage());
        }
    }

    // ================= AUTH =================
    // ================= MANUAL ANALYSIS =================

    @PostMapping("/api/netshield/analyze-manual")
    public ResponseEntity<?> analyzeManual(@RequestBody Map<String, Object> payload) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> req = new HttpEntity<>(payload, headers);
            ResponseEntity<Map> response = postWithRetry(aiBase + "/analyze-manual", req, Map.class);
            return response;
        } catch (Exception e) {
            String msg = e.getMessage();
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
            if (msg != null && (msg.contains("429") || msg.contains("DOCTYPE html"))) {
                return ResponseEntity.status(429).body(Map.of("detail", "NetShield is currently under heavy load or platform rate-limiting. Please wait 30-60 seconds and try again."));
            }
            return ResponseEntity.status(500).body(Map.of("detail", "Gatekeeper Error: " + e.getMessage()));
        }
    }

}
