/**
 * Content Script - Captures copy events from web pages
 */

// Wait for DOM and ensure chrome.runtime is available
(function() {
    'use strict';
    
    // Skip chrome://, extension://, and other restricted pages
    const url = window.location.href;
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || 
        url.startsWith('moz-extension://') || url.startsWith('edge://')) {
        return; // Don't run on extension pages
    }
    
    // Check if chrome.runtime is available
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        console.error('Secure Clipboard: chrome.runtime not available');
        return;
    }
    
    // Check if extension ID is valid
    try {
        if (!chrome.runtime.id) {
            console.error('Secure Clipboard: Extension ID not available');
            return;
        }
    } catch (e) {
        console.error('Secure Clipboard: Cannot access extension runtime:', e);
        return;
    }
    
    console.log('Secure Clipboard: Content script loading on', url);
    
    // Initialize immediately (don't wait for DOM)
    // This ensures we catch copy events even on pages that load quickly
    try {
        // Listen for copy events (capture phase - fires before default behavior)
        document.addEventListener('copy', handleCopyEvent, true);
        
        // Listen for keyboard shortcuts (capture phase)
        document.addEventListener('keydown', handleKeyDown, true);
        
        // Also listen at window level for better coverage
        window.addEventListener('copy', handleCopyEvent, true);
        window.addEventListener('keydown', handleKeyDown, true);
        
        console.log('Secure Clipboard: Content script initialized on', url);
    } catch (error) {
        console.error('Secure Clipboard: Error initializing:', error);
    }
})();

// Handle copy event
function handleCopyEvent(e) {
    try {
        // Check if chrome.runtime is available
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.error('Secure Clipboard: chrome.runtime not available');
            return;
        }
        
        // Check if extension context is still valid
        try {
            if (!chrome.runtime.id) {
                console.log('Secure Clipboard: Extension context invalidated, skipping');
                return;
            }
        } catch (contextError) {
            // Extension context invalidated
            console.log('Secure Clipboard: Extension context invalidated, skipping');
            return;
        }
        
        console.log('Secure Clipboard: Copy event detected');
        
        // Get selected text before copy happens
        let selectedText = window.getSelection().toString().trim();
        
        // If no selection, try to get from clipboard data
        if (selectedText.length === 0 && e.clipboardData) {
            try {
                selectedText = e.clipboardData.getData('text/plain').trim();
            } catch (err) {
                // Clipboard data might not be accessible
            }
        }
        
        if (selectedText.length === 0) {
            console.log('Secure Clipboard: No text selected, skipping');
            return; // No text selected
        }
        
        console.log('Secure Clipboard: Captured text length:', selectedText.length);
        
        // Get current page URL
        const sourceUrl = window.location.href;
        
        // Send message to background script with error handling
        try {
            chrome.runtime.sendMessage({
                action: 'copy',
                text: selectedText,
                sourceUrl: sourceUrl
            }, (response) => {
                // Check for runtime errors
                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError.message;
                    // Ignore these common errors (normal when background wakes up or extension reloads)
                    if (error && 
                        !error.includes('message port closed') && 
                        !error.includes('receiving end') &&
                        !error.includes('No such renderer') &&
                        !error.includes('Extension context invalidated')) {
                        console.error('Secure Clipboard: Failed to send copy event:', error);
                    }
                    return;
                }
                
                if (response && response.success) {
                    console.log('Secure Clipboard: ✅ Snippet saved:', response.result?.id);
                } else if (response && !response.success) {
                    // Check if it's an expected error (duplicate or already processing)
                    const errorMsg = response.error || '';
                    if (errorMsg.includes('Duplicate content') || errorMsg.includes('Copy already in progress')) {
                        console.log('Secure Clipboard: ℹ️', errorMsg);
                    } else {
                        console.error('Secure Clipboard: ❌ Failed to save snippet:', errorMsg);
                    }
                } else {
                    console.warn('Secure Clipboard: No response from background script');
                }
            });
        } catch (sendError) {
            // Handle extension context invalidated gracefully
            if (sendError.message && 
                (sendError.message.includes('Extension context invalidated') ||
                 sendError.message.includes('No such renderer'))) {
                console.log('Secure Clipboard: Extension context invalidated, please reload extension');
            } else {
                console.error('Secure Clipboard: Error sending message:', sendError);
            }
        }
    } catch (error) {
        console.error('Secure Clipboard: Error capturing copy event:', error);
    }
}

// Handle keyboard shortcuts (Ctrl+C / Cmd+C)
function handleKeyDown(e) {
    // Check for Ctrl+C (Windows/Linux) or Cmd+C (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey && !e.altKey) {
        // Check if chrome.runtime is available
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
            console.error('Secure Clipboard: chrome.runtime not available');
            return;
        }
        
        // Check if extension context is still valid
        try {
            if (!chrome.runtime.id) {
                console.log('Secure Clipboard: Extension context invalidated, skipping');
                return;
            }
        } catch (contextError) {
            // Extension context invalidated
            console.log('Secure Clipboard: Extension context invalidated, skipping');
            return;
        }
        
        console.log('Secure Clipboard: Cmd+C detected');
        
        // Get selection immediately (before clipboard is updated)
        const selectedText = window.getSelection().toString().trim();
        
        if (selectedText.length > 0) {
            // Use selection directly (more reliable)
            const sourceUrl = window.location.href;
            console.log('Secure Clipboard: Captured text via Cmd+C, length:', selectedText.length);
            
            try {
                chrome.runtime.sendMessage({
                    action: 'copy',
                    text: selectedText,
                    sourceUrl: sourceUrl
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        const error = chrome.runtime.lastError.message;
                        // Ignore common errors (including extension context invalidated)
                        if (error && 
                            !error.includes('message port closed') && 
                            !error.includes('receiving end') &&
                            !error.includes('No such renderer') &&
                            !error.includes('Extension context invalidated')) {
                            console.error('Secure Clipboard: Failed to send copy event:', error);
                        }
                        return;
                    }
                    
                    if (response && response.success) {
                        console.log('Secure Clipboard: ✅ Snippet saved via Cmd+C:', response.result?.id);
                    } else if (response && !response.success) {
                        // Check if it's an expected error (duplicate or already processing)
                        const errorMsg = response.error || '';
                        if (errorMsg.includes('Duplicate content') || errorMsg.includes('Copy already in progress')) {
                            console.log('Secure Clipboard: ℹ️', errorMsg);
                        } else {
                            console.error('Secure Clipboard: ❌ Failed to save snippet:', errorMsg);
                        }
                    }
                });
            } catch (sendError) {
                // Handle extension context invalidated gracefully
                if (sendError.message && 
                    (sendError.message.includes('Extension context invalidated') ||
                     sendError.message.includes('No such renderer'))) {
                    console.log('Secure Clipboard: Extension context invalidated, please reload extension');
                } else {
                    console.error('Secure Clipboard: Error sending message:', sendError);
                }
            }
        } else {
            // Fallback: try clipboard API after a delay
            setTimeout(() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
                    navigator.clipboard.readText().then(text => {
                        if (text && text.trim().length > 0) {
                            const sourceUrl = window.location.href;
                            console.log('Secure Clipboard: Captured text via clipboard API, length:', text.length);
                            
                            try {
                                // Check if extension context is still valid
                                try {
                                    if (!chrome.runtime.id) {
                                        console.log('Secure Clipboard: Extension context invalidated, skipping');
                                        return;
                                    }
                                } catch (contextError) {
                                    console.log('Secure Clipboard: Extension context invalidated, skipping');
                                    return;
                                }
                                
                                chrome.runtime.sendMessage({
                                    action: 'copy',
                                    text: text.trim(),
                                    sourceUrl: sourceUrl
                                }, (response) => {
                                    if (chrome.runtime.lastError) {
                                        const error = chrome.runtime.lastError.message;
                                        // Ignore common errors (including extension context invalidated)
                                        if (error && 
                                            !error.includes('message port closed') && 
                                            !error.includes('receiving end') &&
                                            !error.includes('No such renderer') &&
                                            !error.includes('Extension context invalidated')) {
                                            console.error('Secure Clipboard: Failed to send copy event:', error);
                                        }
                                        return;
                                    }
                                    
                                    if (response && response.success) {
                                        console.log('Secure Clipboard: ✅ Snippet saved via clipboard API:', response.result?.id);
                                    } else if (response && !response.success) {
                                        // Check if it's an expected error (duplicate or already processing)
                                        const errorMsg = response.error || '';
                                        if (errorMsg.includes('Duplicate content') || errorMsg.includes('Copy already in progress')) {
                                            console.log('Secure Clipboard: ℹ️', errorMsg);
                                        } else {
                                            console.error('Secure Clipboard: ❌ Failed to save snippet:', errorMsg);
                                        }
                                    }
                                });
                            } catch (sendError) {
                                // Handle extension context invalidated gracefully
                                if (sendError.message && 
                                    (sendError.message.includes('Extension context invalidated') ||
                                     sendError.message.includes('No such renderer'))) {
                                    console.log('Secure Clipboard: Extension context invalidated, please reload extension');
                                } else {
                                    console.error('Secure Clipboard: Error sending message:', sendError);
                                }
                            }
                        }
                    }).catch(error => {
                        console.log('Secure Clipboard: Could not read clipboard:', error.message);
                    });
                }
            }, 200);
        }
    }
}

