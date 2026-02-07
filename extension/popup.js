/**
 * Popup Script - Main UI logic for Chrome extension popup
 */

const TRUNCATE_LENGTH = 200;
let snippets = [];
let selectedIndex = -1;
let searchQuery = '';

// DOM Elements
let loginScreen, registerScreen, clipboardScreen;
let loginForm, registerForm;
let searchInput, snippetsContainer, loadingState, emptyState;
let deleteAllBtn, logoutBtn;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    checkAuthentication();
    setupEventListeners();
});

// Initialize DOM elements
function initializeElements() {
    loginScreen = document.getElementById('loginScreen');
    registerScreen = document.getElementById('registerScreen');
    clipboardScreen = document.getElementById('clipboardScreen');
    
    loginForm = document.getElementById('loginForm');
    registerForm = document.getElementById('registerForm');
    
    searchInput = document.getElementById('searchInput');
    snippetsContainer = document.getElementById('snippetsContainer');
    loadingState = document.getElementById('loadingState');
    emptyState = document.getElementById('emptyState');
    
    deleteAllBtn = document.getElementById('deleteAllBtn');
    logoutBtn = document.getElementById('logoutBtn');
}

// Check if user is authenticated
async function checkAuthentication() {
    const token = await storage.getToken();
    if (!token) {
        showLoginScreen();
    } else {
        showClipboardScreen();
        loadSnippets();
    }
}

// Show login screen
function showLoginScreen() {
    loginScreen.style.display = 'block';
    registerScreen.style.display = 'none';
    clipboardScreen.style.display = 'none';
}

// Show register screen
function showRegisterScreen() {
    loginScreen.style.display = 'none';
    registerScreen.style.display = 'block';
    clipboardScreen.style.display = 'none';
}

// Show clipboard screen
function showClipboardScreen() {
    loginScreen.style.display = 'none';
    registerScreen.style.display = 'none';
    clipboardScreen.style.display = 'block';
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Register form
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Register/Login navigation
    const registerBtn = document.getElementById('registerBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            showRegisterScreen();
        });
    }
    
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', () => {
            showLoginScreen();
        });
    }
    
    // Search
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Delete all
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', handleDeleteAll);
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        errorDiv.style.display = 'none';
        const response = await api.login(email, password);
        await storage.setToken(response.accessToken);
        showClipboardScreen();
        loadSnippets();
    } catch (error) {
        errorDiv.textContent = error.message || 'Login failed';
        errorDiv.style.display = 'block';
    }
}

// Handle register
async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const errorDiv = document.getElementById('registerError');
    
    try {
        errorDiv.style.display = 'none';
        const response = await api.register(email, password);
        await storage.setToken(response.accessToken);
        showClipboardScreen();
        loadSnippets();
    } catch (error) {
        errorDiv.textContent = error.message || 'Registration failed';
        errorDiv.style.display = 'block';
    }
}

// Handle logout
async function handleLogout() {
    try {
        await api.logout();
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        await storage.clearToken();
        showLoginScreen();
    }
}

// Load snippets
async function loadSnippets() {
    if (loadingState) loadingState.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    if (snippetsContainer) snippetsContainer.innerHTML = '';
    
    try {
        snippets = await api.getRecentSnippets();
        renderSnippets(snippets);
    } catch (error) {
        console.error('Failed to load snippets:', error);
        if (error.message === 'Authentication required') {
            await storage.clearToken();
            showLoginScreen();
        }
    } finally {
        if (loadingState) loadingState.style.display = 'none';
    }
}

// Render snippets
function renderSnippets(snippetsToRender) {
    if (!snippetsContainer) return;
    
    if (snippetsToRender.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        snippetsContainer.innerHTML = '';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    snippetsContainer.innerHTML = '';
    
    snippetsToRender.forEach((snippet, index) => {
        const snippetElement = createSnippetElement(snippet, index);
        snippetsContainer.appendChild(snippetElement);
    });
}

// Create snippet element
function createSnippetElement(snippet, index) {
    const item = document.createElement('div');
    item.className = 'snippet-item';
    item.dataset.index = index;
    item.dataset.snippetId = snippet.id;
    
    const truncated = snippet.content.length > TRUNCATE_LENGTH
        ? snippet.content.substring(0, TRUNCATE_LENGTH) + '...'
        : snippet.content;
    
    item.innerHTML = `
        <div class="snippet-content">${escapeHtml(truncated)}</div>
        <div class="snippet-actions">
            <button class="btn-action copy-btn" title="Copy">📋</button>
            <button class="btn-action expand-btn" title="Expand">+</button>
            <button class="btn-action delete-btn" title="Delete">×</button>
        </div>
    `;
    
    // Setup event listeners
    setupSnippetListeners(item, snippet);
    
    return item;
}

// Setup snippet event listeners
function setupSnippetListeners(item, snippet) {
    const copyBtn = item.querySelector('.copy-btn');
    const expandBtn = item.querySelector('.expand-btn');
    const deleteBtn = item.querySelector('.delete-btn');
    
    // Copy
    if (copyBtn) {
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await copySnippet(snippet.id, snippet.content);
        });
    }
    
    // Expand/Collapse
    if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExpand(item, snippet);
        });
    }
    
    // Delete
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await handleDeleteSnippet(snippet.id);
        });
    }
    
    // Click to copy
    item.addEventListener('click', async (e) => {
        if (e.target.closest('.btn-action')) return;
        await copySnippet(snippet.id, snippet.content);
    });
}

// Copy snippet
async function copySnippet(snippetId, content) {
    try {
        await navigator.clipboard.writeText(content);
        // Visual feedback
        const item = document.querySelector(`[data-snippet-id="${snippetId}"]`);
        if (item) {
            item.classList.add('copied');
            setTimeout(() => item.classList.remove('copied'), 500);
        }
        // Move to top (update queue)
        try {
            await api.updateSnippetAccess(snippetId);
            // Reload to show updated order
            loadSnippets();
        } catch (error) {
            console.error('Failed to update snippet access:', error);
            // Still reload even if update fails
            loadSnippets();
        }
    } catch (error) {
        console.error('Failed to copy:', error);
    }
}

// Toggle expand/collapse
function toggleExpand(item, snippet) {
    const isExpanded = item.classList.contains('expanded');
    const contentDiv = item.querySelector('.snippet-content');
    const expandBtn = item.querySelector('.expand-btn');
    
    if (isExpanded) {
        // Collapse
        const truncated = snippet.content.length > TRUNCATE_LENGTH
            ? snippet.content.substring(0, TRUNCATE_LENGTH) + '...'
            : snippet.content;
        contentDiv.textContent = truncated;
        expandBtn.textContent = '+';
        item.classList.remove('expanded');
    } else {
        // Expand
        contentDiv.textContent = snippet.content;
        expandBtn.textContent = '-';
        item.classList.add('expanded');
    }
}

// Handle delete snippet
async function handleDeleteSnippet(snippetId) {
    if (!confirm('Delete this snippet?')) {
        return;
    }
    
    try {
        await api.deleteSnippet(snippetId);
        loadSnippets();
    } catch (error) {
        console.error('Failed to delete snippet:', error);
        alert('Failed to delete snippet');
    }
}

// Handle delete all
async function handleDeleteAll() {
    if (!confirm('Delete all snippets? This cannot be undone.')) {
        return;
    }
    
    // TODO: Implement delete all endpoint
    alert('Delete all functionality will be implemented soon');
}

// Handle search
async function handleSearch(e) {
    searchQuery = e.target.value.trim();
    
    if (searchQuery.length === 0) {
        loadSnippets();
        return;
    }
    
    try {
        if (loadingState) loadingState.style.display = 'block';
        const results = await api.searchSnippets(searchQuery);
        renderSnippets(results);
    } catch (error) {
        console.error('Search failed:', error);
    } finally {
        if (loadingState) loadingState.style.display = 'none';
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

