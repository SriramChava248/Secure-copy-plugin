package com.secureclipboard.exception;

/**
 * Exception thrown when user tries to create a snippet but has reached the maximum limit
 */
public class SnippetLimitExceededException extends RuntimeException {
    
    private final int currentCount;
    private final int maxLimit;
    
    public SnippetLimitExceededException(int currentCount, int maxLimit) {
        super(String.format("Snippet limit exceeded: %d snippets (max: %d). Please delete old snippets to continue.", 
            currentCount, maxLimit));
        this.currentCount = currentCount;
        this.maxLimit = maxLimit;
    }
    
    public int getCurrentCount() {
        return currentCount;
    }
    
    public int getMaxLimit() {
        return maxLimit;
    }
}

