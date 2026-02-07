/**
 * Background Service Worker - Handles copy events and API communication
 */

// Keep service worker alive
let keepAliveInterval;
let clipboardPollInterval;
let lastClipboardText = '';
let isProcessingCopy = false; // Prevent concurrent copy processing
let currentlyProcessingText = ''; // Track what text is being processed

// Keep service worker active
function keepAlive() {
    keepAliveInterval = setInterval(() => {
        chrome.storage.local.get(['keep_alive'], (result) => {
            chrome.storage.local.set({ keep_alive: Date.now() });
        });
    }, 20000); // Every 20 seconds
}

// Monitor clipboard globally (for copy from other apps)
function startClipboardMonitoring() {
    // Check if clipboard API is available
    if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) {
        console.log('Secure Clipboard: Clipboard API not available in service worker, using content script only');
        return; // Clipboard API not available in service worker context
    }
    
    clipboardPollInterval = setInterval(async () => {
        // Skip if already processing the same text
        if (isProcessingCopy) {
            return;
        }
        
        try {
            // Check clipboard API is still available
            if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) {
                return; // Clipboard API not available
            }
            
            // Read clipboard
            const text = await navigator.clipboard.readText();
            const trimmedText = text ? text.trim() : '';
            
            // Check if clipboard changed and not empty
            if (trimmedText.length > 0 && trimmedText !== lastClipboardText) {
                // Skip if this exact text is currently being processed
                if (trimmedText === currentlyProcessingText) {
                    return;
                }
                
                lastClipboardText = trimmedText;
                
                console.log('Secure Clipboard: Global clipboard change detected, length:', trimmedText.length);
                
                // Process the copy
                isProcessingCopy = true;
                currentlyProcessingText = trimmedText;
                try {
                    await handleCopyEvent(trimmedText, null);
                } catch (error) {
                    // Check if it's a duplicate error from backend (expected, not an error)
                    if (error.message && error.message.includes('Duplicate content')) {
                        console.log('Secure Clipboard: ℹ️ Duplicate content detected, skipping');
                    } else if (!error.message.includes('Not authenticated')) {
                        console.error('Secure Clipboard: Error processing global copy:', error);
                    }
                } finally {
                    isProcessingCopy = false;
                    currentlyProcessingText = '';
                }
            }
        } catch (error) {
            // Clipboard might not be accessible, ignore common errors
            const errorMsg = error.message || String(error);
            if (!errorMsg.includes('not allowed') && 
                !errorMsg.includes('permission') &&
                !errorMsg.includes('undefined') &&
                !errorMsg.includes('readText')) {
                console.log('Secure Clipboard: Clipboard monitoring:', errorMsg);
            }
            isProcessingCopy = false;
            currentlyProcessingText = '';
        }
    }, 1000); // Check every second
}

// Start keep-alive
keepAlive();

// Start clipboard monitoring for global copy detection
startClipboardMonitoring();

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Secure Clipboard: Received message:', request.action, 'from:', sender.url);
    
    if (request.action === 'copy') {
        const textToProcess = request.text ? request.text.trim() : '';
        
        // Skip if this exact text is already being processed
        if (isProcessingCopy && textToProcess === currentlyProcessingText) {
            console.log('Secure Clipboard: ℹ️ Same text already being processed, skipping');
            sendResponse({ success: false, error: 'Copy already in progress' });
            return false;
        }
        
        // Allow different text to be processed concurrently (shouldn't happen often)
        // But if we're processing something, log it as info
        if (isProcessingCopy) {
            console.log('Secure Clipboard: ℹ️ Different text copy in progress, queuing this one');
        }
        
        console.log('Secure Clipboard: Processing copy event, text length:', textToProcess.length);
        
        // Set processing flag
        isProcessingCopy = true;
        currentlyProcessingText = textToProcess;
        
        handleCopyEvent(textToProcess, request.sourceUrl)
            .then(result => {
                console.log('Secure Clipboard: ✅ Copy event processed successfully:', result?.id);
                lastClipboardText = textToProcess; // Update last clipboard text
                sendResponse({ success: true, result });
            })
            .catch(error => {
                // Check if it's a duplicate error from backend (expected, not an error)
                if (error.message && error.message.includes('Duplicate content')) {
                    console.log('Secure Clipboard: ℹ️ Duplicate content detected, skipping');
                } else {
                    console.error('Secure Clipboard: ❌ Error handling copy:', error);
                }
                sendResponse({ success: false, error: error.message });
            })
            .finally(() => {
                isProcessingCopy = false;
                currentlyProcessingText = '';
            });
        return true; // Keep channel open for async response
    }
    
    // Handle keep-alive ping
    if (request.action === 'ping') {
        console.log('Secure Clipboard: Ping received from:', request.source);
        sendResponse({ success: true });
        return false;
    }
    
    return false;
});

// Listen for command (keyboard shortcut)
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'open-clipboard') {
        console.log('Secure Clipboard: Keyboard shortcut pressed');
        
        try {
            // Get extension URL
            const url = chrome.runtime.getURL('popup.html');
            
            // Try to find existing popup window or tab
            const windows = await chrome.windows.getAll({ populate: true });
            const tabs = await chrome.tabs.query({ url: url });
            
            // Check if popup window exists
            const existingPopup = windows.find(w => 
                w.type === 'popup' && 
                w.tabs && 
                w.tabs.some(tab => tab.url === url)
            );
            
            if (existingPopup) {
                // Focus existing popup window
                await chrome.windows.update(existingPopup.id, { focused: true });
                console.log('Secure Clipboard: Focused existing popup window');
            } else if (tabs.length > 0) {
                // Focus existing tab
                await chrome.tabs.update(tabs[0].id, { active: true });
                await chrome.windows.update(tabs[0].windowId, { focused: true });
                console.log('Secure Clipboard: Focused existing tab');
            } else {
                // Create new popup window (same as clicking extension icon)
                // Use same dimensions as default popup
                await chrome.windows.create({
                    url: url,
                    type: 'popup',
                    width: 400,
                    height: 600,
                    focused: true
                });
                console.log('Secure Clipboard: Created new popup window');
            }
        } catch (error) {
            console.error('Secure Clipboard: Error opening popup:', error);
            // Fallback: show badge notification
            try {
                chrome.action.setBadgeText({ text: '!' });
                chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
                setTimeout(() => {
                    chrome.action.setBadgeText({ text: '' });
                }, 2000);
            } catch (badgeError) {
                console.error('Secure Clipboard: Error showing badge:', badgeError);
            }
        }
    }
});

// Handle copy event
async function handleCopyEvent(text, sourceUrl) {
    try {
        console.log('Secure Clipboard: handleCopyEvent called, text length:', text?.length);
        
        if (!text || text.trim().length === 0) {
            throw new Error('Empty text provided');
        }
        
        // Get token from storage
        const token = await getToken();
        if (!token) {
            console.log('Secure Clipboard: Not authenticated, skipping snippet save');
            throw new Error('Not authenticated');
        }
        
        console.log('Secure Clipboard: Token found, making API call');
        
        // Get API base URL from storage or use default
        const apiBaseUrl = await getApiBaseUrl();
        const url = `${apiBaseUrl}/api/v1/snippets`;
        
        console.log('Secure Clipboard: POST to:', url);
        
        // Create snippet via API
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                content: text,
                sourceUrl: sourceUrl || null
            })
        });
        
        console.log('Secure Clipboard: API response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                // Token expired, clear it
                await clearToken();
                throw new Error('Authentication expired');
            }
            
            // Handle duplicate content (409 Conflict)
            if (response.status === 409) {
                throw new Error('Duplicate content: This snippet already exists');
            }
            
            const errorText = await response.text();
            console.error('Secure Clipboard: API error response:', errorText);
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Secure Clipboard: ✅ Snippet saved successfully:', result.id);
        return result;
    } catch (error) {
        // Check if it's a duplicate error (expected, not a real error)
        if (error.message && error.message.includes('Duplicate content')) {
            console.log('Secure Clipboard: ℹ️ Duplicate content detected, skipping');
        } else {
            console.error('Secure Clipboard: ❌ Failed to save snippet:', error);
        }
        throw error;
    }
}

// Storage helpers
async function getToken() {
    const result = await chrome.storage.local.get(['jwt_token']);
    return result.jwt_token || null;
}

async function clearToken() {
    await chrome.storage.local.remove(['jwt_token']);
}

async function getApiBaseUrl() {
    const result = await chrome.storage.local.get(['api_base_url']);
    return result.api_base_url || 'http://localhost:8080';
}

// Install/Update handler
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Secure Clipboard extension installed');
        // Set default API URL
        chrome.storage.local.set({ api_base_url: 'http://localhost:8080' });
    } else if (details.reason === 'update') {
        console.log('Secure Clipboard extension updated');
    }
});

