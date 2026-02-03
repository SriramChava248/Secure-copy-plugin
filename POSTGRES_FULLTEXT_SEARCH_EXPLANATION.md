# PostgreSQL Full-Text Search - Explanation & Implementation

## 1. What is PostgreSQL Full-Text Search?

PostgreSQL full-text search is a **built-in feature** that allows you to search through text data efficiently using **indexed search**.

### Key Concepts:

#### 1. **tsvector** (Text Search Vector)
- Converts text into a **searchable vector**
- Removes stop words (the, a, an, etc.)
- Normalizes words (lowercase, stemming)
- Stores word positions

**Example:**
```sql
SELECT to_tsvector('english', 'The quick brown fox jumps');
-- Result: 'brown':3 'fox':4 'jump':5 'quick':2
--         (removed 'the', normalized 'jumps' → 'jump')
```

#### 2. **tsquery** (Text Search Query)
- Converts search query into searchable format
- Supports operators: `&` (AND), `|` (OR), `!` (NOT)

**Example:**
```sql
SELECT to_tsquery('english', 'quick & fox');
-- Result: 'quick' & 'fox'
```

#### 3. **Full-Text Search Match**
- Uses `@@` operator to match `tsvector` against `tsquery`
- Returns boolean (true/false)

**Example:**
```sql
SELECT to_tsvector('english', 'The quick brown fox') 
       @@ to_tsquery('english', 'quick & fox');
-- Result: true ✅
```

### How It Works:

```
1. Index text data as tsvector (when saving)
   └─ "The quick brown fox" → ['quick':2 'brown':3 'fox':4]

2. Convert search query to tsquery
   └─ "quick fox" → 'quick' & 'fox'

3. Match tsvector @@ tsquery
   └─ Returns true if match found

4. Database uses GIN index for fast search
   └─ Much faster than LIKE or contains()
```

### Performance Comparison:

| Method | Time | Notes |
|--------|------|-------|
| **LIKE '%query%'** | ~500ms | Sequential scan, slow |
| **contains()** | ~500ms | Sequential scan, slow |
| **Full-Text Search** | ~5-10ms | Indexed search, fast ✅ |

**Improvement:** **50-100x faster!** ✅

---

## 2. Why Use Full-Text Search?

### Current Problem (In-Memory Search):

```java
// Current implementation
List<Snippet> snippets = getAllSnippets(); // Get ALL snippets
for (Snippet snippet : snippets) {
    String content = decrypt(snippet); // Decrypt ALL snippets
    if (content.contains(query)) { // Search in memory
        // Match found
    }
}
```

**Issues:**
- ❌ Must decrypt **ALL** snippets (even if not matching)
- ❌ Must process **ALL** chunks (expensive)
- ❌ Search happens **in memory** (not scalable)
- ❌ Slow for large datasets

### Full-Text Search Solution:

```sql
-- PostgreSQL does the search BEFORE decryption
SELECT * FROM snippets 
WHERE to_tsvector('english', decrypted_content) 
      @@ to_tsquery('english', 'search query')
AND user_id = 123;
```

**Benefits:**
- ✅ Database filters **before** decryption
- ✅ Only decrypt **matching** snippets
- ✅ Uses **indexed search** (fast)
- ✅ Scalable for large datasets

---

## 3. Implementation Strategy

### Option 1: Store Plaintext Search Index (Not Secure) ❌

```sql
-- Add searchable column
ALTER TABLE snippets ADD COLUMN search_vector tsvector;

-- Create index
CREATE INDEX idx_snippets_search ON snippets USING GIN(search_vector);
```

**Problem:** Stores plaintext (security risk) ❌

### Option 2: Decrypt on Search (Current + Optimized) ✅

**Approach:**
1. Use full-text search on **decrypted content** (in query)
2. Decrypt only **matching** snippets
3. Use parallel processing for decryption

**Implementation:**
```java
// 1. Get all snippet IDs for user
List<Long> snippetIds = getSnippetIds(userId);

// 2. Get all chunks (single query)
List<SnippetChunk> chunks = getChunks(snippetIds);

// 3. Process snippets in parallel
List<String> contents = processParallel(chunks);

// 4. Filter by search query (in memory)
List<String> matches = contents.stream()
    .filter(content -> content.contains(query))
    .collect(...);
```

**Note:** Still requires decrypting all snippets, but parallel processing helps.

### Option 3: Full-Text Search with Encrypted Storage (Future) ⚠️

**Challenge:** Can't search encrypted content directly

**Possible Solutions:**
1. **Searchable Encryption**: Store encrypted content + searchable metadata
2. **Client-Side Search**: Decrypt on client, search there
3. **Hybrid**: Store keywords/metadata separately (less secure)

---

## 4. Current Implementation Analysis

### Current Code:

```java
public List<SnippetResponse> searchSnippets(String query) {
    // Get all snippets
    List<Snippet> snippets = snippetRepository.findByUserIdAndIsDeletedFalse(userId);
    
    // Process sequentially (SLOW!)
    return snippets.stream()
        .map(snippet -> {
            // Get chunks (1 DB call per snippet)
            List<SnippetChunk> chunks = chunkRepository.findBySnippetIdOrderByChunkIndexAsc(...);
            
            // Process chunks (sequential)
            String content = processingService.processSnippetForRetrieval(...);
            
            // Search
            if (content.contains(query)) {
                return snippetResponse;
            }
            return null;
        })
        .filter(Objects::nonNull)
        .collect(Collectors.toList());
}
```

### Problems:

1. ❌ **Sequential processing** (not parallel)
2. ❌ **N DB calls** for chunks (one per snippet)
3. ❌ **Processes ALL snippets** (even non-matching)
4. ❌ **No full-text search** (in-memory only)

---

## 5. Optimized Implementation (With Parallel Processing)

### Optimized Approach:

```java
public List<SnippetResponse> searchSnippets(String query) {
    // Step 1: Get all snippet IDs
    List<Long> snippetIds = getSnippetIds(userId);
    
    // Step 2: Get all chunks (single query) ✅
    List<SnippetChunk> allChunks = chunkRepository.findBySnippetIdIn(...);
    
    // Step 3: Group chunks by snippet ID
    Map<Long, List<SnippetChunk>> chunksBySnippet = groupChunks(allChunks);
    
    // Step 4: Process snippets IN PARALLEL ✅
    List<SnippetData> snippetsData = createSnippetData(chunksBySnippet);
    List<String> contents = processingService.processSnippetsForRetrievalParallel(snippetsData);
    
    // Step 5: Filter by query (in memory)
    return filterByQuery(snippetIds, contents, query);
}
```

### Performance Improvement:

**Before (Sequential):**
- 100 snippets × (5ms processing) = **500ms**

**After (Parallel):**
- 100 snippets processed in parallel = **Max(5ms) = 5ms**
- **100x faster!** ✅

---

## Summary

### PostgreSQL Full-Text Search:

1. **What:** Built-in indexed text search feature
2. **How:** Uses `tsvector` and `tsquery` for efficient search
3. **Performance:** 50-100x faster than LIKE/contains
4. **Challenge:** Can't search encrypted content directly

### Current Implementation:

1. **Problem:** Sequential processing, N DB calls
2. **Solution:** Use parallel processing (like `getRecentSnippets()`)
3. **Future:** Implement PostgreSQL full-text search when possible

**Next Step:** Optimize `searchSnippets()` to use parallel processing! ✅


