/**
 * Main Application Logic
 * Maccy-inspired clipboard manager UI
 */

const TRUNCATE_LENGTH = 200;
let snippets = [];
let selectedIndex = -1;
let searchQuery = '';

// DOM Elements - will be initialized after DOM loads
let snippetsContainer;
let searchInput;
let loadingState;
let emptyState;
let loginModal;
let registerModal;
let addSnippetModal;
let deleteAllBtn;
let addSnippetBtn;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    snippetsContainer = document.getElementById('snippetsContainer');
    searchInput = document.getElementById('searchInput');
    loadingState = document.getElementById('loadingState');
    emptyState = document.getElementById('emptyState');
    loginModal = document.getElementById('loginModal');
    registerModal = document.getElementById('registerModal');
    addSnippetModal = document.getElementById('addSnippetModal');
    deleteAllBtn = document.getElementById('deleteAllBtn');
    addSnippetBtn = document.getElementById('addSnippetBtn');
    
    // Verify critical elements exist
    if (!snippetsContainer || !loadingState || !emptyState) {
        console.error('Critical DOM elements missing:', {
            snippetsContainer: !!snippetsContainer,
            loadingState: !!loadingState,
            emptyState: !!emptyState
        });
        return;
    }
    
    checkAuthentication();
    setupEventListeners();
    setupKeyboardShortcuts();
});

// Check if user is authenticated
function checkAuthentication() {
    const token = getToken();
    if (!token) {
        showLoginModal();
    } else {
        hideLoginModal();
        loadSnippets();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    const registerBtn = document.getElementById('registerBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            if (loginModal) loginModal.style.display = 'none';
            if (registerModal) registerModal.style.display = 'flex';
        });
    }
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', () => {
            if (registerModal) registerModal.style.display = 'none';
            if (loginModal) loginModal.style.display = 'flex';
        });
    }
    
    // Add snippet
    if (addSnippetBtn) {
        addSnippetBtn.addEventListener('click', () => {
            showAddSnippetModal();
        });
    }
    
    const addSnippetForm = document.getElementById('addSnippetForm');
    const cancelAddBtn = document.getElementById('cancelAddBtn');
    if (addSnippetForm) {
        addSnippetForm.addEventListener('submit', handleAddSnippet);
    }
    if (cancelAddBtn) {
        cancelAddBtn.addEventListener('click', () => {
            hideAddSnippetModal();
        });
    }
    
    // Delete all
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', handleDeleteAll);
    }
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Keyboard shortcut: Cmd+V to add snippet
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !e.target.matches('textarea, input')) {
            // Don't interfere with normal paste in inputs
            if (document.activeElement.tagName !== 'INPUT' && 
                document.activeElement.tagName !== 'TEXTAREA') {
                e.preventDefault();
                showAddSnippetModal();
                // Focus textarea and paste
                setTimeout(() => {
                    const textarea = document.getElementById('snippetContent');
                    if (textarea) {
                        textarea.focus();
                        textarea.select();
                    }
                }, 100);
            }
        }
    });
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't interfere if typing in input/textarea
        if (e.target.matches('input, textarea')) {
            return;
        }
        
        // Cmd+Shift+Q or Ctrl+Shift+Q - Toggle UI visibility (if implemented as overlay)
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Q') {
            e.preventDefault();
            // Could toggle visibility if implemented as overlay
        }
        
        // Cmd+V or Ctrl+V - Add snippet (handled in setupEventListeners)
        
        // Arrow keys for navigation
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateSnippets(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateSnippets(-1);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            const snippet = snippets[selectedIndex];
            if (snippet) {
                copyAndClose(snippet.id, snippet.content);
            }
        }
    });
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        await authAPI.login(email, password);
        hideLoginModal();
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
        await authAPI.register(email, password);
        hideLoginModal();
        loadSnippets();
    } catch (error) {
        errorDiv.textContent = error.message || 'Registration failed';
        errorDiv.style.display = 'block';
    }
}

// Show/hide login modal
function showLoginModal() {
    if (loginModal) loginModal.style.display = 'flex';
}

function hideLoginModal() {
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'none';
}

// Load snippets
async function loadSnippets() {
    if (!loadingState || !emptyState || !snippetsContainer) {
        console.error('DOM elements not initialized');
        return;
    }
    
    showLoading();
    
    try {
        snippets = await snippetAPI.getRecentSnippets();
        renderSnippets();
    } catch (error) {
        console.error('Failed to load snippets:', error);
        hideLoading(); // Always hide loading on error
        if (error.message && (error.message.includes('Authentication') || error.message.includes('401'))) {
            clearToken();
            showLoginModal();
        } else {
            // Show empty state with error message
            showEmptyState();
            const emptyText = emptyState ? emptyState.querySelector('.empty-text') : null;
            const emptySubtext = emptyState ? emptyState.querySelector('.empty-subtext') : null;
            if (emptyText) emptyText.textContent = 'Failed to load snippets';
            if (emptySubtext) emptySubtext.textContent = error.message || 'Please try again';
        }
    }
}

// Handle search
function handleSearch(e) {
    searchQuery = e.target.value.trim();
    
    if (searchQuery === '') {
        loadSnippets();
    } else {
        performSearch(searchQuery);
    }
}

// Perform search
async function performSearch(query) {
    showLoading();
    
    try {
        snippets = await snippetAPI.searchSnippets(query);
        renderSnippets();
    } catch (error) {
        console.error('Search failed:', error);
        hideLoading(); // Always hide loading on error
        showEmptyState();
        emptyState.querySelector('.empty-text').textContent = 'Search failed';
        emptyState.querySelector('.empty-subtext').textContent = error.message || 'Please try again';
    }
}

// Render snippets
function renderSnippets() {
    if (!snippetsContainer || !loadingState || !emptyState) {
        console.error('DOM elements not initialized');
        return;
    }
    
    hideLoading();
    
    if (!snippets || snippets.length === 0) {
        showEmptyState();
        return;
    }
    
    hideEmptyState();
    
    snippetsContainer.innerHTML = '';
    selectedIndex = -1;
    
    snippets.forEach((snippet, index) => {
        const snippetElement = createSnippetElement(snippet, index);
        if (snippetsContainer) {
            snippetsContainer.appendChild(snippetElement);
        }
    });
}

// Create snippet element
function createSnippetElement(snippet, index) {
    const item = document.createElement('div');
    item.className = 'snippet-item';
    item.dataset.snippetId = snippet.id;
    item.dataset.index = index;
    
    // Handle empty content (snippet still processing)
    const fullContent = snippet.content || '';
    const truncatedContent = truncateText(fullContent, TRUNCATE_LENGTH);
    const needsFullContent = fullContent === '' || fullContent.length <= TRUNCATE_LENGTH;
    
    item.innerHTML = `
        <div class="snippet-content-wrapper collapsed">
            <div class="snippet-content">${escapeHtml(truncatedContent || 'Processing...')}</div>
        </div>
        <div class="snippet-actions">
            ${needsFullContent ? '' : '<button class="btn-action btn-expand" data-action="expand"><span class="expand-icon">+</span> Expand</button>'}
            <button class="btn-action btn-copy" data-action="copy">Copy</button>
        </div>
        <button class="snippet-delete" data-action="delete" title="Delete">×</button>
    `;
    
    // Store full content in dataset (will be fetched if empty)
    item.dataset.fullContent = fullContent;
    item.dataset.snippetId = snippet.id;
    item.dataset.isExpanded = 'false';
    item.dataset.needsFetch = needsFullContent && fullContent === '' ? 'true' : 'false';
    
    // Event listeners
    setupSnippetListeners(item, snippet);
    
    return item;
}

// Setup snippet event listeners
function setupSnippetListeners(item, snippet) {
    if (!item || !snippet) {
        console.warn('Cannot setup snippet listeners: item or snippet is null');
        return;
    }
    
    const expandBtn = item.querySelector('[data-action="expand"]');
    const copyBtn = item.querySelector('[data-action="copy"]');
    const deleteBtn = item.querySelector('[data-action="delete"]');
    const contentWrapper = item.querySelector('.snippet-content-wrapper');
    const contentDiv = item.querySelector('.snippet-content');
    
    // Expand/Collapse - only if expand button exists
    if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExpand(item);
        });
    }
    
    // Copy button - must exist
    if (copyBtn) {
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            copySnippet(snippet.id, snippet.content);
        });
    } else {
        console.warn('Copy button not found for snippet:', snippet.id);
    }
    
    // Delete button - must exist
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteSnippet(snippet.id);
        });
    } else {
        console.warn('Delete button not found for snippet:', snippet.id);
    }
    
    // Click anywhere else → copy + move to top + close
    item.addEventListener('click', (e) => {
        // Don't trigger if clicking buttons
        if (e.target.closest('.btn-action') || e.target.closest('.snippet-delete')) {
            return;
        }
        
        copyAndClose(snippet.id, snippet.content);
    });
    
    // Hover selection
    item.addEventListener('mouseenter', () => {
        selectSnippet(item.dataset.index);
    });
}

// Toggle expand/collapse
async function toggleExpand(item) {
    const isExpanded = item.dataset.isExpanded === 'true';
    let fullContent = item.dataset.fullContent;
    const contentWrapper = item.querySelector('.snippet-content-wrapper');
    const contentDiv = item.querySelector('.snippet-content');
    const expandBtn = item.querySelector('[data-action="expand"]');
    
    // Fetch full content if needed
    if (item.dataset.needsFetch === 'true' && !isExpanded) {
        try {
            const snippetId = item.dataset.snippetId;
            const snippet = await snippetAPI.getSnippet(snippetId);
            fullContent = snippet.content || '';
            item.dataset.fullContent = fullContent;
            item.dataset.needsFetch = 'false';
        } catch (error) {
            console.error('Failed to fetch full content:', error);
            return;
        }
    }
    
    if (isExpanded) {
        // Collapse
        contentDiv.textContent = truncateText(fullContent, TRUNCATE_LENGTH);
        contentWrapper.classList.remove('expanded');
        contentWrapper.classList.add('collapsed');
        expandBtn.innerHTML = '<span class="expand-icon">+</span> Expand';
        item.dataset.isExpanded = 'false';
    } else {
        // Expand
        contentDiv.textContent = fullContent;
        contentWrapper.classList.remove('collapsed');
        contentWrapper.classList.add('expanded');
        expandBtn.innerHTML = '<span class="expand-icon">-</span> Collapse';
        item.dataset.isExpanded = 'true';
    }
}

// Copy snippet
async function copySnippet(snippetId, content) {
    try {
        // If content is empty, fetch full content first
        let fullContent = content;
        if (!fullContent || fullContent === '') {
            const snippet = await snippetAPI.getSnippet(snippetId);
            fullContent = snippet.content || '';
        }
        
        // Copy to clipboard
        await navigator.clipboard.writeText(fullContent);
        
        // Move to top of queue (getSnippet API call moves it to front)
        // Already called above, but call again to ensure it's at top
        await snippetAPI.getSnippet(snippetId);
        
        // Visual feedback
        showCopyFeedback();
    } catch (error) {
        console.error('Copy failed:', error);
        alert('Failed to copy to clipboard');
    }
}

// Copy and close
async function copyAndClose(snippetId, content) {
    await copySnippet(snippetId, content);
    // Close UI (if implemented as overlay/popup)
    // For now, just reload to show updated order
    setTimeout(() => {
        loadSnippets();
    }, 300);
}

// Delete snippet
async function handleDeleteSnippet(snippetId) {
    if (!confirm('Delete this snippet?')) {
        return;
    }
    
    try {
        await snippetAPI.deleteSnippet(snippetId);
        loadSnippets(); // Reload to update list
    } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete snippet');
    }
}

// Constants
const MAX_SNIPPET_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

// Add snippet
function showAddSnippetModal() {
    if (!addSnippetModal) {
        console.error('Add snippet modal not found');
        return;
    }
    addSnippetModal.style.display = 'flex';
    const contentInput = document.getElementById('snippetContent');
    const sourceInput = document.getElementById('sourceUrl');
    const errorDiv = document.getElementById('addSnippetError');
    if (contentInput) {
        contentInput.value = '';
        // Setup paste event listener for size validation (only if errorDiv exists)
        if (errorDiv) {
            setupPasteValidation(contentInput, errorDiv);
        }
    }
    if (sourceInput) sourceInput.value = '';
    if (errorDiv) errorDiv.style.display = 'none';
}

// Setup paste validation - check size BEFORE paste completes
function setupPasteValidation(textarea, errorDiv) {
    // Null checks
    if (!textarea || !errorDiv) {
        console.warn('Cannot setup paste validation: textarea or errorDiv is null');
        return;
    }
    
    // Define handler function first
    function handlePasteValidation(e) {
        // Get clipboard data
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;
        
        const pastedText = clipboardData.getData('text');
        if (!pastedText) return;
        
        // Calculate size in bytes (UTF-8 encoding)
        const sizeBytes = new Blob([pastedText]).size;
        
        // Check if exceeds limit
        if (sizeBytes > MAX_SNIPPET_SIZE_BYTES) {
            e.preventDefault(); // Prevent paste
            const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
            const maxMB = (MAX_SNIPPET_SIZE_BYTES / (1024 * 1024)).toFixed(0);
            errorDiv.textContent = `Content too large: ${sizeMB} MB (maximum: ${maxMB} MB)`;
            errorDiv.style.display = 'block';
            
            // Scroll to error
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return false;
        }
        
        // Clear error if size is OK
        errorDiv.style.display = 'none';
    }
    
    // Remove existing listener if any (using the same function reference)
    // Store handler on element for cleanup
    if (textarea._pasteHandler) {
        textarea.removeEventListener('paste', textarea._pasteHandler);
    }
    
    // Store handler reference for future cleanup
    textarea._pasteHandler = handlePasteValidation;
    
    // Add paste event listener
    textarea.addEventListener('paste', handlePasteValidation);
}

function hideAddSnippetModal() {
    if (addSnippetModal) {
        addSnippetModal.style.display = 'none';
    }
}

async function handleAddSnippet(e) {
    e.preventDefault();
    const contentInput = document.getElementById('snippetContent');
    const sourceUrlInput = document.getElementById('sourceUrl');
    const errorDiv = document.getElementById('addSnippetError');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    if (!contentInput || !errorDiv || !submitBtn) {
        console.error('Required elements not found');
        return;
    }
    
    const content = contentInput.value.trim();
    const sourceUrl = sourceUrlInput ? sourceUrlInput.value.trim() || null : null;
    
    if (!content) {
        errorDiv.textContent = 'Content cannot be empty';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Client-side size validation before sending
    const sizeBytes = new Blob([content]).size;
    if (sizeBytes > MAX_SNIPPET_SIZE_BYTES) {
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
        const maxMB = (MAX_SNIPPET_SIZE_BYTES / (1024 * 1024)).toFixed(0);
        errorDiv.textContent = `Content too large: ${sizeMB} MB (maximum: ${maxMB} MB)`;
        errorDiv.style.display = 'block';
        return;
    }
    
    // Store original button state
    const originalText = submitBtn.textContent;
    const originalDisabled = submitBtn.disabled;
    
    try {
        errorDiv.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        
        // Show size info for large files
        const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
        if (sizeBytes > 1024 * 1024) { // > 1MB
            submitBtn.textContent = `Saving ${sizeMB} MB...`;
        }
        
        // Use requestAnimationFrame to ensure UI updates before blocking operation
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        await snippetAPI.createSnippet(content, sourceUrl);
        
        // Success - hide modal and reload
        hideAddSnippetModal();
        loadSnippets(); // Reload to show new snippet
    } catch (error) {
        console.error('Failed to create snippet:', error);
        // Extract actual error message from error object
        let errorMessage = 'Failed to create snippet';
        if (error.message) {
            errorMessage = error.message;
        } else if (error.error) {
            // Handle error response object from API
            errorMessage = error.error.message || error.error.error || errorMessage;
        }
        errorDiv.textContent = errorMessage;
        errorDiv.style.display = 'block';
        
        // Scroll to error
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
        // Always restore button state, even on error
        submitBtn.disabled = originalDisabled;
        submitBtn.textContent = originalText;
    }
}

// Delete all
async function handleDeleteAll() {
    if (!confirm('Delete all snippets? This cannot be undone.')) {
        return;
    }
    
    // TODO: Implement delete all endpoint
    alert('Delete all functionality will be implemented soon');
}

// Logout
async function handleLogout() {
    try {
        await authAPI.logout();
        // Clear token and reload to show login modal
        window.location.reload();
    } catch (error) {
        console.error('Logout failed:', error);
        // Even if logout fails, clear token and reload
        clearToken();
        window.location.reload();
    }
}

// Navigate snippets with arrow keys
function navigateSnippets(direction) {
    if (snippets.length === 0) return;
    
    selectedIndex += direction;
    
    if (selectedIndex < 0) {
        selectedIndex = snippets.length - 1;
    } else if (selectedIndex >= snippets.length) {
        selectedIndex = 0;
    }
    
    selectSnippet(selectedIndex);
}

// Select snippet
function selectSnippet(index) {
    // Remove previous selection
    document.querySelectorAll('.snippet-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selection
    const item = document.querySelector(`[data-index="${index}"]`);
    if (item) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        selectedIndex = index;
    }
}

// Utility functions
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

function showLoading() {
    if (loadingState) loadingState.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';
    if (snippetsContainer) snippetsContainer.style.display = 'none';
}

function hideLoading() {
    if (loadingState) loadingState.style.display = 'none';
}

function showEmptyState() {
    if (emptyState) emptyState.style.display = 'flex';
    if (snippetsContainer) snippetsContainer.style.display = 'none';
}

function hideEmptyState() {
    if (emptyState) emptyState.style.display = 'none';
    if (snippetsContainer) snippetsContainer.style.display = 'block';
}

function showError(message) {
    alert(message); // Simple error display, can be improved
}

function showCopyFeedback() {
    // Visual feedback for copy (can be improved with toast notification)
    const selectedItem = document.querySelector('.snippet-item.selected');
    if (selectedItem) {
        selectedItem.style.backgroundColor = 'var(--success-color)';
        setTimeout(() => {
            selectedItem.style.backgroundColor = '';
        }, 200);
    }
}

