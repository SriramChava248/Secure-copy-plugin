package com.secureclipboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * Service that orchestrates compression and chunking
 * Handles parallel processing for optimal performance
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SnippetProcessingService {

    private final ChunkingService chunkingService;
    private final CompressionService compressionService;

    /**
     * Custom thread pool for parallel processing
     * Limits concurrent threads to prevent thread starvation
     * Max 10 threads (reasonable for chunk processing)
     */
    private static final ExecutorService PROCESSING_EXECUTOR = 
        Executors.newFixedThreadPool(10, r -> {
            Thread t = new Thread(r, "snippet-processing");
            t.setDaemon(true); // Daemon thread (won't prevent JVM shutdown)
            return t;
        });

    /**
     * Result class for processed chunk data
     */
    public static class ProcessedChunk {
        private final int chunkIndex;
        private final byte[] content;
        private final boolean isCompressed;

        public ProcessedChunk(int chunkIndex, byte[] content, boolean isCompressed) {
            this.chunkIndex = chunkIndex;
            this.content = content;
            this.isCompressed = isCompressed;
        }

        public int getChunkIndex() {
            return chunkIndex;
        }

        public byte[] getContent() {
            return content;
        }

        public boolean isCompressed() {
            return isCompressed;
        }
    }

    /**
     * Process snippet for saving (forward pipeline)
     * Pipeline: Chunk → Compress
     * Processes chunks in parallel for optimal performance
     * 
     * @param content Plaintext snippet content
     * @return List of processed chunks (ordered by chunkIndex)
     */
    public List<ProcessedChunk> processSnippetForSaving(String content) {
        if (content == null || content.isEmpty()) {
            throw new IllegalArgumentException("Content cannot be null or empty");
        }

        log.debug("Processing snippet for saving (length: {} chars)", content.length());

        // Step 1: Chunk the content
        List<byte[]> chunks = chunkingService.chunkString(content);
        log.debug("Chunked content into {} chunks", chunks.size());

        // Step 2: Process chunks in parallel
        List<CompletableFuture<ProcessedChunk>> futures = new ArrayList<>();

        for (int i = 0; i < chunks.size(); i++) {
            final int chunkIndex = i;
            final byte[] chunk = chunks.get(i);

            CompletableFuture<ProcessedChunk> future = CompletableFuture.supplyAsync(() -> {
                try {
                    // Compress chunk
                    byte[] compressed = compressionService.compress(chunk);
                    log.debug("Chunk {} compressed ({} bytes, {}% reduction)", 
                        chunkIndex, compressed.length,
                        (100 - (compressed.length * 100 / chunk.length)));

                    return new ProcessedChunk(chunkIndex, compressed, true);
                } catch (Exception e) {
                    log.error("Failed to process chunk {}: {}", chunkIndex, e.getMessage(), e);
                    throw new RuntimeException("Failed to process chunk " + chunkIndex, e);
                }
            }, PROCESSING_EXECUTOR); // Use custom thread pool

            futures.add(future);
        }

        // Step 3: Wait for all chunks to be processed
        List<ProcessedChunk> processedChunks = futures.stream()
                .map(CompletableFuture::join)
                .sorted(Comparator.comparingInt(ProcessedChunk::getChunkIndex))
                .collect(Collectors.toList());

        log.info("Processed {} chunks in parallel for saving", processedChunks.size());
        return processedChunks;
    }

    /**
     * Process snippet chunks for retrieval (reverse pipeline)
     * Pipeline: Decompress → Reassemble
     * 
     * IMPORTANT: chunkContents must be ordered by chunkIndex (0, 1, 2, ...)
     * This is ensured by the database query: findBySnippetIdOrderByChunkIndexAsc
     * 
     * @param chunkContents List of chunk contents (MUST be ordered by chunkIndex)
     * @param isCompressed Whether chunks are compressed
     * @return Reassembled plaintext content
     */
    public String processSnippetForRetrieval(List<byte[]> chunkContents, boolean isCompressed) {
        if (chunkContents == null || chunkContents.isEmpty()) {
            throw new IllegalArgumentException("Chunk contents cannot be null or empty");
        }

        log.debug("Processing {} chunks for retrieval (compressed: {})", 
            chunkContents.size(), isCompressed);

        // Step 1: Decompress chunks (if compressed)
        List<byte[]> decompressedChunks;
        if (isCompressed) {
            decompressedChunks = chunkContents.stream()
                    .map(compressionService::decompress)
                    .collect(Collectors.toList());
            log.debug("Decompressed {} chunks", decompressedChunks.size());
        } else {
            decompressedChunks = chunkContents;
        }

        // Step 2: Reassemble chunks
        String content = chunkingService.reassembleString(decompressedChunks);
        log.debug("Reassembled chunks into content (length: {} chars)", content.length());

        return content;
    }

    /**
     * Process multiple snippets in parallel for retrieval
     * Useful when retrieving multiple snippets at once (e.g., recent snippets)
     * 
     * @param snippetsData List of snippet data (each contains chunk contents and compression flag)
     * @return List of reassembled plaintext contents (in same order as input)
     */
    public List<String> processSnippetsForRetrievalParallel(
            List<SnippetData> snippetsData) {
        if (snippetsData == null || snippetsData.isEmpty()) {
            return List.of();
        }

        log.debug("Processing {} snippets in parallel for retrieval", snippetsData.size());

        // Process all snippets in parallel
        List<CompletableFuture<String>> futures = snippetsData.stream()
                .map(snippetData -> CompletableFuture.supplyAsync(() -> {
                    try {
                        return processSnippetForRetrieval(
                            snippetData.getChunkContents(),
                            snippetData.isCompressed()
                        );
                    } catch (Exception e) {
                        log.error("Failed to process snippet: {}", e.getMessage(), e);
                        throw new RuntimeException("Failed to process snippet", e);
                    }
                }, PROCESSING_EXECUTOR)) // Use custom thread pool
                .collect(Collectors.toList());

        // Wait for all snippets to be processed
        List<String> contents = futures.stream()
                .map(CompletableFuture::join)
                .collect(Collectors.toList());

        log.info("Processed {} snippets in parallel for retrieval", contents.size());
        return contents;
    }

    /**
     * Data class for snippet processing
     * 
     * IMPORTANT: chunkContents must be ordered by chunkIndex (0, 1, 2, ...)
     * This is ensured when retrieving from database using findBySnippetIdOrderByChunkIndexAsc
     */
    public static class SnippetData {
        private final List<byte[]> chunkContents;
        private final boolean isCompressed;

        public SnippetData(List<byte[]> chunkContents, boolean isCompressed) {
            // Note: chunkContents should already be sorted by chunkIndex from DB query
            this.chunkContents = chunkContents;
            this.isCompressed = isCompressed;
        }

        public List<byte[]> getChunkContents() {
            return chunkContents;
        }

        public boolean isCompressed() {
            return isCompressed;
        }
    }
}

