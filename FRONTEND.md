# Secure Clipboard - Frontend Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Chrome Extension Structure](#chrome-extension-structure)
3. [Component Architecture](#component-architecture)
4. [API Integration](#api-integration)
5. [Copy Event Detection](#copy-event-detection)
6. [UI Components](#ui-components)
7. [Current Limitations & Known Issues](#current-limitations--known-issues)
8. [Configuration](#configuration)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Chrome Extension (Frontend)                          │
│  ┌──────────────┐                                       │
│  │  Popup UI    │  (popup.html, popup.js)             │
│  │  - Login    │                                       │
│  │  - Register │                                       │
│  │  - Clipboard│                                       │
│  └──────┬───────┘                                       │
│         │                                               │
│  ┌──────▼───────────────────────────────────────────┐  │
│  │  Content Script (content.js)                     │  │
│  │  - Captures copy events from web pages           │  │
│  │  - Listens for Ctrl+C / Cmd+C                    │  │
│  │  - Sends messages to background script           │  │
│  └──────┬───────────────────────────────────────────┘  │
│         │                                               │
│         │ chrome.runtime.sendMessage()                  │
│         │                                               │
│  ┌──────▼───────────────────────────────────────────┐  │
│  │  Background Script (background.js)               │  │
│  │  - Service Worker                                 │  │
│  │  - Receives messages from content script          │  │
│  │  - Makes API calls to backend                    │  │
│  │  - Manages clipboard monitoring                  │  │
│  └──────┬───────────────────────────────────────────┘  │
│         │                                               │
│         │ HTTPS API Calls                               │
│         │ Authorization: Bearer <JWT>                  │
│         │                                               │
│         ▼                                               │
│  Spring Boot Backend (http://localhost:8080)           │
└─────────────────────────────────────────────────────────┘
```

### Extension Components

1. **Popup UI** (`popup.html`, `popup.js`)
   - Login/Register screens
   - Clipboard display
   - Search functionality
   - Snippet management

2. **Content Script** (`content.js`)
   - Injected into web pages
   - Captures copy events
   - Sends to background script

3. **Background Script** (`background.js`)
   - Service worker
   - Handles API communication
   - Manages copy events

4. **API Client** (`api.js`)
   - Backend API wrapper
   - Token management
   - Error handling

5. **Storage Utility** (`storage.js`)
   - Chrome storage wrapper
   - Token storage
   - Settings storage

---

## Chrome Extension Structure

### Manifest (`manifest.json`)

**Manifest Version:** V3

**Permissions:**
- `storage` - Chrome storage access
- `clipboardRead` - Read clipboard (limited in service workers)
- `clipboardWrite` - Write to clipboard
- `activeTab` - Access active tab
- `windows` - Window management
- `tabs` - Tab management

**Host Permissions:**
- `http://localhost:8080/*` - Backend API
- `https://*/*` - All HTTPS sites (for content script)

**Content Scripts:**
- Matches: `["http://*/*", "https://*/*"]`
- Script: `content.js`
- Run at: `document_idle`
- All frames: `false`

**Background:**
- Service worker: `background.js`

**Action:**
- Default popup: `popup.html`

**Commands:**
- `open-clipboard`: `Cmd+Shift+V` (Mac) / `Ctrl+Shift+V` (Windows)

---

## Component Architecture

### 1. Popup UI (`popup.html`, `popup.js`)

**Screens:**
1. **Login Screen**
   - Email input
   - Password input
   - Login button
   - Register button

2. **Register Screen**
   - Email input
   - Password input
   - Register button
   - Back to login button

3. **Clipboard Screen**
   - Search bar
   - Snippets list (50 latest)
   - Loading state
   - Empty state
   - Logout button
   - Delete all button

**Features:**
- **Search:** Case-sensitive search through snippets
- **Expand/Collapse:** `+` / `-` buttons to expand/collapse snippets
- **Copy:** Click snippet or copy button to copy
- **Delete:** `×` button to delete snippet (with confirmation)
- **Queue Update:** Clicking snippet moves it to top

**Snippet Display:**
- Truncated text (200 characters)
- Expand to see full content
- Copy button
- Delete button
- Expand/collapse button

**Event Handlers:**
- `handleLogin()` - Login form submission
- `handleRegister()` - Register form submission
- `handleLogout()` - Logout user
- `handleSearch()` - Search snippets (debounced 300ms)
- `handleDeleteSnippet()` - Delete single snippet
- `handleDeleteAll()` - Delete all snippets (not implemented)
- `copySnippet()` - Copy snippet to clipboard
- `toggleExpand()` - Expand/collapse snippet

---

### 2. Content Script (`content.js`)

**Purpose:** Capture copy events from web pages

**Initialization:**
- Runs on all `http://*/*` and `https://*/*` pages
- Skips `chrome://` and `extension://` pages
- Initializes immediately (no DOM wait)
- Adds event listeners at document and window level

**Event Listeners:**
1. **Copy Event** (`copy` event)
   - Captures selected text
   - Gets source URL
   - Sends to background script

2. **Keyboard Event** (`keydown` event)
   - Detects `Cmd+C` / `Ctrl+C`
   - Gets selection or reads clipboard
   - Sends to background script

**Message Format:**
```javascript
{
  action: 'copy',
  text: 'copied text',
  sourceUrl: 'https://example.com'
}
```

**Error Handling:**
- Checks extension context validity
- Handles "Extension context invalidated" gracefully
- Suppresses harmless errors

**Limitations:**
- Only works on web pages (not local files)
- Some sites may block content scripts (CSP)
- Requires page refresh after extension reload

---

### 3. Background Script (`background.js`)

**Purpose:** Service worker for API communication

**Responsibilities:**
1. **Message Handling**
   - Receives messages from content script
   - Processes copy events
   - Calls backend API

2. **Keyboard Shortcut**
   - Listens for `Cmd+Shift+V`
   - Opens popup window
   - Focuses existing window if open

3. **Copy Event Processing**
   - Validates text
   - Checks for duplicates (prevents concurrent processing)
   - Calls `handleCopyEvent()`
   - Updates last clipboard text

**Key Functions:**
- `handleCopyEvent()` - Processes copy and saves to backend
- `getToken()` - Gets JWT token from storage
- `clearToken()` - Clears token on logout
- `getApiBaseUrl()` - Gets API base URL

**Keep-Alive Mechanism:**
- Pings storage every 20 seconds
- Keeps service worker active longer

**Clipboard Monitoring:**
- **Status:** Disabled (service worker limitation)
- **Reason:** `navigator.clipboard` not available in service workers
- **Workaround:** Content script handles copy detection

**Error Handling:**
- Handles duplicate content errors (info logs)
- Handles authentication errors
- Handles network errors
- Prevents concurrent copy processing

---

### 4. API Client (`api.js`)

**Purpose:** Backend API wrapper

**Methods:**
- `call()` - Generic API call handler
- `login()` - User login
- `register()` - User registration
- `logout()` - User logout
- `getRecentSnippets()` - Get recent snippets
- `getSnippet()` - Get snippet by ID
- `searchSnippets()` - Search snippets
- `createSnippet()` - Create snippet
- `deleteSnippet()` - Delete snippet
- `updateSnippetAccess()` - Update queue order

**Features:**
- Automatic token injection
- 204 No Content handling
- Error message extraction
- Network error handling
- CORS error handling
- 60-second timeout

**Token Management:**
- Gets token from `storage.getToken()`
- Adds to `Authorization` header
- Clears token on 401/403 errors

**Error Handling:**
- Extracts error messages from responses
- Handles network errors
- Handles CORS errors
- Provides descriptive error messages

---

### 5. Storage Utility (`storage.js`)

**Purpose:** Chrome storage wrapper

**Methods:**
- `getToken()` - Get JWT token
- `setToken()` - Save JWT token
- `clearToken()` - Remove JWT token
- `getApiBaseUrl()` - Get API base URL
- `setApiBaseUrl()` - Set API base URL

**Storage Keys:**
- `jwt_token` - JWT access token
- `api_base_url` - Backend API URL (default: `http://localhost:8080`)

---

## API Integration

### Authentication Flow

```
1. User enters credentials in popup
   ↓
2. popup.js calls api.login() or api.register()
   ↓
3. api.js makes POST request to /api/v1/auth/login
   ↓
4. Backend returns tokens
   ↓
5. storage.setToken() saves access token
   ↓
6. Popup shows clipboard screen
```

### Copy Event Flow

```
1. User copies text on webpage
   ↓
2. content.js detects copy event
   ↓
3. Sends message to background.js
   ↓
4. background.js calls handleCopyEvent()
   ↓
5. Makes POST request to /api/v1/snippets
   ↓
6. Backend saves snippet
   ↓
7. Background script logs success
```

### Snippet Retrieval Flow

```
1. Popup opens
   ↓
2. popup.js calls api.getRecentSnippets()
   ↓
3. api.js makes GET request to /api/v1/snippets
   ↓
4. Backend returns snippets
   ↓
5. popup.js renders snippets
```

---

## Copy Event Detection

### How It Works

**Content Script Approach:**
1. Content script injected into web pages
2. Listens for `copy` events (capture phase)
3. Listens for `Cmd+C` / `Ctrl+C` keyboard events
4. Captures selected text or reads clipboard
5. Sends message to background script

**Event Listeners:**
- `document.addEventListener('copy', handleCopyEvent, true)`
- `window.addEventListener('copy', handleCopyEvent, true)`
- `document.addEventListener('keydown', handleKeyDown, true)`
- `window.addEventListener('keydown', handleKeyDown, true)`

**Capture Phase:**
- Uses capture phase (`true` parameter)
- Fires before default browser behavior
- Ensures we capture the event

**Text Capture:**
1. Try `window.getSelection().toString()` first
2. Fallback to `e.clipboardData.getData('text/plain')`
3. Fallback to `navigator.clipboard.readText()` (for keyboard events)

**Message Sending:**
```javascript
chrome.runtime.sendMessage({
  action: 'copy',
  text: selectedText,
  sourceUrl: window.location.href
}, (response) => {
  // Handle response
});
```

### Limitations

**Web Pages Only:**
- Content script only runs on `http://*/*` and `https://*/*`
- Does not run on `chrome://` or `extension://` pages
- Does not run on local files (`file://`)

**CSP Blocking:**
- Some websites block content scripts
- Content Security Policy violations
- Cannot be fixed from extension side

**Extension Reload:**
- Content script needs page refresh after extension reload
- Extension context may become invalidated
- Handled gracefully with error checks

**Global Clipboard:**
- Service workers don't have clipboard API access
- Cannot monitor clipboard from other apps
- Cannot capture copy from local files
- **Workaround:** Content script works on web pages

---

## UI Components

### Popup HTML Structure

```html
<div id="app">
  <!-- Login Screen -->
  <div id="loginScreen">
    <form id="loginForm">
      <input type="email" id="email">
      <input type="password" id="password">
      <button type="submit">Login</button>
      <button id="registerBtn">Register</button>
    </form>
  </div>

  <!-- Register Screen -->
  <div id="registerScreen">
    <form id="registerForm">
      <input type="email" id="regEmail">
      <input type="password" id="regPassword">
      <button type="submit">Register</button>
      <button id="backToLoginBtn">Back to Login</button>
    </form>
  </div>

  <!-- Clipboard Screen -->
  <div id="clipboardScreen">
    <div class="header">
      <input type="text" id="searchInput" placeholder="type to search...">
      <button id="logoutBtn">Logout</button>
    </div>
    
    <div id="loadingState">Loading snippets...</div>
    <div id="emptyState">No snippets yet</div>
    
    <div id="snippetsContainer">
      <!-- Snippets rendered here -->
    </div>
    
    <div class="footer">
      <button id="deleteAllBtn">Clear all</button>
    </div>
  </div>
</div>
```

### Snippet Element Structure

```html
<div class="snippet-item" data-snippet-id="123">
  <div class="snippet-content">Truncated text...</div>
  <div class="snippet-actions">
    <button class="copy-btn">📋</button>
    <button class="expand-btn">+</button>
    <button class="delete-btn">×</button>
  </div>
</div>
```

### Styling (`styles.css`)

**Theme:** Dark theme (Maccy-inspired)
- Background: Dark gray
- Text: Light gray/white
- Accents: Green/blue
- Minimalistic design

**Features:**
- Smooth animations
- Responsive layout
- Hover effects
- Loading states
- Empty states

---

## Current Limitations & Known Issues

### 1. Copy Detection Issues

**Problem:** Copy only works on some websites (e.g., google.com)

**Possible Causes:**
1. Content script not injecting on some sites
2. CSP (Content Security Policy) blocking
3. Event listeners not attaching properly
4. Sites blocking extension scripts

**Debugging:**
- Check browser console for "Content script initialized" message
- Check for CSP errors
- Verify content script matches site URL pattern
- Check background script console for messages

**Workaround:**
- Global clipboard monitoring disabled (service worker limitation)
- Content script is primary method
- Some sites may not work due to CSP

---

### 2. Popup Sync Issue

**Problem:** Shortcut opens different popup than clicking extension icon

**Explanation:**
- Shortcut opens popup window (`chrome.windows.create`)
- Extension icon opens default Chrome popup
- These are separate instances, not synced

**Limitation:**
- Chrome extensions cannot programmatically open default popup
- Shortcut opens popup window (best we can do)
- Both work independently

---

### 3. Keyboard Shortcut Limitations

**Shortcut:** `Cmd+Shift+V` (Mac) / `Ctrl+Shift+V` (Windows)

**Limitations:**
- Only works within Chrome (not system-wide)
- Cannot work outside Chrome (Chrome limitation)
- Requires Chrome to be focused

**Future Enhancement:**
- Native app for system-wide shortcuts
- Or accept Chrome-only limitation

---

### 4. Global Clipboard Monitoring

**Status:** Disabled

**Reason:**
- `navigator.clipboard` not available in service workers
- Service worker context doesn't have clipboard API access
- Chrome extension limitation

**Current Solution:**
- Content script detects copy on web pages
- Works for web pages only
- Does not work for local files or other apps

**Future Enhancement:**
- Native app for system-wide clipboard monitoring
- Or accept web-page-only limitation

---

### 5. Queue Update Issue

**Problem:** Queue arrangement not working initially

**Status:** Fixed

**Solution:**
- Backend endpoint `/api/v1/snippets/{id}/access` implemented
- Frontend calls endpoint when snippet is clicked
- Queue updates correctly

**Note:** Requires popup reload to see updated order

---

### 6. Error Handling

**Current Issues:**
- Some errors show generic messages
- Network errors not always descriptive
- CORS errors may be unclear

**Improvements Made:**
- Better error message extraction
- Network error handling
- CORS error messages
- 204 No Content handling

---

### 7. Extension Context Invalidated

**Problem:** "Extension context invalidated" errors

**Cause:**
- Extension reloaded while pages are open
- Background script context becomes invalid
- Content script tries to send messages to invalid context

**Solution:**
- Added context validation checks
- Graceful error handling
- Suppresses harmless errors
- Logs info messages instead of errors

---

## Configuration

### API Base URL

**Default:** `http://localhost:8080`

**Storage Key:** `api_base_url`

**To Change:**
```javascript
await storage.setApiBaseUrl('https://your-api-url.com');
```

**Future:** Settings page for easier configuration

---

### Token Storage

**Storage Key:** `jwt_token`

**Storage Type:** `chrome.storage.local`

**Lifetime:**
- Access token: 15 minutes
- Stored until expiration or logout
- Cleared on 401/403 errors

---

## File Structure

```
extension/
├── manifest.json          # Extension configuration
├── popup.html            # Popup UI HTML
├── popup.js              # Popup UI logic
├── background.js         # Service worker (API calls)
├── content.js            # Content script (copy detection)
├── api.js                # API client
├── storage.js            # Storage utility
├── styles.css            # Popup styling
└── icons/                # Extension icons (placeholder)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Event Flow Diagrams

### Copy Event Flow

```
User copies text on webpage
    ↓
content.js detects copy event
    ↓
Gets selected text
    ↓
Sends message to background.js
    ↓
background.js receives message
    ↓
Checks if already processing
    ↓
Calls handleCopyEvent()
    ↓
Makes POST /api/v1/snippets
    ↓
Backend saves snippet
    ↓
Returns success
    ↓
Background script logs success
```

### Authentication Flow

```
User opens popup
    ↓
popup.js checks authentication
    ↓
No token → Show login screen
Has token → Show clipboard screen
    ↓
User enters credentials
    ↓
popup.js calls api.login()
    ↓
api.js makes POST /api/v1/auth/login
    ↓
Backend validates credentials
    ↓
Returns tokens
    ↓
storage.setToken() saves token
    ↓
Popup shows clipboard screen
    ↓
loadSnippets() fetches snippets
```

---

## Known Issues Summary

### Critical Issues
1. ❌ **Copy detection not working on all websites**
   - Some sites block content scripts (CSP)
   - Content script may not inject properly
   - **Status:** Needs debugging per site

2. ❌ **Global clipboard monitoring disabled**
   - Service worker limitation
   - Cannot capture copy from local files
   - **Status:** Cannot fix (Chrome limitation)

### Minor Issues
1. ⚠️ **Popup sync issue**
   - Shortcut and icon open different instances
   - **Status:** Chrome limitation, acceptable

2. ⚠️ **Keyboard shortcut only works in Chrome**
   - Not system-wide
   - **Status:** Chrome limitation, acceptable

3. ⚠️ **Extension context invalidated errors**
   - Happens when extension reloaded
   - **Status:** Handled gracefully

4. ⚠️ **Queue update requires popup reload**
   - Order updates but UI doesn't refresh
   - **Status:** Minor UX issue

---

## Performance Considerations

### Content Script
- **Initialization:** Immediate (no DOM wait)
- **Event Listeners:** Document + window level
- **Memory:** Minimal (no data storage)

### Background Script
- **Service Worker:** Goes inactive when not in use
- **Keep-Alive:** Pings storage every 20 seconds
- **API Calls:** 60-second timeout

### Popup UI
- **Loading:** Shows loading state during API calls
- **Debouncing:** Search debounced 300ms
- **Rendering:** Efficient DOM manipulation

---

## Security Considerations

### Token Storage
- **Storage:** `chrome.storage.local` (encrypted by Chrome)
- **Lifetime:** 15 minutes (access token)
- **Clear on:** Logout, 401/403 errors

### API Calls
- **HTTPS:** Required in production
- **CORS:** Configured for Chrome extensions
- **Authorization:** Bearer token in header

### Content Script
- **Isolation:** Runs in isolated context
- **Permissions:** Only clipboardRead/clipboardWrite
- **No Access:** Cannot access page's JavaScript variables

---

## Testing Checklist

### Copy Detection
- [ ] Copy works on google.com
- [ ] Copy works on github.com
- [ ] Copy works on stackoverflow.com
- [ ] Copy works on other websites
- [ ] Check console for "Content script initialized"
- [ ] Check background script for messages

### Authentication
- [ ] Register new user
- [ ] Login with credentials
- [ ] Logout clears token
- [ ] Token persists across popup closes

### Snippet Management
- [ ] Create snippet via copy
- [ ] View snippets in popup
- [ ] Search snippets
- [ ] Expand/collapse snippets
- [ ] Copy snippet to clipboard
- [ ] Delete snippet
- [ ] Queue updates on click

### Keyboard Shortcut
- [ ] `Cmd+Shift+V` opens popup
- [ ] Focuses existing window if open
- [ ] Creates new window if none exists

---

## Future Enhancements

### Planned Features
1. **Settings Page**
   - Configure API URL
   - Configure keyboard shortcuts
   - Configure snippet limits

2. **Delete All**
   - Backend endpoint (not implemented)
   - Frontend UI (button exists)

3. **Better Error Messages**
   - More descriptive errors
   - User-friendly messages

4. **Offline Support**
   - Cache snippets locally
   - Sync when online

### Known Limitations
1. **Global Clipboard:** Cannot be fixed (Chrome limitation)
2. **System Shortcuts:** Cannot be fixed (Chrome limitation)
3. **CSP Blocking:** Cannot be fixed (site security)

---

## Summary

The frontend is a **Chrome Extension (Manifest V3)** with:

✅ **Copy detection** on web pages (content script)
✅ **Popup UI** for snippet management
✅ **API integration** with backend
✅ **Token management** via Chrome storage
✅ **Error handling** for common scenarios

**Key Strengths:**
- Simple, minimalistic UI
- Fast snippet access
- Secure token storage
- Good error handling

**Current Limitations:**
- Copy detection only works on web pages
- Global clipboard monitoring disabled
- Keyboard shortcut only works in Chrome
- Some sites may block content scripts

**Areas for Future Enhancement:**
- Better copy detection on all sites
- Native app for system-wide clipboard
- Settings page for configuration
- Offline support with local caching

