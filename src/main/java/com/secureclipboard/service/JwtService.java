package com.secureclipboard.service;

import com.secureclipboard.model.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class JwtService {

    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.access-token-expiration}")
    private long accessTokenExpiration;

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;

    private static final String TOKEN_TYPE_ACCESS = "ACCESS";
    private static final String TOKEN_TYPE_REFRESH = "REFRESH";
    private static final String BLACKLIST_KEY_PREFIX = "blacklist:token:";

    /**
     * Get signing key from secret
     */
    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * Generate access token (15 minutes)
     */
    public String generateAccessToken(User user) {
        return generateToken(user, TOKEN_TYPE_ACCESS, accessTokenExpiration);
    }

    /**
     * Generate refresh token (7 days)
     */
    public String generateRefreshToken(User user) {
        return generateToken(user, TOKEN_TYPE_REFRESH, refreshTokenExpiration);
    }

    /**
     * Generate JWT token with claims
     */
    private String generateToken(User user, String tokenType, long expiration) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expiration);

        Claims claims = Jwts.claims()
            .setSubject(user.getEmail())
            .setIssuedAt(now)
            .setExpiration(expiryDate);

        // Add custom claims
        claims.put("userId", user.getId());
        claims.put("role", user.getRole().name());
        claims.put("type", tokenType);

        return Jwts.builder()
            .setClaims(claims)
            .signWith(getSigningKey(), SignatureAlgorithm.HS256)
            .compact();
    }

    /**
     * Validate token (signature + expiration)
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token);
            return true;
        } catch (Exception e) {
            log.debug("Token validation failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Extract user ID from token
     */
    public Long extractUserId(String token) {
        Claims claims = extractClaims(token);
        return claims.get("userId", Long.class);
    }

    /**
     * Extract email from token
     */
    public String extractEmail(String token) {
        Claims claims = extractClaims(token);
        return claims.getSubject();
    }

    /**
     * Extract role from token
     */
    public String extractRole(String token) {
        Claims claims = extractClaims(token);
        return claims.get("role", String.class);
    }

    /**
     * Extract token type (ACCESS or REFRESH)
     */
    public String extractTokenType(String token) {
        Claims claims = extractClaims(token);
        return claims.get("type", String.class);
    }

    /**
     * Extract all claims from token
     */
    private Claims extractClaims(String token) {
        return Jwts.parserBuilder()
            .setSigningKey(getSigningKey())
            .build()
            .parseClaimsJws(token)
            .getBody();
    }

    /**
     * Check if token is blacklisted (revoked)
     */
    public boolean isTokenBlacklisted(String token) {
        String blacklistKey = BLACKLIST_KEY_PREFIX + token;
        Boolean exists = redisTemplate.hasKey(blacklistKey);
        return exists != null && exists;
    }

    /**
     * Blacklist token (add to Redis)
     * Used during logout
     */
    public void blacklistToken(String token) {
        String blacklistKey = BLACKLIST_KEY_PREFIX + token;
        
        try {
            // Get token expiration time
            Date expiration = extractExpiration(token);
            long ttl = expiration.getTime() - System.currentTimeMillis();
            
            if (ttl > 0) {
                // Store token in blacklist until it expires
                redisTemplate.opsForValue().set(blacklistKey, "revoked", ttl, TimeUnit.MILLISECONDS);
                log.debug("Token blacklisted: {}", blacklistKey);
            }
        } catch (Exception e) {
            // If token is invalid, still blacklist it (prevent reuse)
            // Set a default TTL of 15 minutes (access token lifetime)
            redisTemplate.opsForValue().set(blacklistKey, "revoked", 15, TimeUnit.MINUTES);
            log.warn("Token blacklisted with default TTL due to extraction error: {}", e.getMessage());
        }
    }

    /**
     * Extract expiration time from token
     */
    public Date extractExpiration(String token) {
        Claims claims = extractClaims(token);
        return claims.getExpiration();
    }
}

