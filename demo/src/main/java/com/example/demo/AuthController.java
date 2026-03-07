package com.example.demo;

import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired private UserRepository users;
    @Autowired private PasswordEncoder encoder;
    @Autowired private JwtUtil jwt;

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, String> payload) {
        String username = payload.getOrDefault("username", "").trim();
        String email = payload.getOrDefault("email", "").trim();
        String password = payload.getOrDefault("password", "");
        if (username.isEmpty() || email.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body("All fields are required.");
        }
        if (users.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body("Username already exists.");
        }
        if (users.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body("Email already exists.");
        }
        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(password));
        users.save(u);
        String token = jwt.generateToken(u.getId(), u.getUsername());
        return ResponseEntity.ok(Map.of("token", token, "user", Map.of("id", u.getId(), "username", u.getUsername(), "email", u.getEmail())));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {
        String login = payload.getOrDefault("username", "").trim();
        String password = payload.getOrDefault("password", "");
        Optional<User> maybe = users.findByUsername(login);
        if (maybe.isEmpty()) maybe = users.findByEmail(login);
        if (maybe.isEmpty()) return ResponseEntity.status(401).body("Invalid credentials.");
        User u = maybe.get();
        if (!encoder.matches(password, u.getPasswordHash())) return ResponseEntity.status(401).body("Invalid credentials.");
        String token = jwt.generateToken(u.getId(), u.getUsername());
        return ResponseEntity.ok(Map.of("token", token, "user", Map.of("id", u.getId(), "username", u.getUsername(), "email", u.getEmail())));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader(value="Authorization", required=false) String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) return ResponseEntity.status(401).body("Missing token.");
        String token = auth.substring(7);
        Claims c = jwt.parse(token);
        Long uid = c.get("uid", Long.class);
        Optional<User> maybe = users.findById(uid);
        if (maybe.isEmpty()) return ResponseEntity.status(401).body("Invalid token.");
        User u = maybe.get();
        return ResponseEntity.ok(Map.of("id", u.getId(), "username", u.getUsername(), "email", u.getEmail()));
    }

    @GetMapping("/ping")
    public ResponseEntity<?> ping() {
        return ResponseEntity.ok(Map.of("auth", "ready"));
    }
}
