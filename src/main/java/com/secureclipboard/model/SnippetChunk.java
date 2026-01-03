package com.secureclipboard.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "snippet_chunks")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SnippetChunk {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "snippet_id", nullable = false)
    private Long snippetId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "snippet_id", insertable = false, updatable = false)
    private Snippet snippet;
    
    @Column(name = "chunk_index", nullable = false)
    private Integer chunkIndex;
    
    @Column(nullable = false, columnDefinition = "BYTEA")
    private byte[] content;
    
    @Column(name = "content_hash", length = 64)
    private String contentHash;
    
    @Column(name = "encryption_iv", columnDefinition = "BYTEA")
    private byte[] encryptionIv;
    
    @Column(name = "is_compressed", nullable = false)
    private Boolean isCompressed = true;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

