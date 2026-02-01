package com.secureclipboard.repository;

import com.secureclipboard.model.SnippetChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SnippetChunkRepository extends JpaRepository<SnippetChunk, Long> {
    
    List<SnippetChunk> findBySnippetIdOrderByChunkIndexAsc(Long snippetId);
    
    Optional<SnippetChunk> findBySnippetIdAndChunkIndex(Long snippetId, Integer chunkIndex);
    
    void deleteBySnippetId(Long snippetId);
    
    Optional<SnippetChunk> findByContentHash(String contentHash);
}












