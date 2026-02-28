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
@RequestMapping("/api/netshield")
public class TrafficController {

    @Autowired
    private HistoryRepository historyRepo; // Saves results to H2 Database
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository usersRepo;
    @Autowired
    private PasswordEncoder encoder;
    private final String aiBase = java.util.Optional.ofNullable(System.getenv("FASTAPI_BASE_URL")).orElse("http://localhost:8003");

    @PostMapping("/analyze/{dataset}/{type}")
    public ResponseEntity<?> analyze(@PathVariable String dataset, 
                                   @PathVariable String type,
                                   @RequestParam("file") MultipartFile file) {
        try {
            // 1. Prepare the request to Python FastAPI (Port 8003)
            RestTemplate restTemplate = new RestTemplate();
            String url = aiBase + "/analyze/" + dataset + "/" + type;

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            // 2. Wrap the file content properly to avoid 500 errors
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource contentsAsResource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            };
            body.add("file", contentsAsResource);

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            // 3. Forward request and get AI prediction
            ResponseEntity<Map> response = restTemplate.postForEntity(url, requestEntity, Map.class);

            // 4. Attach src/dst coordinates for live map
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                try {
                    String content = new String(file.getBytes());
                    String[] lines = content.split("\\R");
                    if (lines.length > 1) {
                        String header = lines[0];
                        String row1 = lines[1];
                        String[] cols = header.split(",");
                        String[] vals = row1.split(",");
                        String srcCandidate = null;
                        String dstCandidate = null;
                        for (int i = 0; i < cols.length; i++) {
                            String c = cols[i].trim().toLowerCase();
                            if (c.equals("src") || c.equals("src_ip")) srcCandidate = vals[i].trim();
                            if (c.equals("dst") || c.equals("dst_ip")) dstCandidate = vals[i].trim();
                        }
                        if (srcCandidate != null) {
                            response.getBody().put("src_ip", srcCandidate);
                            response.getBody().put("src_location", simulateLocation(srcCandidate));
                        }
                        if (dstCandidate != null) {
                            response.getBody().put("dst_ip", dstCandidate);
                            response.getBody().put("dst_location", simulateLocation(dstCandidate));
                        }
                    }
                } catch (Exception ignored) {}
                AnalysisHistory history = new AnalysisHistory();
                history.setFilename(file.getOriginalFilename());
                history.setResult((String) response.getBody().get("prediction"));
                history.setConfidence((Double) response.getBody().get("confidence_score"));
                history.setTimestamp(LocalDateTime.now());
                // Attempt to parse src/dst from CSV (first row)
                try {
                    String content = new String(file.getBytes());
                    String[] lines = content.split("\\R");
                    if (lines.length > 1) {
                        String header = lines[0];
                        String row1 = lines[1];
                        String[] cols = header.split(",");
                        String[] vals = row1.split(",");
                        for (int i = 0; i < cols.length; i++) {
                            String c = cols[i].trim().toLowerCase();
                            if (c.equals("src") || c.equals("src_ip")) history.setSrcIp(vals[i].trim());
                            if (c.equals("dst") || c.equals("dst_ip")) history.setDstIp(vals[i].trim());
                        }
                    }
                } catch (Exception ignored) {}
                // Attach user if token provided
                try {
                    String auth = org.springframework.web.context.request.RequestContextHolder.currentRequestAttributes()
                            .getAttribute("Authorization", org.springframework.web.context.request.RequestAttributes.SCOPE_REQUEST).toString();
                    if (auth != null && auth.startsWith("Bearer ")) {
                        Claims c = jwtUtil.parse(auth.substring(7));
                        Long uid = c.get("uid", Long.class);
                        history.setUserId(uid);
                    }
                } catch (Exception ignored) {}
                historyRepo.save(history);
            }

            return response;
        } catch (Exception e) {
            // Logs error in Java terminal for debugging
            System.err.println("Gatekeeper Error: " + e.getMessage());
            return ResponseEntity.status(500).body("Gatekeeper Error: " + e.getMessage());
        }
    }

    @PostMapping("/analyze-file")
    public ResponseEntity<?> analyzeFile(@RequestParam("file") MultipartFile file, @RequestHeader(value="Authorization", required=false) String auth) {
        try {
            RestTemplate rt = new RestTemplate();
            String detected = "sdn";
            try {
                String content = new String(file.getBytes());
                String header = content.split("\\R", 2)[0].toLowerCase();
                if (header.contains("pktcount")) detected = "sdn";
                else if (header.contains("active") || header.contains("flow iat")) detected = "cicids";
                else if (header.contains("idle")) detected = "ids2018";
            } catch (Exception ignored) {}
            String modelType = "ml";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource res = new ByteArrayResource(file.getBytes()){
                @Override public String getFilename(){ return file.getOriginalFilename(); }
            };
            body.add("file", res);
            HttpEntity<MultiValueMap<String, Object>> req = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = rt.postForEntity(aiBase + "/analyze/" + detected + "/" + modelType, req, Map.class);
            if (response.getBody() != null) ((Map)response.getBody()).put("detected_dataset", detected);
            // also attach src/dst if present
            try {
                String content = new String(file.getBytes());
                String[] lines = content.split("\\R");
                if (lines.length > 1) {
                    String header = lines[0];
                    String row1 = lines[1];
                    String[] cols = header.split(",");
                    String[] vals = row1.split(",");
                    String srcCandidate = null;
                    String dstCandidate = null;
                    for (int i = 0; i < cols.length; i++) {
                        String c = cols[i].trim().toLowerCase();
                        if (c.equals("src") || c.equals("src_ip")) srcCandidate = vals[i].trim();
                        if (c.equals("dst") || c.equals("dst_ip")) dstCandidate = vals[i].trim();
                    }
                    if (srcCandidate != null) {
                        response.getBody().put("src_ip", srcCandidate);
                        response.getBody().put("src_location", simulateLocation(srcCandidate));
                    }
                    if (dstCandidate != null) {
                        response.getBody().put("dst_ip", dstCandidate);
                        response.getBody().put("dst_location", simulateLocation(dstCandidate));
                    }
                }
            } catch (Exception ignored) {}
            // Save to history as well so Live Map and Intelligence can use it
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
                Object src = response.getBody().get("src_ip");
                Object dst = response.getBody().get("dst_ip");
                if (src != null) h.setSrcIp(src.toString());
                if (dst != null) h.setDstIp(dst.toString());
                if (auth != null && auth.startsWith("Bearer ")) {
                    try {
                        Claims c = jwtUtil.parse(auth.substring(7));
                        Long uid = c.get("uid", Long.class);
                        h.setUserId(uid);
                    } catch (Exception ignored) {}
                }
                historyRepo.save(h);
            }
            return response;
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Gatekeeper Error: " + e.getMessage());
        }
    }

    @PostMapping("/analyze-manual")
    public ResponseEntity<?> analyzeManual(@RequestBody Map<String, Object> payload) {
        try {
            RestTemplate rt = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> req = new HttpEntity<>(payload, headers);
            ResponseEntity<Map> response = rt.postForEntity(aiBase + "/analyze-manual", req, Map.class);
            return response;
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Gatekeeper Error: " + e.getMessage());
        }
    }


    @GetMapping("/history")
    public ResponseEntity<?> history(@RequestHeader(value="Authorization", required=false) String auth) {
        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                Claims c = jwtUtil.parse(auth.substring(7));
                Long uid = c.get("uid", Long.class);
                return ResponseEntity.ok(historyRepo.findByUserId(uid));
            } catch (Exception ignored) {}
        }
        return ResponseEntity.ok(historyRepo.findAll());
    }

    @GetMapping("/geo")
    public ResponseEntity<?> geo(@RequestParam String ip) {
        // Simple simulation mapping to major cities
        String[] cities = {"London", "New York", "Tokyo", "Singapore", "Frankfurt", "Sydney", "Bengaluru"};
        double[][] coords = {
            {51.5074, -0.1278}, {40.7128, -74.0060}, {35.6762, 139.6503},
            {1.3521, 103.8198}, {50.1109, 8.6821}, {-33.8688, 151.2093}, {12.9716, 77.5946}
        };
        int hash = Math.abs(ip.hashCode());
        int idx = hash % cities.length;
        return ResponseEntity.ok(Map.of(
            "ip", ip,
            "city", cities[idx],
            "lat", coords[idx][0],
            "lng", coords[idx][1]
        ));
    }

    private Map<String, Double> simulateLocation(String ip) {
        double[][] coords = {
            {40.7128, -74.0060},
            {51.5074, -0.1278},
            {35.6762, 139.6503},
            {28.6139, 77.2090},
            {1.3521, 103.8198},
            {50.1109, 8.6821},
            {-33.8688, 151.2093},
            {12.9716, 77.5946}
        };
        int idx = Math.abs(ip.hashCode()) % coords.length;
        Map<String, Double> m = new HashMap<>();
        m.put("lat", coords[idx][0]);
        m.put("lng", coords[idx][1]);
        return m;
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of("status", "up", "bridge", "Gatekeeper"));
    }

    @PostMapping("/agent")
    public ResponseEntity<?> agent(@RequestBody Map<String, String> payload) {
        String prompt = payload.getOrDefault("prompt", "");
        Pattern ipPattern = Pattern.compile("(\\d{1,3}(?:\\.\\d{1,3}){3})");
        Matcher m = ipPattern.matcher(prompt);
        java.util.List<AnalysisHistory> rows = java.util.Collections.emptyList();
        String ip = null;
        if (m.find()) {
            ip = m.group(1);
            java.util.List<AnalysisHistory> a = historyRepo.findBySrcIp(ip);
            java.util.List<AnalysisHistory> b = historyRepo.findByDstIp(ip);
            rows = new java.util.ArrayList<>();
            rows.addAll(a);
            rows.addAll(b);
        } else {
            rows = historyRepo.findAll();
        }
        int total = rows.size();
        int attacks = 0;
        double sumConf = 0.0;
        for (AnalysisHistory h : rows) {
            if ("Attack".equalsIgnoreCase(h.getResult())) attacks++;
            if (h.getConfidence() != null) sumConf += h.getConfidence();
        }
        double avgConf = total > 0 ? sumConf / total : 0.0;
        String risk = attacks > 0 ? (avgConf > 0.7 ? "Critical" : "Elevated") : "Low";
        String summary = (ip != null ? ("Incidents involving " + ip + ". ") : "Global incident summary. ")
                + "Total: " + total + ", Attacks: " + attacks + ", Avg confidence: " + String.format("%.2f", avgConf);
        String next = attacks > 0 ? "Suggest immediate IP rate-limiting and block offending flows." : "No immediate action required; continue monitoring.";
        return ResponseEntity.ok(Map.of(
                "summary", summary,
                "riskLevel", risk,
                "nextSteps", next
        ));
    }

    @PostMapping("/auth/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, String> payload) {
        String username = payload.getOrDefault("username", "").trim();
        String email = payload.getOrDefault("email", "").trim();
        String password = payload.getOrDefault("password", "");
        if (username.isEmpty() || email.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body("All fields are required.");
        }
        if (usersRepo.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body("Username already exists.");
        }
        if (usersRepo.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body("Email already exists.");
        }
        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(password));
        usersRepo.save(u);
        String token = jwtUtil.generateToken(u.getId(), u.getUsername());
        return ResponseEntity.ok(Map.of("token", token, "user", Map.of("id", u.getId(), "username", u.getUsername(), "email", u.getEmail())));
    }

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {
        String login = payload.getOrDefault("username", "").trim();
        String password = payload.getOrDefault("password", "");
        Optional<User> maybe = usersRepo.findByUsername(login);
        if (maybe.isEmpty()) maybe = usersRepo.findByEmail(login);
        if (maybe.isEmpty()) return ResponseEntity.status(401).body("Invalid credentials.");
        User u = maybe.get();
        if (!encoder.matches(password, u.getPasswordHash())) return ResponseEntity.status(401).body("Invalid credentials.");
        String token = jwtUtil.generateToken(u.getId(), u.getUsername());
        return ResponseEntity.ok(Map.of("token", token, "user", Map.of("id", u.getId(), "username", u.getUsername(), "email", u.getEmail())));
    }
}
