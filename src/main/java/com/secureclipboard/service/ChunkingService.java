package com.secureclipboard.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class ChunkingService {

    @Value("${snippet.chunk-size-bytes:65536}")
    private int chunkSizeBytes; // Default: 64KB

    /**
     * Split byte array into chunks of specified size
     * 
     * @param data Data to chunk
     * @return List of chunks (each chunk is max chunkSizeBytes)
     */
    public List<byte[]> chunk(byte[] data) {
        if (data == null || data.length == 0) {
            throw new IllegalArgumentException("Data cannot be null or empty");
        }

        List<byte[]> chunks = new ArrayList<>();
        
        // If data is smaller than chunk size, return single chunk
        if (data.length <= chunkSizeBytes) {
            chunks.add(data);
            log.debug("Data size {} bytes <= chunk size {} bytes, returning single chunk", 
                data.length, chunkSizeBytes);
            return chunks;
        }

        // Split into chunks
        int offset = 0;
        
        while (offset < data.length) {
            int remainingBytes = data.length - offset;
            int currentChunkSize = Math.min(chunkSizeBytes, remainingBytes);
            
            byte[] chunk = new byte[currentChunkSize];
            System.arraycopy(data, offset, chunk, 0, currentChunkSize);
            chunks.add(chunk);
            
            offset += currentChunkSize;
        }

        log.debug("Chunked {} bytes into {} chunks (chunk size: {} bytes)", 
            data.length, chunks.size(), chunkSizeBytes);
        
        return chunks;
    }

    /**
     * Reassemble chunks back into original byte array
     * 
     * @param chunks List of chunks to reassemble
     * @return Reassembled byte array
     */
    public byte[] reassemble(List<byte[]> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            throw new IllegalArgumentException("Chunks cannot be null or empty");
        }

        // Calculate total size
        int totalSize = chunks.stream()
            .mapToInt(chunk -> chunk != null ? chunk.length : 0)
            .sum();

        if (totalSize == 0) {
            throw new IllegalArgumentException("All chunks are empty");
        }

        // Reassemble chunks
        byte[] reassembled = new byte[totalSize];
        int offset = 0;

        for (byte[] chunk : chunks) {
            if (chunk != null && chunk.length > 0) {
                System.arraycopy(chunk, 0, reassembled, offset, chunk.length);
                offset += chunk.length;
            }
        }

        log.debug("Reassembled {} chunks into {} bytes", chunks.size(), reassembled.length);
        
        return reassembled;
    }

    /**
     * Chunk string (convenience method)
     * 
     * @param data String to chunk
     * @return List of byte array chunks
     */
    public List<byte[]> chunkString(String data) {
        if (data == null) {
            throw new IllegalArgumentException("Data cannot be null");
        }
        return chunk(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    /**
     * Reassemble chunks to string (convenience method)
     * 
     * @param chunks List of chunks to reassemble
     * @return Reassembled string
     */
    public String reassembleString(List<byte[]> chunks) {
        byte[] reassembled = reassemble(chunks);
        return new String(reassembled, java.nio.charset.StandardCharsets.UTF_8);
    }
}

