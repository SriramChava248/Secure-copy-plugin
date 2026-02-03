package com.secureclipboard.filter;

import com.secureclipboard.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        // Skip filter for public endpoints
        String requestPath = request.getRequestURI();
        if (isPublicEndpoint(requestPath)) {
            filterChain.doFilter(request, response);
            return;
        }

        // Extract token from Authorization header
        String token = extractToken(request);

        if (token == null) {
            log.debug("No token found in request: {}", requestPath);
            filterChain.doFilter(request, response);
            return;
        }

        try {
            // Step 1: Check if token is blacklisted
            if (jwtService.isTokenBlacklisted(token)) {
                log.warn("Blacklisted token attempted: {}", requestPath);
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.getWriter().write("{\"error\":\"Token has been revoked\"}");
                return;
            }

            // Step 2: Validate token (signature + expiration)
            if (!jwtService.validateToken(token)) {
                log.debug("Invalid token: {}", requestPath);
                filterChain.doFilter(request, response);
                return;
            }

            // Step 3: Extract claims from token
            Long userId = jwtService.extractUserId(token);
            String email = jwtService.extractEmail(token);
            String role = jwtService.extractRole(token);

            // Step 4: Create authentication object
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                userId,  // Principal (user ID)
                null,     // Credentials (not needed for JWT)
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + role))
            );

            // Set request details
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

            // Step 5: Set authentication in SecurityContext
            SecurityContextHolder.getContext().setAuthentication(authentication);

            log.debug("Authentication set for user: {} (ID: {})", email, userId);

        } catch (Exception e) {
            log.error("Error processing JWT token: {}", e.getMessage());
            // Continue filter chain - let Spring Security handle unauthorized access
        }

        // Continue filter chain
        filterChain.doFilter(request, response);
    }

    /**
     * Extract JWT token from Authorization header
     * Format: "Bearer <token>"
     */
    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader(AUTHORIZATION_HEADER);

        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return null;
        }

        return authHeader.substring(BEARER_PREFIX.length());
    }

    /**
     * Check if endpoint is public (doesn't require authentication)
     */
    private boolean isPublicEndpoint(String path) {
        return path.startsWith("/api/v1/auth/") || 
               path.startsWith("/actuator/health");
    }
}


