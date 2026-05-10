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

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> payload) {
        String username = payload.getOrDefault("username", "").trim();
        String email = payload.getOrDefault("email", "").trim();
        String password = payload.getOrDefault("password", "");
        if (username.isEmpty() || email.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("detail", "All fields are required."));
        }
        if (users.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Username already exists."));
        }
        if (users.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Email already exists."));
        }
        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setPassword(encoder.encode(password));
        users.save(u);
        String token = jwt.generateToken(u.getId(), u.getUsername());
        return ResponseEntity.ok(Map.of("message", "User registered successfully", "token", token, "user", Map.of("id", u.getId(), "username", u.getUsername(), "email", u.getEmail())));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {
        String login = payload.getOrDefault("username", "").trim();
        String password = payload.getOrDefault("password", "");
        Optional<User> maybe = users.findByUsername(login);
        if (maybe.isEmpty()) maybe = users.findByEmail(login);
        if (maybe.isEmpty()) return ResponseEntity.status(401).body(Map.of("detail", "Invalid credentials."));
        User u = maybe.get();
        if (!encoder.matches(password, u.getPassword())) return ResponseEntity.status(401).body(Map.of("detail", "Invalid credentials."));
        String token = jwt.generateToken(u.getId(), u.getUsername());
        return ResponseEntity.ok(Map.of("token", token, "username", u.getUsername(), "role", u.getRole()));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader(value="Authorization", required=false) String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) return ResponseEntity.status(401).body(Map.of("detail", "Missing token."));
        String token = auth.substring(7);
        try {
            Claims c = jwt.parse(token);
            Long uid = c.get("uid", Long.class);
            if (uid == null) return ResponseEntity.status(401).body(Map.of("detail", "Invalid token payload."));
            
            Optional<User> maybe = users.findById(uid);
            if (maybe.isEmpty()) return ResponseEntity.status(401).body(Map.of("detail", "User no longer exists."));
            
            User u = maybe.get();
            return ResponseEntity.ok(Map.of("id", u.getId(), "username", u.getUsername(), "email", u.getEmail()));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("detail", "Token expired or invalid."));
        }
    }

    @GetMapping("/ping")
    public ResponseEntity<?> ping() {
        return ResponseEntity.ok(Map.of("auth", "ready"));
    }
}
