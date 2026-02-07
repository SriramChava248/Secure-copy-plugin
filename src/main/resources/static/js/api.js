/**
 * API Client - Handles all backend API calls
 * Manages JWT token storage and authentication
 */

const API_BASE_URL = window.location.origin + '/api/v1';

// Token storage
function getToken() {
    return localStorage.getItem('jwt_token');
}

function setToken(token) {
    localStorage.setItem('jwt_token', token);
}

function clearToken() {
    localStorage.removeItem('jwt_token');
}

// API call helper
async function apiCall(endpoint, options = {}) {
    const token = getToken();
    const url = `${API_BASE_URL}${endpoint}`;
    
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
    
    // Add timeout for large requests (60 seconds)
    const controller = new AbortController();
    let timeoutId = null;
    
    try {
        timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        config.signal = controller.signal;
        
        const response = await fetch(url, config);
        if (timeoutId) clearTimeout(timeoutId);
        
        // Handle 401 Unauthorized - token expired or invalid
        if (response.status === 401) {
            clearToken();
            throw new Error('Authentication required');
        }
        
        // Handle 403 Forbidden - token expired or invalid (Spring Security returns 403 for expired tokens)
        if (response.status === 403) {
            clearToken();
            // Reload page to show login modal
            window.location.reload();
            throw new Error('Session expired. Please login again.');
        }
        
        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            let errorDetails = null;
            try {
                const error = await response.json();
                // Extract error message from error response structure
                errorMessage = error.message || error.error || errorMessage;
                // Store full error object for better error handling
                errorDetails = error;
            } catch (e) {
                // Response is not JSON, use status text
                errorMessage = response.statusText || errorMessage;
            }
            console.error(`API call failed: ${url} - ${errorMessage}`);
            const apiError = new Error(errorMessage);
            // Attach error details for better error handling
            if (errorDetails) {
                apiError.error = errorDetails;
            }
            throw apiError;
        }
        
        // Handle empty responses (like DELETE)
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            return {};
        }
        
        return await response.json();
    } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error('API call timeout:', url);
            throw new Error('Request timeout - the file may be too large or network is slow. Please try again.');
        }
        console.error('API call failed:', url, error);
        throw error;
    }
}

// Auth APIs
const authAPI = {
    async login(email, password) {
        const response = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        setToken(response.accessToken);
        return response;
    },
    
    async register(email, password) {
        const response = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        setToken(response.accessToken);
        return response;
    },
    
    async logout() {
        try {
            await apiCall('/auth/logout', {
                method: 'POST',
            });
        } catch (error) {
            // Even if logout API fails, clear token locally
            console.warn('Logout API call failed, clearing token locally:', error);
        } finally {
            clearToken();
        }
    },
};

// Snippet APIs
const snippetAPI = {
    async getRecentSnippets() {
        return await apiCall('/snippets', {
            method: 'GET',
        });
    },
    
    async getSnippet(id) {
        return await apiCall(`/snippets/${id}`, {
            method: 'GET',
        });
    },
    
    async searchSnippets(query) {
        return await apiCall(`/snippets/search?query=${encodeURIComponent(query)}`, {
            method: 'GET',
        });
    },
    
    async createSnippet(content, sourceUrl = null) {
        return await apiCall('/snippets', {
            method: 'POST',
            body: JSON.stringify({ content, sourceUrl }),
        });
    },
    
    async deleteSnippet(id) {
        return await apiCall(`/snippets/${id}`, {
            method: 'DELETE',
        });
    },
};

// Export for use in other files
window.authAPI = authAPI;
window.snippetAPI = snippetAPI;
window.getToken = getToken;
window.clearToken = clearToken;

