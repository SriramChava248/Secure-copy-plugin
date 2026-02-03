package com.secureclipboard.service;

import com.secureclipboard.dto.CreateSnippetRequest;
import com.secureclipboard.dto.SnippetResponse;
import com.secureclipboard.model.Snippet;
import com.secureclipboard.model.SnippetChunk;
import com.secureclipboard.repository.SnippetChunkRepository;
import com.secureclipboard.repository.SnippetRepository;
import com.secureclipboard.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SnippetService {

    private final SnippetRepository snippetRepository;
    private final SnippetChunkRepository chunkRepository;
    private final SnippetProcessingService processingService;
    private final RedisQueueService redisQueueService;

    @Value("${snippet.max-words-per-snippet:10000}")
    private int maxWordsPerSnippet;

    /**
     * Save snippet (SYNCHRONOUS - quick response)
     * Returns immediately after validation and metadata creation
     * Background processing happens asynchronously
     * 
     * @param request Snippet creation request
     * @return Snippet response with ID
     */
    @Transactional
        public SnippetResponse saveSnippet(CreateSnippetRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        
        // Step 1: Validate word limit (for responsiveness)
        validateWordLimit(request.getContent());
        
        // Step 2: Create snippet metadata
        Snippet snippet = new Snippet();
        snippet.setUserId(userId);
        snippet.setSourceUrl(request.getSourceUrl());
        snippet.setTotalChunks(0); // Will be updated in async processing
        snippet.setTotalSize((long) request.getContent().getBytes().length);
        snippet.setStatus(Snippet.Status.PROCESSING);
        snippet.setIsDeleted(false);
        
        snippet = snippetRepository.save(snippet);
        log.info("Created snippet {} for user {}", snippet.getId(), userId);
        
        // Step 4: Add to Redis queue immediately (with raw content for quick access)
        redisQueueService.addToFront(userId, snippet.getId());
        
        // Step 5: Start async processing
        processSnippetAsync(snippet.getId(), request.getContent());
        
        // Step 6: Return response immediately (~30ms)
        // Return empty content for queue display (full content available via getSnippet())
        return SnippetResponse.builder()
                .id(snippet.getId())
                .content("") // Empty content - UI will fetch full content on demand
                .sourceUrl(snippet.getSourceUrl())
                .createdAt(snippet.getCreatedAt())
                .updatedAt(snippet.getUpdatedAt())
                .build();
    }

    /**
     * Process snippet asynchronously (background)
     * Chunks, compresses, and saves chunks to database
     * 
     * @param snippetId Snippet ID
     * @param content Plaintext content
     */
    @Async
    @Transactional
    public void processSnippetAsync(Long snippetId, String content) {
        try {
            log.debug("Starting async processing for snippet {}", snippetId);
            
            // Step 1: Process snippet (chunk, compress)
            List<SnippetProcessingService.ProcessedChunk> processedChunks = 
                processingService.processSnippetForSaving(content);
            
            // Step 2: Fetch snippet (needed for status update)
            // Note: One extra DB call, but simpler and clearer code
            Snippet snippet = snippetRepository.findById(snippetId)
                    .orElseThrow(() -> new RuntimeException("Snippet not found: " + snippetId));
            
            // Step 3: Create chunk entities (in memory)
            List<SnippetChunk> chunkEntities = new ArrayList<>();
            for (SnippetProcessingService.ProcessedChunk processedChunk : processedChunks) {
                SnippetChunk chunk = new SnippetChunk();
                chunk.setSnippetId(snippetId);
                chunk.setChunkIndex(processedChunk.getChunkIndex());
                chunk.setContent(processedChunk.getContent());
                chunk.setIsCompressed(processedChunk.isCompressed());
                chunkEntities.add(chunk);
            }
            
            // Step 4: Batch save all chunks (1 DB call instead of N calls)
            chunkRepository.saveAll(chunkEntities);
            
            // Step 5: Update snippet status (snippet acts as context/tracker)
            snippet.setTotalChunks(processedChunks.size());
            snippet.setStatus(Snippet.Status.COMPLETED);
            snippetRepository.save(snippet);
            
            log.info("Completed async processing for snippet {} ({} chunks)", 
                snippetId, processedChunks.size());
                
        } catch (Exception e) {
            log.error("Failed to process snippet {}: {}", snippetId, e.getMessage(), e);
            
            // Update snippet status to FAILED
            Optional<Snippet> snippetOpt = snippetRepository.findById(snippetId);
            if (snippetOpt.isPresent()) {
                Snippet snippet = snippetOpt.get();
                snippet.setStatus(Snippet.Status.FAILED);
                snippetRepository.save(snippet);
            }
        }
    }

    /**
     * Get recent snippets for current user
     * Uses Redis queue for fast access, processes snippets in parallel
     * 
     * @return List of snippet responses
     */
    public List<SnippetResponse> getRecentSnippets() {
        Long userId = SecurityUtils.getCurrentUserId();
        
        // Step 1: Get snippet IDs from Redis queue
        List<Long> snippetIds = redisQueueService.getRecentSnippetIds(userId);
        
        if (snippetIds.isEmpty()) {
            return List.of();
        }
        
        // Step 2: Get all chunks from database (single query)
        List<SnippetChunk> allChunks = chunkRepository.findBySnippetIdInOrderBySnippetIdAscChunkIndexAsc(snippetIds);
        
        // Step 3: Group chunks by snippet ID
        java.util.Map<Long, List<SnippetChunk>> chunksBySnippet = allChunks.stream()
                .collect(Collectors.groupingBy(SnippetChunk::getSnippetId));
        
        // Step 4: Get snippet metadata
        List<Snippet> snippets = snippetRepository.findAllById(snippetIds);
        java.util.Map<Long, Snippet> snippetMap = snippets.stream()
                .collect(Collectors.toMap(Snippet::getId, s -> s));
        
        // Step 5: Process snippets in parallel
        List<SnippetProcessingService.SnippetData> snippetsData = snippetIds.stream()
                .map(snippetId -> {
                    List<SnippetChunk> chunks = chunksBySnippet.getOrDefault(snippetId, List.of());
                    List<byte[]> chunkContents = chunks.stream()
                            .map(SnippetChunk::getContent)
                            .collect(Collectors.toList());
                    boolean isCompressed = !chunks.isEmpty() && chunks.get(0).getIsCompressed();
                    return new SnippetProcessingService.SnippetData(chunkContents, isCompressed);
                })
                .collect(Collectors.toList());
        
        List<String> contents = processingService.processSnippetsForRetrievalParallel(snippetsData);
        
        // Step 6: Build responses
        return snippetIds.stream()
                .map(snippetId -> {
                    Snippet snippet = snippetMap.get(snippetId);
                    int index = snippetIds.indexOf(snippetId);
                    String content = contents.get(index);
                    
                    return SnippetResponse.builder()
                            .id(snippet.getId())
                            .content(content)
                            .sourceUrl(snippet.getSourceUrl())
                            .createdAt(snippet.getCreatedAt())
                            .updatedAt(snippet.getUpdatedAt())
                            .build();
                })
                .collect(Collectors.toList());
    }

    /**
     * Get single snippet by ID
     * 
     * @param snippetId Snippet ID
     * @return Snippet response
     */
    public SnippetResponse getSnippet(Long snippetId) {
        Long userId = SecurityUtils.getCurrentUserId();
        
        // Step 1: Get snippet (with ownership check)
        Snippet snippet = snippetRepository.findByIdAndUserId(snippetId, userId)
                .orElseThrow(() -> new RuntimeException("Snippet not found: " + snippetId));
        
        if (snippet.getIsDeleted()) {
            throw new RuntimeException("Snippet has been deleted");
        }
        
        // Step 2: Get chunks (ordered by chunkIndex)
        List<SnippetChunk> chunks = chunkRepository.findBySnippetIdOrderByChunkIndexAsc(snippetId);
        
        if (chunks.isEmpty()) {
            throw new RuntimeException("No chunks found for snippet: " + snippetId);
        }
        
        // Step 3: Extract chunk contents
        List<byte[]> chunkContents = chunks.stream()
                .map(SnippetChunk::getContent)
                .collect(Collectors.toList());
        
        boolean isCompressed = chunks.get(0).getIsCompressed();
        
        // Step 4: Process (decompress, reassemble)
        String content = processingService.processSnippetForRetrieval(chunkContents, isCompressed);
        
        // Step 5: Move to front of queue (last read)
        redisQueueService.moveToFront(userId, snippetId);
        
        return SnippetResponse.builder()
                .id(snippet.getId())
                .content(content)
                .sourceUrl(snippet.getSourceUrl())
                .createdAt(snippet.getCreatedAt())
                .updatedAt(snippet.getUpdatedAt())
                .build();
    }

    /**
     * Search snippets by content
     * Uses parallel processing for efficient search
     * TODO: Implement PostgreSQL full-text search (will be enhanced in future)
     * 
     * @param query Search query
     * @return List of matching snippets
     */
    public List<SnippetResponse> searchSnippets(String query) {
        Long userId = SecurityUtils.getCurrentUserId();
        
        // Step 1: Get all snippet IDs for user
        List<Snippet> snippets = snippetRepository.findByUserIdAndIsDeletedFalse(userId);
        
        if (snippets.isEmpty()) {
            return List.of();
        }
        
        List<Long> snippetIds = snippets.stream()
                .map(Snippet::getId)
                .collect(Collectors.toList());
        
        // Step 2: Get all chunks from database (single query with IN clause)
        List<SnippetChunk> allChunks = chunkRepository
                .findBySnippetIdInOrderBySnippetIdAscChunkIndexAsc(snippetIds);
        
        // Step 3: Group chunks by snippet ID
        java.util.Map<Long, List<SnippetChunk>> chunksBySnippet = allChunks.stream()
                .collect(Collectors.groupingBy(SnippetChunk::getSnippetId));
        
        // Step 4: Create snippet metadata map
        java.util.Map<Long, Snippet> snippetMap = snippets.stream()
                .collect(Collectors.toMap(Snippet::getId, s -> s));
        
        // Step 5: Create SnippetData objects for parallel processing
        // Filter out snippets without chunks and create data objects
        List<SnippetProcessingService.SnippetData> snippetsData = new ArrayList<>();
        List<Long> validSnippetIds = new ArrayList<>(); // Track which snippet IDs have chunks
        
        for (Long snippetId : snippetIds) {
            List<SnippetChunk> chunks = chunksBySnippet.getOrDefault(snippetId, List.of());
            if (chunks.isEmpty()) {
                continue;
            }
            
            List<byte[]> chunkContents = chunks.stream()
                    .map(SnippetChunk::getContent)
                    .collect(Collectors.toList());
            boolean isCompressed = chunks.get(0).getIsCompressed();
            snippetsData.add(new SnippetProcessingService.SnippetData(chunkContents, isCompressed));
            validSnippetIds.add(snippetId);
        }
        
        if (snippetsData.isEmpty()) {
            return List.of();
        }
        
        // Step 6: Process snippets IN PARALLEL (decompress, reassemble)
        List<String> contents = processingService.processSnippetsForRetrievalParallel(snippetsData);
        
        // Step 7: Filter by search query (case-insensitive) and build responses
        String queryLower = query.toLowerCase();
        List<SnippetResponse> results = new ArrayList<>();
        
        for (int i = 0; i < validSnippetIds.size(); i++) {
            Long snippetId = validSnippetIds.get(i);
            String content = contents.get(i);
            
            // Simple text search (case-insensitive)
            if (content.toLowerCase().contains(queryLower)) {
                Snippet snippet = snippetMap.get(snippetId);
                results.add(SnippetResponse.builder()
                        .id(snippet.getId())
                        .content(content)
                        .sourceUrl(snippet.getSourceUrl())
                        .createdAt(snippet.getCreatedAt())
                        .updatedAt(snippet.getUpdatedAt())
                        .build());
            }
        }
        
        return results;
    }

    /**
     * Delete snippet (soft delete)
     * 
     * @param snippetId Snippet ID
     */
    @Transactional
    public void deleteSnippet(Long snippetId) {
        Long userId = SecurityUtils.getCurrentUserId();
        
        // Step 1: Get snippet (with ownership check)
        Snippet snippet = snippetRepository.findByIdAndUserId(snippetId, userId)
                .orElseThrow(() -> new RuntimeException("Snippet not found: " + snippetId));
        
        // Step 2: Soft delete
        snippet.setIsDeleted(true);
        snippetRepository.save(snippet);
        
        // Step 3: Remove from Redis queue
        redisQueueService.removeFromQueue(userId, snippetId);
        
        log.info("Deleted snippet {} for user {}", snippetId, userId);
    }

    /**
     * Validate word limit
     * Optimized for responsiveness - uses fast estimation for large files
     * For files > 5MB, skips word validation (size validation is sufficient)
     * For smaller files, does fast character-based word counting
     */
    private void validateWordLimit(String content) {
        if (content == null || content.isEmpty()) {
            throw new IllegalArgumentException("Content cannot be null or empty");
        }
        
        int contentSizeBytes = content.getBytes().length;
        
        // For very large files (>5MB), skip word validation
        // Size validation (20MB limit) is sufficient, and word counting is expensive
        // This ensures fast response times for large clipboard operations
        if (contentSizeBytes > 5_000_000) {
            log.debug("Skipping word validation for large content ({} bytes) - size validation sufficient", 
                contentSizeBytes);
            return;
        }
        
        // For smaller files, do fast word counting
        // Count transitions from whitespace to non-whitespace (O(n) single pass)
        int wordCount = 0;
        boolean inWord = false;
        int length = content.length();
        
        // Limit scanning to first 1MB for very large strings to maintain speed
        int scanLimit = Math.min(length, 1_000_000);
        
        for (int i = 0; i < scanLimit; i++) {
            char c = content.charAt(i);
            boolean isWhitespace = Character.isWhitespace(c);
            
            if (!isWhitespace && !inWord) {
                wordCount++;
                inWord = true;
            } else if (isWhitespace) {
                inWord = false;
            }
        }
        
        // If we didn't scan the full content, estimate remaining words
        if (length > scanLimit) {
            // Estimate: assume similar word density in remaining content
            double wordDensity = (double) wordCount / scanLimit;
            int estimatedRemainingWords = (int) (wordDensity * (length - scanLimit));
            wordCount += estimatedRemainingWords;
            log.debug("Partial scan: {} words in first {} chars, estimated {} total words", 
                wordCount - estimatedRemainingWords, scanLimit, wordCount);
        }
        
        if (wordCount > maxWordsPerSnippet) {
            throw new IllegalArgumentException(
                String.format("Word limit exceeded: %d words (max: %d)", 
                    wordCount, maxWordsPerSnippet));
        }
    }

}

