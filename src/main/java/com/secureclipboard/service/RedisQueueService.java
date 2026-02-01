package com.secureclipboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RedisQueueService {

    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${snippet.max-recent-snippets:50}")
    private int maxRecentSnippets;

    private static final String QUEUE_KEY_PREFIX = "user:";
    private static final String QUEUE_KEY_SUFFIX = ":snippets:queue";

    /**
     * Get queue key for a user
     */
    private String getQueueKey(Long userId) {
        return QUEUE_KEY_PREFIX + userId + QUEUE_KEY_SUFFIX;
    }

    /**
     * Add snippet to the front of the queue (most recent)
     */
    public void addToFront(Long userId, Long snippetId) {
        String queueKey = getQueueKey(userId);
        redisTemplate.opsForList().leftPush(queueKey, snippetId.toString());
        trimQueue(userId);
        log.debug("Added snippet {} to queue for user {}", snippetId, userId);
    }

    /**
     * Move snippet to front (when user reads it)
     */
    public void moveToFront(Long userId, Long snippetId) {
        String queueKey = getQueueKey(userId);
        
        // Remove from current position
        redisTemplate.opsForList().remove(queueKey, 0, snippetId.toString());
        
        // Add to front
        redisTemplate.opsForList().leftPush(queueKey, snippetId.toString());
        
        log.debug("Moved snippet {} to front of queue for user {}", snippetId, userId);
    }

    /**
     * Get recent snippet IDs from queue (ordered by most recent first)
     */
    public List<Long> getRecentSnippetIds(Long userId) {
        String queueKey = getQueueKey(userId);
        List<Object> snippetIds = redisTemplate.opsForList().range(queueKey, 0, maxRecentSnippets - 1);
        
        if (snippetIds == null || snippetIds.isEmpty()) {
            return List.of();
        }
        
        return snippetIds.stream()
                .map(id -> Long.parseLong(id.toString()))
                .collect(Collectors.toList());
    }

    /**
     * Remove snippet from queue
     */
    public void removeFromQueue(Long userId, Long snippetId) {
        String queueKey = getQueueKey(userId);
        redisTemplate.opsForList().remove(queueKey, 0, snippetId.toString());
        log.debug("Removed snippet {} from queue for user {}", snippetId, userId);
    }

    /**
     * Clear entire queue for a user
     */
    public void clearQueue(Long userId) {
        String queueKey = getQueueKey(userId);
        redisTemplate.delete(queueKey);
        log.debug("Cleared queue for user {}", userId);
    }

    /**
     * Trim queue to maintain max recent snippets limit
     */
    private void trimQueue(Long userId) {
        String queueKey = getQueueKey(userId);
        redisTemplate.opsForList().trim(queueKey, 0, maxRecentSnippets - 1);
    }

    /**
     * Get queue size
     */
    public long getQueueSize(Long userId) {
        String queueKey = getQueueKey(userId);
        Long size = redisTemplate.opsForList().size(queueKey);
        return size != null ? size : 0;
    }
}












