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

@CrossOrigin(
        origins = "https://your-vercel-url.vercel.app",
        allowedHeaders = "*",
        methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE},
        allowCredentials = "true"
)
@RestController
@RequestMapping("/api/netshield")
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
            Optional.ofNullable(System.getenv("FASTAPI_BASE_URL"))
                    .orElse("http://localhost:8003");

    // ================= HEALTH =================

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of("status", "up", "bridge", "Gatekeeper"));
    }

    // ================= HISTORY =================

    @GetMapping("/history")
    public ResponseEntity<?> history(
            @RequestHeader(value = "Authorization", required = false) String auth) {

        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                Claims c = jwtUtil.parse(auth.substring(7));
                Long uid = c.get("uid", Long.class);
                return ResponseEntity.ok(historyRepo.findByUserId(uid));
            } catch (Exception ignored) {}
        }
        return ResponseEntity.ok(historyRepo.findAll());
    }

    // ================= GEO =================

    @GetMapping("/geo")
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

    @PostMapping("/analyze-file")
    public ResponseEntity<?> analyzeFile(
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = "Authorization", required = false) String auth) {

        try {

            RestTemplate rt = new RestTemplate();

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
                    rt.postForEntity(aiBase + "/analyze/sdn/ml", req, Map.class);

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
                        h.setUserId(uid);
                    } catch (Exception ignored) {}
                }

                historyRepo.save(h);
            }

            return response;

        } catch (Exception e) {
            return ResponseEntity.status(500)
                    .body("Gatekeeper Error: " + e.getMessage());
        }
    }

    // ================= AUTH =================

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

        return ResponseEntity.ok(Map.of(
                "token", token,
                "user", Map.of(
                        "id", u.getId(),
                        "username", u.getUsername(),
                        "email", u.getEmail()
                )
        ));
    }

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {

        String login = payload.getOrDefault("username", "").trim();
        String password = payload.getOrDefault("password", "");

        Optional<User> maybe = usersRepo.findByUsername(login);
        if (maybe.isEmpty()) maybe = usersRepo.findByEmail(login);

        if (maybe.isEmpty()) {
            return ResponseEntity.status(401).body("Invalid credentials.");
        }

        User u = maybe.get();

        if (!encoder.matches(password, u.getPasswordHash())) {
            return ResponseEntity.status(401).body("Invalid credentials.");
        }

        String token = jwtUtil.generateToken(u.getId(), u.getUsername());

        return ResponseEntity.ok(Map.of(
                "token", token,
                "user", Map.of(
                        "id", u.getId(),
                        "username", u.getUsername(),
                        "email", u.getEmail()
                )
        ));
    }
}