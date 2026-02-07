package com.secureclipboard.controller;

import com.secureclipboard.dto.CreateSnippetRequest;
import com.secureclipboard.dto.SnippetResponse;
import com.secureclipboard.service.SnippetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for snippet operations
 * All endpoints require JWT authentication
 */
@RestController
@RequestMapping("/api/v1/snippets")
@RequiredArgsConstructor
@Slf4j
public class SnippetController {

    private final SnippetService snippetService;

    /**
     * Create a new snippet
     * POST /api/v1/snippets
     * 
     * @param request Snippet creation request (content, sourceUrl)
     * @return Created snippet response
     */
    @PostMapping
    public ResponseEntity<SnippetResponse> createSnippet(@Valid @RequestBody CreateSnippetRequest request) {
        log.debug("Creating snippet for user");
        SnippetResponse response = snippetService.saveSnippet(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Get recent snippets for current user
     * GET /api/v1/snippets
     * 
     * Returns snippets ordered by last read (from Redis queue)
     * 
     * @return List of recent snippets
     */
    @GetMapping
    public ResponseEntity<List<SnippetResponse>> getRecentSnippets() {
        log.debug("Getting recent snippets for user");
        List<SnippetResponse> snippets = snippetService.getRecentSnippets();
        return ResponseEntity.ok(snippets);
    }

    /**
     * Get snippet by ID
     * GET /api/v1/snippets/{id}
     * 
     * @param id Snippet ID
     * @return Snippet response
     */
    @GetMapping("/{id}")
    public ResponseEntity<SnippetResponse> getSnippet(@PathVariable Long id) {
        log.debug("Getting snippet {} for user", id);
        SnippetResponse snippet = snippetService.getSnippet(id);
        return ResponseEntity.ok(snippet);
    }

    /**
     * Search snippets by query
     * GET /api/v1/snippets/search?query=...
     * 
     * Searches through all user's snippets (in-memory search)
     * 
     * @param query Search query string
     * @return List of matching snippets
     */
    @GetMapping("/search")
    public ResponseEntity<List<SnippetResponse>> searchSnippets(@RequestParam String query) {
        log.debug("Searching snippets with query: {}", query);
        
        if (query == null || query.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        
        List<SnippetResponse> snippets = snippetService.searchSnippets(query.trim());
        return ResponseEntity.ok(snippets);
    }

    /**
     * Delete snippet by ID
     * DELETE /api/v1/snippets/{id}
     * 
     * Soft deletes the snippet (sets isDeleted flag)
     * Removes from Redis queue
     * 
     * @param id Snippet ID
     * @return 204 No Content
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSnippet(@PathVariable Long id) {
        log.debug("Deleting snippet {} for user", id);
        snippetService.deleteSnippet(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Update snippet access (move to top of queue)
     * POST /api/v1/snippets/{id}/access
     * 
     * Moves snippet to front of Redis queue when user accesses it
     * 
     * @param id Snippet ID
     * @return 204 No Content
     */
    @PostMapping("/{id}/access")
    public ResponseEntity<Void> updateSnippetAccess(@PathVariable Long id) {
        log.debug("Updating access for snippet {} for user", id);
        snippetService.updateSnippetAccess(id);
        return ResponseEntity.noContent().build();
    }
}


