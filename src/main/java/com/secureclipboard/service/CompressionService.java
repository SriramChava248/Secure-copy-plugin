package com.secureclipboard.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

@Service
@Slf4j
public class CompressionService {

    /**
     * Compress byte array using GZIP
     * 
     * @param data Data to compress
     * @return Compressed bytes
     */
    public byte[] compress(byte[] data) {
        if (data == null || data.length == 0) {
            throw new IllegalArgumentException("Data cannot be null or empty");
        }

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             GZIPOutputStream gzos = new GZIPOutputStream(baos)) {
            
            gzos.write(data);
            gzos.finish();
            byte[] compressed = baos.toByteArray();
            log.debug("Compressed {} bytes to {} bytes ({}% reduction)", 
                data.length, compressed.length, 
                (100 - (compressed.length * 100 / data.length)));
            
            return compressed;
        } catch (IOException e) {
            log.error("Compression failed", e);
            throw new RuntimeException("Compression failed", e);
        }
    }

    /**
     * Decompress byte array using GZIP
     * 
     * @param compressedData Compressed data
     * @return Decompressed bytes
     */
    public byte[] decompress(byte[] compressedData) {
        if (compressedData == null || compressedData.length == 0) {
            throw new IllegalArgumentException("Compressed data cannot be null or empty");
        }

        try (ByteArrayInputStream bais = new ByteArrayInputStream(compressedData);
             GZIPInputStream gzis = new GZIPInputStream(bais);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = gzis.read(buffer)) != -1) {
                baos.write(buffer, 0, bytesRead);
            }
            
            byte[] decompressed = baos.toByteArray();
            log.debug("Decompressed {} bytes to {} bytes", 
                compressedData.length, decompressed.length);
            
            return decompressed;
        } catch (IOException e) {
            log.error("Decompression failed", e);
            throw new RuntimeException("Decompression failed", e);
        }
    }

    /**
     * Compress string (convenience method)
     * 
     * @param data String to compress
     * @return Compressed bytes
     */
    public byte[] compressString(String data) {
        if (data == null) {
            throw new IllegalArgumentException("Data cannot be null");
        }
        return compress(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    /**
     * Decompress to string (convenience method)
     * 
     * @param compressedData Compressed bytes
     * @return Decompressed string
     */
    public String decompressString(byte[] compressedData) {
        byte[] decompressed = decompress(compressedData);
        return new String(decompressed, java.nio.charset.StandardCharsets.UTF_8);
    }
}


