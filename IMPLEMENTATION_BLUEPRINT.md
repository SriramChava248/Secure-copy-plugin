# Secure Clipboard Chrome Extension - Implementation Blueprint

## 📋 Document Purpose

This document serves as the **master blueprint** for implementing the Secure Clipboard Chrome Extension. We will follow this document step-by-step, module-by-module, with review and approval required before moving to the next step.

**Approach**: Step-by-step implementation with review gates between modules.

---

## 🏗️ Confirmed Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Chrome Extension (Frontend)                            │
│  ┌──────────────┐                                       │
│  │  Popup UI    │                                       │
│  │  (Login +    │                                       │
│  │   Clipboard) │                                       │
│  └──────┬───────┘                                       │
│         │                                               │
│         │                                               │
│         │                                               │
│  ┌──────▼───────────────────────────────────────────┐  │
│  │  Content Script                                  │  │
│  │  (Captures copy events from web pages)          │  │
│  │  - Listens for Ctrl+C / Cmd+C                   │  │
│  │  - Captures copied text                          │  │
│  └──────┬───────────────────────────────────────────┘  │
│         │                                               │
│         │ chrome.runtime.sendMessage()                  │
│         │ (Chrome's internal messaging)                │
│         │                                               │
│  ┌──────▼───────────────────────────────────────────┐  │
│  │  Background Script (Service Worker)              │  │
│  │  - Receives messages from content script         │  │
│  │  - Gets JWT token from chrome.storage.local     │  │
│  │  - Makes HTTPS API calls to backend              │  │
│  └──────┬───────────────────────────────────────────┘  │
└─────────┼───────────────────────────────────────────────┘
           │
           │ HTTPS API Calls
           │ Authorization: Bearer <JWT>
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│  Spring Boot Backend                                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │  REST Controllers                                  │ │
│  │  - AuthController                                  │ │
│  │  - SnippetController                               │ │
│  └──────────────┬─────────────────────────────────────┘ │
│                 │                                        │
│  ┌──────────────▼────────────────────────────────────┐ │
│  │  Services                                         │ │
│  │  - AuthService (JWT, BCrypt)                     │ │
│  │  - SnippetService (Processing, Validation)       │ │
│  │  - EncryptionService (AES-256-GCM)               │ │
│  │  - CompressionService (GZIP)                     │ │
│  └──────────────┬────────────────────────────────────┘ │
│                 │                                        │
│  ┌──────────────▼────────────────────────────────────┐ │
│  │  Repositories                                     │ │
│  │  - UserRepository                                 │ │
│  │  - SnippetRepository                              │ │
│  │  - SnippetChunkRepository                         │ │
│  └──────────────┬─────────────────────────────────────┘ │
└─────────────────┼────────────────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
┌───────────┐ ┌───────────┐ ┌───────────┐
│ PostgreSQL│ │  Redis   │ │   Nginx   │
│ (Primary  │ │  (Cache) │ │  (HTTPS)  │
│ Storage)  │ │          │ │           │
└───────────┘ └───────────┘ └───────────┘
```

### Technology Stack

**Backend:**
- Spring Boot 3.x (Java 17+)
- Spring Security (JWT, RBAC)
- Spring Data JPA
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose

**Frontend:**
- Chrome Extension (Manifest V3)
- Vanilla JavaScript (no frameworks)
- HTML/CSS (minimalistic UI)

**Security:**
- JWT authentication (access + refresh tokens)
  - Short-lived access tokens (15 minutes)
  - Refresh tokens (7 days)
  - Token blacklisting on logout
- BCrypt password hashing
- AES-256-GCM encryption at rest
- HTTPS/TLS enforced (prevents token interception)
- RBAC (Role-Based Access Control)
- Rate limiting
- Input validation

**Deployment:**
- Docker containers
- Docker Compose
- CI/CD: GitHub Actions

---

## 🎯 Core Requirements

### Functional Requirements

1. **User Authentication**
   - User registration
   - User login (JWT tokens)
   - Secure token storage in extension

2. **Clipboard Management**
   - Capture copy events from web pages
   - Store snippets securely (encrypted, compressed, chunked)
   - Display recent 50 snippets in UI
   - Paste functionality
   - Delete snippets

3. **Security**
   - All content encrypted at rest
   - All content compressed
   - JWT-based authentication
   - RBAC (USER/ADMIN roles)
   - Rate limiting
   - Input validation

4. **Performance**
   - Snippet save: < 1 second
   - Snippet retrieval: < 200ms (from Redis cache)
   - Parallel processing for large text
   - Batch database operations

### Non-Functional Requirements

- **Security**: Encryption at rest, HTTPS, JWT, RBAC
- **Performance**: < 1 second save, < 200ms retrieval
- **Reliability**: Database persistence, Redis caching
- **Scalability**: Stateless design, horizontal scaling ready

---

## 📦 Module Breakdown

### Phase 1: Backend Foundation
### Phase 2: Backend Security & Auth
### Phase 3: Backend Core APIs
### Phase 4: Frontend Extension Setup
### Phase 5: Frontend Integration
### Phase 6: Testing & Deployment

---

## 📝 Detailed Implementation Plan

## PHASE 1: Backend Foundation

### Module 1.1: Project Setup
**Goal**: Initialize Spring Boot project with dependencies

**Steps**:
1. Create Spring Boot project structure
2. Configure `pom.xml` with dependencies:
   - Spring Boot Starter Web
   - Spring Boot Starter Security
   - Spring Boot Starter Data JPA
   - PostgreSQL Driver
   - Spring Boot Starter Data Redis
   - JWT libraries (jjwt)
   - Validation
   - Actuator
3. Create basic project structure:
   ```
   src/main/java/com/secureclipboard/
   ├── SecureClipboardApplication.java
   ├── config/
   ├── controller/
   ├── service/
   ├── repository/
   ├── model/
   ├── dto/
   └── exception/
   ```
4. Configure `application.properties`:
   - Server port
   - Database connection (placeholder)
   - Redis connection (placeholder)
   - JWT secret (placeholder)
   - Encryption key (placeholder)
   - Environment-specific values can be overridden via environment variables
5. Test: Run application, verify it starts

**Deliverable**: Spring Boot project that starts successfully

**Review Gate**: ✅ Project structure and dependencies confirmed

---

### Module 1.2: Database Setup
**Goal**: Set up PostgreSQL database and schema

**Steps**:
1. Create Docker Compose file with PostgreSQL service
2. Create database initialization script (`schema.sql`):
   - `users` table
   - `snippets` table
   - `snippet_chunks` table
   - Indexes
3. Configure Spring Data JPA:
   - Entity classes (User, Snippet, SnippetChunk)
   - Repository interfaces
   - JPA configuration
4. Test database connection
5. Verify tables are created

**Deliverable**: Database schema created, entities mapped

**Review Gate**: ✅ Database schema and entities confirmed

---

### Module 1.3: Redis Setup
**Goal**: Set up Redis for caching

**Steps**:
1. Add Redis service to Docker Compose
2. Configure Redis connection in Spring Boot
3. Create Redis configuration class
4. Create Redis service for queue operations
5. Test Redis connection

**Deliverable**: Redis configured and connected

**Review Gate**: ✅ Redis setup confirmed

---

## PHASE 2: Backend Security & Authentication

### Module 2.1: Security Configuration
**Goal**: Configure Spring Security with JWT

**Steps**:
1. Create `SecurityConfig` class
2. Configure password encoder (BCrypt)
3. Set up security filter chain
4. Configure CORS for Chrome extension
5. Disable CSRF (using JWT, stateless)
6. Configure public endpoints (`/auth/**`)
7. Configure protected endpoints (require authentication)
8. Test: Verify security is active

**Deliverable**: Spring Security configured

**Review Gate**: ✅ Security configuration approved

---

### Module 2.2: JWT Service
**Goal**: Implement JWT token generation and validation

**Steps**:
1. Create `JwtService` class
2. Implement token generation:
   - Access token (15 minutes) - Short-lived for security
   - Refresh token (7 days) - Longer-lived for convenience
3. Implement token validation
4. Implement token claims extraction
5. Add JWT secret configuration
6. Implement token blacklisting check (Redis integration)
7. Test: Generate and validate tokens

**Deliverable**: JWT service working

**Review Gate**: ✅ JWT implementation approved

---

### Module 2.3: JWT Authentication Filter
**Goal**: Create filter to validate JWT tokens on requests

**Steps**:
1. Create `JwtAuthenticationFilter` class
2. Extract token from Authorization header
3. Check token blacklist (Redis) - reject if blacklisted
4. Validate token using JwtService
5. Set authentication in SecurityContext
6. Add filter to security chain
7. Test: Verify protected endpoints require valid JWT

**Deliverable**: JWT filter working

**Review Gate**: ✅ JWT filter approved

---

### Module 2.4: Authentication APIs
**Goal**: Implement registration and login endpoints

**Steps**:
1. Create `AuthController`
2. Create DTOs:
   - `RegisterRequest`
   - `LoginRequest`
   - `AuthResponse`
3. Create `AuthService`:
   - `register()` - hash password with BCrypt, save user
   - `login()` - validate credentials, generate JWT tokens (access + refresh)
   - `logout()` - blacklist token in Redis
   - `refreshToken()` - generate new access token from refresh token
4. Implement `POST /api/v1/auth/register`
5. Implement `POST /api/v1/auth/login` (returns access + refresh tokens)
6. Implement `POST /api/v1/auth/logout` (blacklist token)
7. Implement `POST /api/v1/auth/refresh` (refresh access token)
8. Add input validation (`@Valid`)
9. Test: Register, login, logout, refresh via Postman/curl

**Deliverable**: Registration and login working

**Review Gate**: ✅ Auth APIs approved

---

### Module 2.5: RBAC Implementation
**Goal**: Implement role-based access control

**Steps**:
1. Create `Role` enum (USER, ADMIN) - Already in User entity
2. Add role field to User entity - Already done
3. Create role-based security methods
4. Add `@PreAuthorize` annotations:
   - Users can only access their own snippets
   - Admins can access all snippets
5. Implement method-level security
6. Add data ownership checks (users can't access others' data)
7. Test: Verify role-based access works

**Deliverable**: RBAC implemented

**Review Gate**: ✅ RBAC approved

---

## PHASE 3: Backend Core APIs

### Module 3.1: Encryption Service
**Goal**: Implement encryption at rest

**Steps**:
1. Create `EncryptionService` class
2. Implement AES-256-GCM encryption
3. Implement decryption
4. Add encryption key configuration
5. Test: Encrypt and decrypt sample text

**Deliverable**: Encryption service working

**Review Gate**: ✅ Encryption implementation approved

---

### Module 3.2: Compression Service
**Goal**: Implement GZIP compression

**Steps**:
1. Create `CompressionService` class
2. Implement GZIP compression
3. Implement decompression
4. Test: Compress and decompress sample text

**Deliverable**: Compression service working

**Review Gate**: ✅ Compression implementation approved

---

### Module 3.3: Chunking Service
**Goal**: Implement text chunking for large content

**Steps**:
1. Create `ChunkingService` class
2. Implement chunking logic (64KB chunks)
3. Implement chunk reassembly
4. Add parallel processing support
5. Test: Chunk and reassemble large text

**Deliverable**: Chunking service working

**Review Gate**: ✅ Chunking implementation approved

---

### Module 3.4: Snippet Processing Service
**Goal**: Combine encryption, compression, chunking

**Steps**:
1. Create `SnippetProcessingService`
2. Implement processing pipeline:
   - Chunk → Encrypt → Compress
3. Implement reverse pipeline:
   - Decompress → Decrypt → Reassemble
4. Add parallel processing
5. Test: Process and retrieve snippets

**Deliverable**: Processing service working

**Review Gate**: ✅ Processing pipeline approved

---

### Module 3.5: Snippet Service (Core Logic)
**Goal**: Implement snippet business logic

**Steps**:
1. Create `SnippetService` class
2. Implement `saveSnippet()` (SYNCHRONOUS - quick response):
   - Validate word limit (10,000 words)
   - Validate storage limit (100MB per user)
   - Create snippet metadata (save to DB)
   - Add to Redis queue immediately (with raw content)
   - Return response immediately (~30ms)
   - Start async processing for chunking/encryption/compression
3. Implement `processSnippetAsync()` (ASYNC - background):
   - Process snippet (chunk, encrypt, compress)
   - Save processed chunks to database
   - Update snippet status to COMPLETED
   - Remove raw content (security)
3. Implement `getRecentSnippets()`:
   - Check Redis cache first
   - Fallback to database
   - Decrypt and return
4. Implement `getSnippet()`:
   - Fetch from database
   - Decrypt and return
5. Implement `searchSnippets(String query)`:
   - Search in decrypted content (full-text search)
   - Use PostgreSQL full-text search capabilities
   - Return matching snippets (decrypted)
   - Limit to user's own snippets
6. Implement `deleteSnippet()`:
   - Soft delete
   - Remove from Redis queue
7. Test: All operations working

**Deliverable**: Snippet service complete

**Review Gate**: ✅ Snippet service approved

---

### Module 3.6: Snippet Controller
**Goal**: Create REST endpoints for snippets

**Steps**:
1. Create `SnippetController`
2. Create DTOs:
   - `SnippetDTO`
   - `CreateSnippetRequest`
3. Implement `POST /api/v1/snippets`
4. Implement `GET /api/v1/snippets` (paginated)
5. Implement `GET /api/v1/snippets/{id}`
6. Implement `GET /api/v1/snippets/search?query=...` (full-text search)
7. Implement `DELETE /api/v1/snippets/{id}`
8. Add input validation
9. Add error handling
10. Test: All endpoints via Postman

**Deliverable**: Snippet APIs working

**Review Gate**: ✅ Snippet APIs approved

---

### Module 3.7: Rate Limiting
**Goal**: Implement rate limiting

**Steps**:
1. Add Bucket4j dependency
2. Create rate limiter configuration
3. Add rate limiting to auth endpoints
4. Add rate limiting to snippet endpoints
5. Test: Verify rate limiting works

**Deliverable**: Rate limiting implemented

**Review Gate**: ✅ Rate limiting approved

---

### Module 3.8: Global Exception Handler
**Goal**: Centralized error handling

**Steps**:
1. Create `GlobalExceptionHandler`
2. Handle validation errors
3. Handle authentication errors
4. Handle authorization errors
5. Handle custom exceptions
6. Return consistent error responses
7. Test: Verify error handling

**Deliverable**: Error handling complete

**Review Gate**: ✅ Exception handling approved

---

## PHASE 4: Frontend Extension Setup

### Module 4.1: Extension Project Structure
**Goal**: Set up Chrome extension project

**Steps**:
1. Create `extension/` directory
2. Create `manifest.json`:
   - Manifest version 3
   - Permissions (clipboard, storage)
   - Content scripts
   - Background script
   - Popup HTML
3. Create basic file structure:
   ```
   extension/
   ├── manifest.json
   ├── popup.html
   ├── popup.js
   ├── background.js
   ├── content.js
   └── styles.css
   ```
4. Test: Load extension in Chrome (developer mode)

**Deliverable**: Extension loads in Chrome

**Review Gate**: ✅ Extension structure approved

---

### Module 4.2: Popup UI - Login Screen
**Goal**: Create login interface

**Steps**:
1. Design minimalistic login UI (HTML/CSS)
2. Create login form:
   - Email input
   - Password input
   - Login button
   - Register link
3. Style with CSS (minimalistic, clean)
4. Add form validation (client-side)
5. Test: UI displays correctly

**Deliverable**: Login UI complete

**Review Gate**: ✅ Login UI approved

---

### Module 4.3: Popup UI - Clipboard Screen
**Goal**: Create clipboard interface

**Steps**:
1. Design clipboard UI (like Maccy):
   - List of recent snippets
   - Search bar (required - for searching all snippets)
   - Delete button per snippet
2. Create HTML structure
3. Style with CSS (minimalistic)
4. Add keyboard navigation (optional)
5. Test: UI displays correctly

**Deliverable**: Clipboard UI complete

**Review Gate**: ✅ Clipboard UI approved

---

### Module 4.4: Extension Storage Service
**Goal**: Secure token storage

**Steps**:
1. Create `storage.js` utility
2. Implement `saveToken()`:
   - Store JWT in `chrome.storage.local`
   - **Security Note**: `chrome.storage.local` is encrypted by Chrome OS and stored in user's profile directory. It's more secure than `localStorage` because:
     - Data is encrypted at rest by Chrome
     - Isolated per extension (other extensions can't access)
     - Cleared when extension is uninstalled
     - However, still accessible to malicious extensions with storage permission
     - Best practice: Use short-lived tokens (15min access tokens)
3. Implement `getToken()`:
   - Retrieve JWT from storage
4. Implement `clearToken()`:
   - Remove token on logout
5. Test: Store and retrieve tokens

**Deliverable**: Storage service working

**Review Gate**: ✅ Storage service approved

---

### Module 4.5: API Client Service
**Goal**: HTTP client for backend calls

**Steps**:
1. Create `api.js` utility
2. Implement `apiCall()`:
   - Add Authorization header
   - Handle errors
   - Return JSON
3. Implement API methods:
   - `login(email, password)`
   - `register(email, password)`
   - `getSnippets()`
   - `searchSnippets(query)`
   - `createSnippet(content)`
   - `deleteSnippet(id)`
4. Test: API calls work

**Deliverable**: API client working

**Review Gate**: ✅ API client approved

---

## PHASE 5: Frontend Integration

### Module 5.1: Authentication Flow
**Goal**: Implement login/register in extension

**Steps**:
1. Update `popup.js`:
   - Handle login form submit
   - Call API login endpoint
   - Save JWT token
   - Redirect to clipboard UI
2. Implement register flow
3. Handle authentication errors
4. Test: Login and register work

**Deliverable**: Authentication working

**Review Gate**: ✅ Authentication flow approved

---

### Module 5.2: Content Script - Copy Event Capture
**Goal**: Capture copy events from web pages

**Steps**:
1. Update `content.js`:
   - Listen for `copy` event
   - Capture copied text
   - Get page URL
   - Send message to background script
2. Handle edge cases (empty selection, etc.)
3. Test: Copy events captured

**Deliverable**: Copy events captured

**Review Gate**: ✅ Copy capture approved

---

### Module 5.3: Background Script - API Integration
**Goal**: Send snippets to backend

**Steps**:
1. Update `background.js`:
   - Listen for messages from content script
   - Get JWT token from storage
   - Call backend API to save snippet
   - Handle responses/errors
2. Add retry logic for failed requests
3. Test: Snippets saved to backend

**Deliverable**: Background script working

**Review Gate**: ✅ Background script approved

---

### Module 5.4: Clipboard UI - Display Snippets
**Goal**: Show snippets in UI

**Steps**:
1. Update clipboard UI JavaScript:
   - Fetch snippets from backend
   - Display in list
   - Show snippet preview (truncated)
   - Show timestamp
2. Handle empty state
3. Handle loading state
4. Test: Snippets display correctly

**Deliverable**: Snippets displayed

**Review Gate**: ✅ Display functionality approved

---

### Module 5.5: Clipboard UI - Search Functionality
**Goal**: Search snippets by text content

**Steps**:
1. Implement search input handler:
   - Listen for search input changes
   - Debounce search queries (wait 300ms after user stops typing)
   - Call backend search API
2. Display search results:
   - Show matching snippets
   - Highlight search terms in results
   - Show "No results" message if empty
3. Handle search state:
   - Show loading indicator during search
   - Clear search to show recent snippets
4. Test: Search works correctly

**Deliverable**: Search functionality working

**Review Gate**: ✅ Search functionality approved

---

### Module 5.6: Clipboard UI - Paste Functionality
**Goal**: Copy snippet to clipboard

**Steps**:
1. Implement click handler on snippet:
   - Copy snippet content to clipboard
   - Show feedback (toast/notification)
2. Handle clipboard API
3. Test: Paste works

**Deliverable**: Paste functionality working

**Review Gate**: ✅ Paste functionality approved

---

### Module 5.7: Clipboard UI - Delete Functionality
**Goal**: Delete snippets

**Steps**:
1. Add delete button to each snippet
2. Implement delete handler:
   - Call backend API
   - Remove from UI
   - Update Redis queue
3. Handle errors
4. Test: Delete works

**Deliverable**: Delete functionality working

**Review Gate**: ✅ Delete functionality approved

---

### Module 5.8: Keyboard Shortcut
**Goal**: Open clipboard UI with keyboard shortcut

**Steps**:
1. Configure keyboard shortcut in manifest
2. Handle shortcut in background script
3. Open popup programmatically
4. Test: Shortcut works

**Deliverable**: Keyboard shortcut working

**Review Gate**: ✅ Keyboard shortcut approved

---

## PHASE 6: Testing & Deployment

### Module 6.1: Unit Tests
**Goal**: Write unit tests for backend

**Steps**:
1. Test AuthService
2. Test SnippetService
3. Test EncryptionService
4. Test CompressionService
5. Test ChunkingService
6. Achieve >80% code coverage
7. Test: All tests pass

**Deliverable**: Unit tests complete

**Review Gate**: ✅ Unit tests approved

---

### Module 6.2: Integration Tests
**Goal**: Write integration tests

**Steps**:
1. Test authentication endpoints
2. Test snippet endpoints
3. Test security filters
4. Test database operations
5. Test Redis operations
6. Test: All integration tests pass

**Deliverable**: Integration tests complete

**Review Gate**: ✅ Integration tests approved

---

### Module 6.3: Docker Configuration
**Goal**: Containerize application

**Steps**:
1. Create `Dockerfile` for backend
2. Update `docker-compose.yml`:
   - Backend service
   - PostgreSQL service
   - Redis service
   - Nginx service (HTTPS)
3. Configure environment variables
4. Test: All services start

**Deliverable**: Docker setup complete

**Review Gate**: ✅ Docker configuration approved

---

### Module 6.4: CI/CD Pipeline
**Goal**: Set up GitHub Actions

**Steps**:
1. Create `.github/workflows/ci.yml`
2. Configure:
   - Run tests on push/PR
   - Build JAR file
   - Build Docker image
   - (Optional) Push to registry
3. Test: Pipeline runs successfully

**Deliverable**: CI/CD pipeline working

**Review Gate**: ✅ CI/CD approved

---

### Module 6.5: Documentation
**Goal**: Complete project documentation

**Steps**:
1. Update README with setup instructions
2. Document API endpoints
3. Document extension installation
4. Add architecture diagrams
5. Add troubleshooting guide

**Deliverable**: Documentation complete

**Review Gate**: ✅ Documentation approved

---

## 📊 Implementation Summary

### Total Modules: 36
### Estimated Timeline: 4-6 weeks (depending on review pace)

### Module Distribution:
- **Phase 1 (Backend Foundation)**: 3 modules
- **Phase 2 (Security & Auth)**: 5 modules
- **Phase 3 (Core APIs)**: 8 modules
- **Phase 4 (Extension Setup)**: 5 modules
- **Phase 5 (Integration)**: 8 modules (includes search functionality)
- **Phase 6 (Testing & Deployment)**: 5 modules

---

## 🔒 Security Checklist (Per Module)

Each module should ensure:
- ✅ Input validation
- ✅ Authentication/authorization (where applicable)
- ✅ Error handling (no sensitive data leakage)
- ✅ Logging (no sensitive data in logs)
- ✅ Encryption (where applicable)

---

## 📝 Review Process

1. **Complete Module**: Implement all steps in a module
2. **Self-Review**: Check against requirements
3. **Submit for Review**: Present module for approval
4. **Review & Feedback**: Receive feedback
5. **Approval**: Get approval to proceed
6. **Next Module**: Move to next module

**Note**: We will NOT proceed to the next module until the current module is reviewed and approved.

---

## 🎯 Success Criteria

### Backend:
- ✅ All APIs working
- ✅ Security implemented (JWT, RBAC, encryption)
- ✅ Performance: < 1 second save, < 200ms retrieval
- ✅ Tests passing (>80% coverage)

### Frontend:
- ✅ Extension loads in Chrome
- ✅ Login/register working
- ✅ Copy events captured
- ✅ Snippets displayed
- ✅ Paste/delete working

### Overall:
- ✅ End-to-end flow working
- ✅ Security requirements met
- ✅ Performance requirements met
- ✅ Documentation complete

---

## 🚀 Next Steps

1. **Review this blueprint**
2. **Approve Phase 1, Module 1.1** (Project Setup)
3. **Begin implementation**
4. **Review and approve each module before proceeding**

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Status**: Ready for Review

