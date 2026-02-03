# UI Implementation Plan - Final Version

## 🎯 Design Requirements

### Core Principles
- **Very simplistic** - Minimal design
- **Small footprint** - Doesn't occupy large screen space
- **Responsive** - No UI hanging, fast interactions
- **Clean** - Focus on functionality over aesthetics
- **Smooth Animations** - Dynamic, fluid transitions (not static/framy)
- **Chrome Extension Ready** - Architecture supports future Chrome Extension integration

---

## 📋 Feature Specifications

### 1. Snippet Display
- **50 latest snippets** in a list
- **Truncated text**: First 200 characters + "..."
- **Fixed panel height**: Consistent size for all snippets
- **Same styling**: Uniform appearance

### 2. Expand/Collapse Functionality
- **+ button**: Expand to show full text
- **- button**: Collapse back to truncated view
- **Responsive**: No hanging, smooth transitions
- **Focus**: Optimize for performance with large snippets
- **Animations**: Smooth expand/collapse transitions (CSS transitions, not instant)
- **Performance**: Use CSS transforms/opacity for GPU acceleration

### 3. Copy Functionality
- **Copy button**: Explicit copy button per snippet
- **Click anywhere else**: Clicking snippet panel (not + / - buttons) should:
  1. Copy text to clipboard
  2. Move snippet to top of queue (via API call)
  3. Close the snippet display UI
- **After copy**: UI closes automatically
- **On reopen**: Latest copied snippet appears at top (handled by Redis queue)

### 4. Search Bar
- **Location**: Top of snippet list
- **Styling**: Same theme as snippet panels
- **Functionality**: Real-time search (debounced)
- **API**: Uses `GET /api/v1/snippets/search?query=...`

### 5. Delete Functionality
- **X button**: Per snippet, top-right corner
- **Confirmation**: Prompt before deletion ("Delete this snippet?")
- **API**: `DELETE /api/v1/snippets/{id}`
- **Delete All**: Button at bottom (UI only, backend to be implemented later)
- **Confirmation**: Prompt before delete all ("Delete all snippets?")

### 6. Keyboard Shortcut
- **Shortcut**: Cmd+Shift+Q (Mac) / Ctrl+Shift+Q (Windows/Linux)
- **Behavior**: Page-focused (works when UI page is open)
- **Action**: Toggle snippet display visibility

### 7. Loading State
- **When**: While fetching snippets from API
- **Display**: Spinner or "Loading..." message
- **Location**: Center of snippet area

### 8. Empty State
- **When**: User has no snippets
- **Display**: Friendly message ("No snippets yet. Copy some text to get started!")
- **Styling**: Centered, minimal

---

## 🎨 UI Layout

### Minimal Design
```
┌─────────────────────────────────┐
│  [Search Bar - minimal]         │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Text preview...         [X] │ │
│ │ [+/-] [Copy]                 │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Another snippet...      [X] │ │
│ │ [+/-] [Copy]                 │ │
│ └─────────────────────────────┘ │
│ ... (up to 50)                  │
├─────────────────────────────────┤
│ [Delete All]                    │
└─────────────────────────────────┘
```

### Expanded View
```
┌─────────────────────────────────┐
│ Full text content...            │
│ (scrollable if long)            │
│                                 │
│ [- Collapse] [Copy Full]    [X] │
└─────────────────────────────────┘
```

### Size Constraints
- **Max width**: 600px (or smaller)
- **Max height**: 80% of viewport
- **Compact**: Minimal padding/margins
- **Scrollable**: If more than viewport height

---

## 🔧 Technical Implementation

### File Structure
```
src/main/resources/
├── static/
│   ├── index.html          # Main UI page
│   ├── css/
│   │   └── style.css       # Minimal styling
│   └── js/
│       ├── app.js          # Main application logic
│       ├── api.js          # API client (JWT handling)
│       └── ui.js           # UI utilities (expand/collapse, copy)
```

### Key Functions

#### 1. Copy Snippet
```javascript
async function copySnippet(snippetId, content) {
    // Copy to clipboard
    await navigator.clipboard.writeText(content);
    
    // Move to top of queue (API call)
    await fetch(`/api/v1/snippets/${snippetId}`, { method: 'GET' });
    // Note: getSnippet() already moves to front via Redis
    
    // Close UI
    window.close(); // or hide UI
}
```

#### 2. Expand/Collapse
```javascript
function toggleExpand(snippetId) {
    const snippet = document.getElementById(`snippet-${snippetId}`);
    const isExpanded = snippet.dataset.expanded === 'true';
    
    if (isExpanded) {
        // Collapse: Show truncated view
        showTruncated(snippet);
    } else {
        // Expand: Show full text (lazy load if needed)
        showFullText(snippet);
    }
}
```

#### 3. Click Handler
```javascript
snippetPanel.addEventListener('click', (e) => {
    // Don't trigger if clicking buttons
    if (e.target.classList.contains('btn-expand') || 
        e.target.classList.contains('btn-copy') ||
        e.target.classList.contains('btn-delete')) {
        return;
    }
    
    // Click anywhere else → copy + move to top + close
    copySnippet(snippetId, content);
});
```

---

## 🔐 Authentication Handling

### Challenge
- Spring Boot serves static files from `/static/`
- API endpoints require JWT authentication
- Need to handle login and token storage

### Solution Options

**Option A: Separate Login Page** (Recommended)
- `/login.html` - Login form
- `/index.html` - Main UI (requires auth)
- Store JWT in localStorage
- Redirect to login if no token

**Option B: Login Modal**
- Single page with login modal
- Show modal if not authenticated
- Hide modal after login

**Recommendation**: Option A (simpler, cleaner)

### Token Storage
- **Storage**: `localStorage.setItem('jwt_token', token)`
- **API Calls**: Include in `Authorization: Bearer <token>` header
- **Expiry**: Handle 401 responses, redirect to login

---

## 📝 Implementation Steps

### Phase 1: Setup & Structure
1. Create `src/main/resources/static/` directory structure
2. Create `index.html` with basic layout
3. Create `login.html` for authentication
4. Create `css/style.css` with minimal styling
5. Configure Spring Boot to serve static files (already works by default)

### Phase 2: Authentication
1. Create `js/api.js` for API client
2. Implement login functionality
3. Implement token storage/retrieval
4. Add token to API request headers
5. Handle authentication errors (401)

### Phase 3: Snippet Display
1. Create `js/app.js` for main logic
2. Fetch snippets on page load
3. Display snippets in list (truncated)
4. Add loading state
5. Add empty state

### Phase 4: Core Features
1. Implement expand/collapse (+ / - buttons)
2. Implement copy functionality
3. Implement click-to-copy-and-close
4. Implement search functionality
5. Implement delete per snippet with confirmation

### Phase 5: Polish
1. Add keyboard shortcut (Cmd+Shift+Q)
2. Add Delete All button (UI only)
3. Optimize for responsiveness
4. Test with large snippets
5. Final styling adjustments

---

## ⚠️ Performance Considerations

### Large Snippet Handling
- **Truncation**: Always truncate in display (don't render full text until expanded)
- **Lazy Loading**: Only fetch full text when expanding (or use already-fetched data)
- **Virtual Scrolling**: Consider if 50 snippets causes performance issues
- **Debouncing**: Debounce search input (300ms)

### Responsiveness
- **Async Operations**: All API calls async/await
- **Loading States**: Show loading indicators
- **Error Handling**: Graceful error messages
- **No Blocking**: Never block UI thread

### Smooth Animations
- **CSS Transitions**: Use CSS `transition` for smooth state changes
- **GPU Acceleration**: Use `transform` and `opacity` (GPU-accelerated properties)
- **Avoid**: `height`, `width`, `top`, `left` animations (causes reflow/repaint)
- **Duration**: 200-300ms for most transitions (feels responsive but smooth)
- **Easing**: Use `ease-out` or `cubic-bezier` for natural motion
- **RequestAnimationFrame**: For complex animations, use RAF instead of setTimeout
- **Will-change**: Hint browser about upcoming animations for optimization

---

## ✅ Checklist

### UI Components
- [ ] HTML structure (minimal, small)
- [ ] CSS styling (compact, clean)
- [ ] Login page
- [ ] Main snippet display page

### Features
- [ ] 50 snippets list (truncated)
- [ ] + / - expand/collapse buttons
- [ ] Copy button per snippet
- [ ] Click anywhere else → copy + move to top + close
- [ ] Search bar
- [ ] X delete button with confirmation
- [ ] Delete All button (UI only)
- [ ] Keyboard shortcut (Cmd+Shift+Q)
- [ ] Loading state
- [ ] Empty state

### Backend Integration
- [ ] API client with JWT handling
- [ ] Login API integration
- [ ] Get snippets API integration
- [ ] Search API integration
- [ ] Delete snippet API integration
- [ ] Get snippet (moves to top) API integration

### Testing
- [ ] Test with small snippets
- [ ] Test with large snippets (18MB)
- [ ] Test expand/collapse performance
- [ ] Test copy functionality
- [ ] Test search functionality
- [ ] Test delete functionality
- [ ] Test keyboard shortcut
- [ ] Test loading/empty states

---

## 🔌 Chrome Extension Planning (Future)

### Architecture Considerations
- **Shared Backend**: Web UI and Chrome Extension use same backend APIs
- **Shared Authentication**: Same JWT tokens work for both
- **Settings Sync**: Settings stored in backend, accessible from both
- **API Compatibility**: Ensure APIs work for both web and extension

### Chrome Extension Features (Future)
- **Global Keyboard Shortcut**: True global Cmd+Shift+Q (not just page-focused)
- **Background Service Worker**: Captures copy events from all tabs
- **Popup UI**: Similar to web UI but in extension popup
- **Content Script**: Intercepts copy events on web pages
- **Storage**: Uses `chrome.storage.local` for tokens/settings

### Implementation Strategy
1. **Phase 1**: Build web UI first (current plan)
2. **Phase 2**: Ensure backend APIs are extension-friendly
3. **Phase 3**: Build Chrome Extension using same backend
4. **Phase 4**: Sync settings between web UI and extension

### Extension Structure (Future)
```
extension/
├── manifest.json          # Manifest V3
├── background.js          # Service worker
├── content.js             # Content script (captures copy)
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic (similar to web UI)
├── api.js                 # Shared API client
└── styles.css             # Shared styling
```

---

## 🎨 Animation Specifications

### Animation Requirements
- **Smooth**: No janky, framy animations
- **Dynamic**: Fluid transitions, not static
- **Performance**: 60fps target, GPU-accelerated
- **Natural**: Ease-out curves for natural motion

### Animation Types

#### 1. Expand/Collapse
```css
.snippet-expanded {
    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.3s ease-out;
    max-height: 1000px; /* or auto with JS */
    opacity: 1;
}

.snippet-collapsed {
    max-height: 80px;
    opacity: 0.95;
}
```

#### 2. Fade In/Out
```css
.fade-in {
    animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}
```

#### 3. Slide In/Out
```css
.slide-in {
    animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideIn {
    from { 
        opacity: 0;
        transform: translateX(-20px);
    }
    to { 
        opacity: 1;
        transform: translateX(0);
    }
}
```

#### 4. Button Hover
```css
.btn {
    transition: transform 0.15s ease-out,
                background-color 0.15s ease-out;
}

.btn:hover {
    transform: scale(1.05);
}
```

#### 5. Loading Spinner
```css
.spinner {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
```

### Performance Best Practices
- **Use `transform` and `opacity`**: GPU-accelerated, no layout recalculation
- **Avoid animating**: `height`, `width`, `top`, `left`, `margin`, `padding`
- **Use `will-change`**: Hint browser about upcoming animations
- **Debounce rapid changes**: Prevent animation queue buildup
- **Test on low-end devices**: Ensure smooth on slower hardware

### Animation Timing
- **Fast actions**: 150-200ms (button clicks, hovers)
- **Medium transitions**: 250-300ms (expand/collapse, slide)
- **Slow transitions**: 400-500ms (page transitions, modal)
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` for natural motion

---

## 🚀 Ready to Start Implementation

All requirements clarified and documented. Implementation plan ready! 

**Next Step**: Begin Phase 1 - Setup & Structure

**Key Points**:
- ✅ Smooth, dynamic animations (not static/framy)
- ✅ Chrome Extension architecture planned for future
- ✅ Performance-optimized animations
- ✅ GPU-accelerated transitions

