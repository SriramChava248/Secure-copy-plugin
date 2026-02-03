package com.secureclipboard.repository;

import com.secureclipboard.model.SnippetChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SnippetChunkRepository extends JpaRepository<SnippetChunk, Long> {
    
    List<SnippetChunk> findBySnippetIdOrderByChunkIndexAsc(Long snippetId);
    
    Optional<SnippetChunk> findBySnippetIdAndChunkIndex(Long snippetId, Integer chunkIndex);
    
    void deleteBySnippetId(Long snippetId);
    
    Optional<SnippetChunk> findByContentHash(String contentHash);
    
    /**
     * Find chunks for multiple snippets, ordered by snippet ID and chunk index
     * Used for parallel retrieval of multiple snippets
     */
    @Query("SELECT c FROM SnippetChunk c WHERE c.snippetId IN :snippetIds ORDER BY c.snippetId ASC, c.chunkIndex ASC")
    List<SnippetChunk> findBySnippetIdInOrderBySnippetIdAscChunkIndexAsc(@Param("snippetIds") List<Long> snippetIds);
}












