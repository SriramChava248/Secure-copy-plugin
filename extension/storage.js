/**
 * Storage Service - Manages token storage using chrome.storage.local
 * 
 * Security Note: chrome.storage.local is encrypted by Chrome OS and stored
 * in user's profile directory. It's more secure than localStorage because:
 * - Data is encrypted at rest by Chrome
 * - Isolated per extension (other extensions can't access)
 * - Cleared when extension is uninstalled
 * - However, still accessible to malicious extensions with storage permission
 * - Best practice: Use short-lived tokens (15min access tokens)
 */

const storage = {
    /**
     * Get JWT token from storage
     * @returns {Promise<string|null>} Token or null if not found
     */
    async getToken() {
        try {
            const result = await chrome.storage.local.get(['jwt_token']);
            return result.jwt_token || null;
        } catch (error) {
            console.error('Failed to get token:', error);
            return null;
        }
    },
    
    /**
     * Save JWT token to storage
     * @param {string} token - JWT token
     */
    async setToken(token) {
        try {
            await chrome.storage.local.set({ jwt_token: token });
        } catch (error) {
            console.error('Failed to save token:', error);
            throw error;
        }
    },
    
    /**
     * Clear JWT token from storage
     */
    async clearToken() {
        try {
            await chrome.storage.local.remove(['jwt_token']);
        } catch (error) {
            console.error('Failed to clear token:', error);
        }
    },
    
    /**
     * Get API base URL from storage
     * @returns {Promise<string>} API base URL
     */
    async getApiBaseUrl() {
        try {
            const result = await chrome.storage.local.get(['api_base_url']);
            return result.api_base_url || 'http://localhost:8080';
        } catch (error) {
            console.error('Failed to get API base URL:', error);
            return 'http://localhost:8080';
        }
    },
    
    /**
     * Set API base URL
     * @param {string} url - API base URL
     */
    async setApiBaseUrl(url) {
        try {
            await chrome.storage.local.set({ api_base_url: url });
        } catch (error) {
            console.error('Failed to set API base URL:', error);
            throw error;
        }
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = storage;
}

