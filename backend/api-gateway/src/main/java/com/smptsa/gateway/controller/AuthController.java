package com.smptsa.gateway.controller;

import com.smptsa.gateway.model.User;
import com.smptsa.gateway.repository.UserRepository;
import com.smptsa.gateway.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Authentication controller — handles login and registration with DB persistence.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;

    /**
     * POST /api/auth/login
     *
     * Looks up the user in the database and validates the password.
     * Returns a JWT access token on success.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");

        if (username == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password required"));
        }

        return userRepository.findByUsername(username)
                .map(user -> {
                    if (passwordEncoder.matches(password, user.getPasswordHash())) {
                        String token = jwtUtil.generateToken(username);
                        log.info("User '{}' authenticated successfully", username);

                        return ResponseEntity.ok(Map.of(
                            "access_token", token,
                            "token_type", "Bearer",
                            "expires_in", 86400,
                            "username", username
                        ));
                    } else {
                        log.warn("Invalid password for user '{}'", username);
                        return ResponseEntity.status(401).body(Map.of(
                            "error", "Invalid credentials"
                        ));
                    }
                })
                .orElseGet(() -> {
                    log.warn("User '{}' not found", username);
                    return ResponseEntity.status(401).body(Map.of(
                        "error", "Invalid credentials"
                    ));
                });
    }

    /**
     * POST /api/auth/register
     *
     * Creates a new user account with a hashed password.
     * Returns a JWT token so the user is immediately logged in.
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        if (username == null || username.trim().isEmpty()
                || password == null || password.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Username and password required"
            ));
        }

        if (username.length() < 3 || username.length() > 100) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Username must be between 3 and 100 characters"
            ));
        }

        if (password.length() < 6) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "Password must be at least 6 characters"
            ));
        }

        if (userRepository.existsByUsername(username)) {
            return ResponseEntity.status(409).body(Map.of(
                "error", "Username already taken"
            ));
        }

        User user = User.builder()
                .username(username.trim())
                .passwordHash(passwordEncoder.encode(password))
                .role("USER")
                .build();

        userRepository.save(user);
        log.info("New user registered: '{}'", username);

        String token = jwtUtil.generateToken(username);
        return ResponseEntity.ok(Map.of(
            "access_token", token,
            "token_type", "Bearer",
            "expires_in", 86400,
            "username", username
        ));
    }
}
