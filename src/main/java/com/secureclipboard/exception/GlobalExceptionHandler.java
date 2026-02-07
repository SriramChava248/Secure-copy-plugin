package com.secureclipboard.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;
import com.fasterxml.jackson.core.exc.StreamConstraintsException;
import com.fasterxml.jackson.databind.JsonMappingException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Global exception handler for consistent error responses
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /**
     * Handle validation errors
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationErrors(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Validation Failed")
                .message("Invalid input data")
                .details(errors)
                .build();
        
        log.debug("Validation error: {}", errors);
        return ResponseEntity.badRequest().body(errorResponse);
    }

    /**
     * Handle snippet limit exceeded exceptions
     */
    @ExceptionHandler(com.secureclipboard.exception.SnippetLimitExceededException.class)
    public ResponseEntity<ErrorResponse> handleSnippetLimitExceededException(
            com.secureclipboard.exception.SnippetLimitExceededException ex) {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Snippet Limit Exceeded")
                .message(ex.getMessage())
                .build();
        
        log.info("Snippet limit exceeded for user: {} snippets (max: {})", 
            ex.getCurrentCount(), ex.getMaxLimit());
        return ResponseEntity.badRequest().body(errorResponse);
    }

    /**
     * Handle illegal argument exceptions (e.g., invalid input)
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgumentException(IllegalArgumentException ex) {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Bad Request")
                .message(ex.getMessage())
                .build();
        
        log.debug("Illegal argument: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(errorResponse);
    }

    /**
     * Handle authentication exceptions
     */
    @ExceptionHandler({AuthenticationException.class, BadCredentialsException.class})
    public ResponseEntity<ErrorResponse> handleAuthenticationException(AuthenticationException ex) {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.UNAUTHORIZED.value())
                .error("Unauthorized")
                .message("Authentication failed: " + ex.getMessage())
                .build();
        
        log.debug("Authentication error: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
    }

    /**
     * Handle access denied exceptions
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDeniedException(AccessDeniedException ex) {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.FORBIDDEN.value())
                .error("Forbidden")
                .message("Access denied: " + ex.getMessage())
                .build();
        
        log.debug("Access denied: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
    }

    /**
     * Handle security exceptions
     */
    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<ErrorResponse> handleSecurityException(SecurityException ex) {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.UNAUTHORIZED.value())
                .error("Security Error")
                .message(ex.getMessage())
                .build();
        
        log.warn("Security exception: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
    }

    /**
     * Handle HTTP message not readable exceptions (e.g., JSON parsing errors, size limits)
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleHttpMessageNotReadableException(HttpMessageNotReadableException ex) {
        String errorMessage = "Invalid request body";
        
        // Extract actual error from nested exceptions
        Throwable cause = ex.getCause();
        if (cause != null) {
            if (cause instanceof StreamConstraintsException) {
                // Jackson string length limit exceeded
                StreamConstraintsException streamEx = (StreamConstraintsException) cause;
                String msg = streamEx.getMessage();
                // Extract size information from message like "String length (20054016) exceeds the maximum length (20000000)"
                if (msg != null && msg.contains("exceeds the maximum length")) {
                    errorMessage = "Content size exceeds maximum limit (20MB). " + msg;
                } else {
                    errorMessage = "Content size exceeds maximum limit (20MB)";
                }
            } else if (cause instanceof JsonMappingException) {
                // JSON mapping error - try to extract meaningful message
                JsonMappingException jsonEx = (JsonMappingException) cause;
                Throwable jsonCause = jsonEx.getCause();
                if (jsonCause instanceof StreamConstraintsException) {
                    StreamConstraintsException streamEx = (StreamConstraintsException) jsonCause;
                    String msg = streamEx.getMessage();
                    if (msg != null && msg.contains("exceeds the maximum length")) {
                        errorMessage = "Content size exceeds maximum limit (20MB). " + msg;
                    } else {
                        errorMessage = "Content size exceeds maximum limit (20MB)";
                    }
                } else {
                    errorMessage = jsonEx.getOriginalMessage() != null ? 
                        jsonEx.getOriginalMessage() : jsonEx.getMessage();
                }
            } else {
                // Use cause message if available
                String causeMsg = cause.getMessage();
                if (causeMsg != null && causeMsg.contains("exceeds the maximum length")) {
                    errorMessage = "Content size exceeds maximum limit (20MB). " + causeMsg;
                } else {
                    errorMessage = causeMsg != null ? causeMsg : ex.getMessage();
                }
            }
        }
        
        // Fallback to exception message if no specific cause found
        if (errorMessage == null || errorMessage.equals("Invalid request body")) {
            String exMsg = ex.getMessage();
            if (exMsg != null && exMsg.contains("exceeds the maximum length")) {
                errorMessage = "Content size exceeds maximum limit (20MB). " + exMsg;
            } else {
                errorMessage = exMsg != null ? exMsg : "Invalid request body";
            }
        }
        
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.BAD_REQUEST.value())
                .error("Invalid Request")
                .message(errorMessage)
                .build();
        
        log.debug("HTTP message not readable: {}", errorMessage);
        return ResponseEntity.badRequest().body(errorResponse);
    }

    /**
     * Handle runtime exceptions (e.g., not found, duplicate content)
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntimeException(RuntimeException ex) {
        String message = ex.getMessage();
        
        // Check if it's a duplicate content exception
        if (message != null && message.contains("Duplicate content")) {
            ErrorResponse errorResponse = ErrorResponse.builder()
                    .timestamp(LocalDateTime.now())
                    .status(HttpStatus.CONFLICT.value())
                    .error("Duplicate Content")
                    .message("This snippet already exists")
                    .build();
            
            log.debug("Duplicate content detected: {}", message);
            return ResponseEntity.status(HttpStatus.CONFLICT).body(errorResponse);
        }
        
        // Check if it's a "not found" type exception
        if (message != null && message.contains("not found")) {
            ErrorResponse errorResponse = ErrorResponse.builder()
                    .timestamp(LocalDateTime.now())
                    .status(HttpStatus.NOT_FOUND.value())
                    .error("Not Found")
                    .message(message)
                    .build();
            
            log.debug("Resource not found: {}", message);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        }
        
        // Generic runtime exception
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
                .error("Internal Server Error")
                .message("An unexpected error occurred")
                .build();
        
        log.error("Runtime exception: {}", message, ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }

    /**
     * Handle all other exceptions
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        ErrorResponse errorResponse = ErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(HttpStatus.INTERNAL_SERVER_ERROR.value())
                .error("Internal Server Error")
                .message("An unexpected error occurred")
                .build();
        
        log.error("Unexpected exception: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }

    /**
     * Error response DTO
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ErrorResponse {
        private LocalDateTime timestamp;
        private int status;
        private String error;
        private String message;
        private Map<String, String> details;
    }
}


