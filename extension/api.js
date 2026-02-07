/**
 * API Client - Handles all backend API calls
 * Uses chrome.storage.local for token storage
 */

let apiBaseUrl = 'http://localhost:8080';

// Initialize API base URL
(async () => {
    if (typeof storage !== 'undefined') {
        apiBaseUrl = await storage.getApiBaseUrl();
    }
})();

const api = {
    /**
     * Get API base URL
     */
    async getBaseUrl() {
        if (typeof storage !== 'undefined') {
            return await storage.getApiBaseUrl();
        }
        return apiBaseUrl;
    },
    
    /**
     * Make API call
     * @param {string} endpoint - API endpoint
     * @param {object} options - Fetch options
     * @returns {Promise<any>} Response data
     */
    async call(endpoint, options = {}) {
        const baseUrl = await this.getBaseUrl();
        const url = `${baseUrl}${endpoint}`;
        
        const token = typeof storage !== 'undefined' ? await storage.getToken() : null;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };
        
        if (token) {
            defaultOptions.headers['Authorization'] = `Bearer ${token}`;
        }
        
        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {}),
            },
        };
        
        try {
            const response = await fetch(url, config);
            
            // Handle authentication errors (but not for auth endpoints)
            if ((response.status === 401 || response.status === 403) && !endpoint.includes('/auth/')) {
                if (typeof storage !== 'undefined') {
                    await storage.clearToken();
                }
                throw new Error('Authentication required');
            }
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                try {
                    const error = await response.json();
                    errorMessage = error.message || error.error || errorMessage;
                } catch (e) {
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }
            
            // Handle 204 No Content responses (like updateSnippetAccess)
            if (response.status === 204) {
                return {};
            }
            
            // Handle empty responses
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return {};
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', url, error);
            // Improve error message for network/CORS errors
            if (error.message === 'Failed to fetch' || error.name === 'TypeError' || !error.message) {
                throw new Error(`Network error: Could not connect to backend at ${baseUrl}. Check if backend is running and CORS is configured.`);
            }
            throw error;
        }
    },
    
    /**
     * Login user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<object>} Auth response
     */
    async login(email, password) {
        const response = await this.call('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        
        if (typeof storage !== 'undefined' && response.accessToken) {
            await storage.setToken(response.accessToken);
        }
        
        return response;
    },
    
    /**
     * Register user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<object>} Auth response
     */
    async register(email, password) {
        const response = await this.call('/api/v1/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        
        if (typeof storage !== 'undefined' && response.accessToken) {
            await storage.setToken(response.accessToken);
        }
        
        return response;
    },
    
    /**
     * Logout user
     */
    async logout() {
        try {
            await this.call('/api/v1/auth/logout', {
                method: 'POST',
            });
        } catch (error) {
            console.warn('Logout API call failed:', error);
        } finally {
            if (typeof storage !== 'undefined') {
                await storage.clearToken();
            }
        }
    },
    
    /**
     * Get recent snippets
     * @returns {Promise<Array>} List of snippets
     */
    async getRecentSnippets() {
        return await this.call('/api/v1/snippets', {
            method: 'GET',
        });
    },
    
    /**
     * Get single snippet
     * @param {number} id - Snippet ID
     * @returns {Promise<object>} Snippet data
     */
    async getSnippet(id) {
        return await this.call(`/api/v1/snippets/${id}`, {
            method: 'GET',
        });
    },
    
    /**
     * Search snippets
     * @param {string} query - Search query
     * @returns {Promise<Array>} List of matching snippets
     */
    async searchSnippets(query) {
        return await this.call(`/api/v1/snippets/search?query=${encodeURIComponent(query)}`, {
            method: 'GET',
        });
    },
    
    /**
     * Create snippet
     * @param {string} content - Snippet content
     * @param {string|null} sourceUrl - Source URL (optional)
     * @returns {Promise<object>} Created snippet
     */
    async createSnippet(content, sourceUrl = null) {
        return await this.call('/api/v1/snippets', {
            method: 'POST',
            body: JSON.stringify({ content, sourceUrl }),
        });
    },
    
    /**
     * Delete snippet
     * @param {number} id - Snippet ID
     */
    async deleteSnippet(id) {
        return await this.call(`/api/v1/snippets/${id}`, {
            method: 'DELETE',
        });
    },
    
    /**
     * Update snippet access (move to top of queue)
     * @param {number} id - Snippet ID
     */
    async updateSnippetAccess(id) {
        // This endpoint may not exist yet, but we'll call it
        // The backend can implement this to update Redis queue
        return await this.call(`/api/v1/snippets/${id}/access`, {
            method: 'POST',
        });
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}

