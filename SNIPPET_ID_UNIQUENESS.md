# Snippet ID Uniqueness & Security Analysis

## Answer: NO - Snippet IDs are Globally Unique

**Question:** Can User 1 have Snippet ID 1 and User 2 also have Snippet ID 1?

**Answer:** **NO** ❌

### Why?

Snippet ID is a **PRIMARY KEY** in the database:

```sql
CREATE TABLE snippets (
    id BIGSERIAL PRIMARY KEY,  -- ✅ PRIMARY KEY = Globally unique
    user_id BIGINT NOT NULL,
    ...
);
```

**Primary Key Constraint:**
- **MUST be unique** across the entire table
- **Cannot be duplicated** for any row
- Database **enforces uniqueness** automatically

### How IDs are Generated:

```java
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)
private Long id;
```

**Database Auto-Increment:**
- PostgreSQL uses `BIGSERIAL` (auto-increment sequence)
- Each new snippet gets the **next available ID**
- IDs are **sequential and unique**: 1, 2, 3, 4, 5...

### Example:

```
User 1 creates snippet → Gets ID: 1
User 2 creates snippet → Gets ID: 2 (NOT 1!)
User 1 creates snippet → Gets ID: 3
User 2 creates snippet → Gets ID: 4
```

**Result:**
- User 1: Snippets [1, 3]
- User 2: Snippets [2, 4]
- **No overlap!** ✅

---

## Security Implications

### ⚠️ Potential Security Concern:

Since snippet IDs are **globally unique**, a user could potentially:
1. **Guess other users' snippet IDs** (if they know their own IDs)
2. **Try to access snippets** belonging to other users

### ✅ Security Measures in Place:

**1. Ownership Checks:**

```java
// ✅ SECURE: Checks ownership
public SnippetResponse getSnippet(Long snippetId) {
    Long userId = SecurityUtils.getCurrentUserId();
    Snippet snippet = snippetRepository.findByIdAndUserId(snippetId, userId)
        .orElseThrow(...); // ✅ Only returns if userId matches
}

// ✅ SECURE: Checks ownership
public void deleteSnippet(Long snippetId) {
    Long userId = SecurityUtils.getCurrentUserId();
    Snippet snippet = snippetRepository.findByIdAndUserId(snippetId, userId)
        .orElseThrow(...); // ✅ Only deletes if userId matches
}
```

**2. Repository Method:**

```java
// ✅ SECURE: Filters by both ID and userId
Optional<Snippet> findByIdAndUserId(Long id, Long userId);
```

**3. What Happens if User Tries to Access Others' Snippets:**

```java
// User 1 tries to access snippet ID 5 (belongs to User 2)
Snippet snippet = snippetRepository.findByIdAndUserId(5L, user1Id);
// Returns: Optional.empty() ✅
// Throws: RuntimeException("Snippet not found") ✅
// User 1 cannot access User 2's snippet! ✅
```

---

## Security Analysis

### ✅ Secure Operations:

| Operation | Method | Security Check |
|-----------|--------|---------------|
| **Get snippet** | `getSnippet()` | ✅ `findByIdAndUserId()` |
| **Delete snippet** | `deleteSnippet()` | ✅ `findByIdAndUserId()` |
| **Get recent snippets** | `getRecentSnippets()` | ✅ Uses Redis queue (user-specific) |

### ⚠️ Internal Operations (No User Input):

| Operation | Method | Security Check |
|-----------|--------|---------------|
| **Process async** | `processSnippetAsync()` | ⚠️ `findById()` only (internal, no user input) |

**Note:** `processSnippetAsync()` uses `findById()` because:
- It's an **internal method** (not exposed via API)
- Called by `saveSnippet()` which already validated user
- No user input involved

---

## Alternative Design (If IDs Were Per-User)

### Option 1: Composite Primary Key

```sql
CREATE TABLE snippets (
    user_id BIGINT NOT NULL,
    snippet_id INT NOT NULL,  -- Per-user ID
    PRIMARY KEY (user_id, snippet_id)  -- Composite key
);
```

**Pros:**
- IDs can be 1, 2, 3... per user
- More intuitive (each user starts at 1)

**Cons:**
- More complex queries
- Harder to reference snippets globally
- Less common pattern

### Option 2: Keep Current Design (Recommended) ✅

**Pros:**
- Simple primary key
- Easy to reference snippets
- Standard pattern
- **Security handled by ownership checks** ✅

**Cons:**
- IDs are globally unique (not per-user)
- **Mitigated by proper security checks** ✅

---

## Summary

### ✅ Snippet ID Uniqueness:

- **Globally unique** (primary key constraint)
- **Cannot be duplicated** across users
- **Database enforced** automatically

### ✅ Security:

- **Ownership checks** prevent unauthorized access
- **All user-facing operations** check `userId`
- **Users cannot access** other users' snippets

### ✅ Current Design:

- **Secure** ✅
- **Standard pattern** ✅
- **Properly protected** ✅

**Conclusion:** Snippet IDs are globally unique, but security is properly handled through ownership checks. Users cannot access each other's snippets even if they guess the ID.


