package com.secureclipboard.repository;

import com.secureclipboard.model.Snippet;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface SnippetRepository extends JpaRepository<Snippet, Long> {
    
    // Paginated query for recent snippets (for API pagination)
    Page<Snippet> findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(Long userId, Pageable pageable);
    
    // Get top 50 recent snippets (for Redis queue initialization)
    List<Snippet> findTop50ByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(Long userId);
    
    // Find snippet by ID and user ID (security: user can only access own snippets)
    Optional<Snippet> findByIdAndUserId(Long id, Long userId);
    
    // Find all snippets for a user (for search functionality)
    List<Snippet> findByUserIdAndIsDeletedFalse(Long userId);
    
    // Clear all snippets for a user (soft delete - marks all as deleted)
    @Query("UPDATE Snippet s SET s.isDeleted = true WHERE s.userId = :userId AND s.isDeleted = false")
    @Modifying
    @Transactional
    int clearAllSnippets(@Param("userId") Long userId);
}

