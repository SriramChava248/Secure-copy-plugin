# Full-Text Search with Chunked & Compressed Data - Analysis

## Your Question: Critical Architecture Issue! ✅

**Question:** Text is stored in chunks in DB, will full-text search be able to fetch full snippet? And that too decompressed?

**Answer:** ❌ **NO** - This is a fundamental challenge!

---

## The Problem

### Current Storage Structure:

```
snippets table:
  - id, user_id, total_chunks, status (metadata only)
  - NO content stored here!

snippet_chunks table:
  - snippet_id, chunk_index, content (BYTEA - compressed)
  - Content is CHUNKED (multiple rows per snippet)
  - Content is COMPRESSED (not plaintext)
```

### Challenge for Full-Text Search:

1. **Content is in chunks** (multiple rows)
   - Snippet content spread across multiple `snippet_chunks` rows
   - Full-text search needs to search across multiple rows

2. **Content is compressed** (not plaintext)
   - Database sees compressed bytes, not text
   - Full-text search needs plaintext

3. **Content is in different table**
   - `snippets` table has no content
   - `snippet_chunks` table has content (but chunked/compressed)

---

## Why Full-Text Search Won't Work Directly

### PostgreSQL Full-Text Search Requirements:

1. **Plaintext content** (not compressed)
2. **Single column** (not spread across rows)
3. **Indexed column** (for fast search)

### Our Current Structure:

```
❌ Content is compressed (not plaintext)
❌ Content is chunked (multiple rows)
❌ Content is in different table
```

**Result:** Cannot use full-text search directly! ❌

---

## Solutions

### Option 1: Store Full Decompressed Text for Search ✅

**Approach:** Store full decompressed text in `snippets` table for search

**Schema Change:**

```sql
ALTER TABLE snippets ADD COLUMN search_content TEXT;
CREATE INDEX idx_snippets_search ON snippets USING GIN(to_tsvector('english', search_content));
```

**How It Works:**

```
1. When saving snippet:
   - Chunk → Compress → Save chunks (for storage)
   - Store full decompressed text in search_content (for search)

2. When searching:
   - PostgreSQL searches search_content column (fast!)
   - Returns matching snippet IDs
   - Fetch chunks → Decompress → Return
```

**Pros:**
- ✅ Full-text search works perfectly
- ✅ Fast database-level search
- ✅ No keyword collisions
- ✅ Can search exact phrases, partial words

**Cons:**
- ⚠️ Stores content twice (chunks + full text)
- ⚠️ More storage space
- ⚠️ Full text not encrypted (but neither are chunks now)

**Storage Impact:**
```
Original: 100KB
Compressed chunks: ~30KB
Full text for search: 100KB
Total: ~130KB (vs 30KB before)
```

### Option 2: Search Across Chunks (Complex) ❌

**Approach:** Use PostgreSQL to search across chunk rows

**Challenge:**
- Need to decompress chunks first
- Need to reassemble chunks
- Need to search reassembled content
- Very complex, slow

**Not Recommended:** Too complex, defeats purpose of chunking

### Option 3: Keep Current Approach (Parallel Processing) ✅

**Approach:** Keep chunked/compressed storage, use parallel processing

**How It Works:**

```
1. Get all snippet IDs
2. Get all chunks (single query)
3. Process snippets in parallel (decompress, reassemble)
4. Filter by query in memory
```

**Pros:**
- ✅ Works with current structure
- ✅ No schema changes needed
- ✅ Parallel processing is fast
- ✅ Storage efficient (compressed)

**Cons:**
- ⚠️ Must decrypt/decompress all snippets
- ⚠️ Not as fast as full-text search

---

## Recommended Solution: Option 1 (Store Full Text)

### Implementation:

**1. Update Schema:**

```sql
-- Add searchable content column
ALTER TABLE snippets ADD COLUMN search_content TEXT;

-- Create full-text search index
CREATE INDEX idx_snippets_search ON snippets 
USING GIN(to_tsvector('english', search_content));
```

**2. Update Snippet Entity:**

```java
@Entity
public class Snippet {
    // ... existing fields
    
    @Column(name = "search_content", columnDefinition = "TEXT")
    private String searchContent; // Full decompressed text for search
}
```

**3. Update Processing:**

```java
// When saving snippet
public void saveSnippet(CreateSnippetRequest request) {
    // Save chunks (compressed, for storage)
    processSnippetAsync(snippetId, content);
    
    // Store full text (for search)
    snippet.setSearchContent(content); // Full decompressed text
    snippetRepository.save(snippet);
}

// When searching
public List<SnippetResponse> searchSnippets(String query) {
    // PostgreSQL full-text search (fast!)
    List<Long> matchingIds = snippetRepository.searchByContent(query);
    
    // Fetch and return matching snippets
    return getSnippetsByIds(matchingIds);
}
```

**4. Repository Method:**

```java
@Query("SELECT s FROM Snippet s WHERE " +
       "to_tsvector('english', s.searchContent) @@ to_tsquery('english', :query) " +
       "AND s.userId = :userId AND s.isDeleted = false")
List<Snippet> searchByContent(@Param("query") String query, @Param("userId") Long userId);
```

---

## Performance Comparison

### Current (Parallel Processing):

```
1000 snippets, 5 matches:
- Get all chunks: ~60ms
- Process 1000 snippets: ~500ms
- Filter: ~1ms
Total: ~561ms
```

### With Full-Text Search (Option 1):

```
1000 snippets, 5 matches:
- Database full-text search: ~10ms ✅
- Get chunks for 5 snippets: ~5ms ✅
- Decompress 5 snippets: ~5ms ✅
Total: ~20ms ✅
```

**Improvement:** **28x faster!** ✅

---

## Storage Comparison

### Current (Chunks Only):

```
100KB snippet:
- Compressed chunks: ~30KB
Total: 30KB
```

### With Full-Text Search (Option 1):

```
100KB snippet:
- Compressed chunks: ~30KB (for storage)
- Full text: 100KB (for search)
Total: 130KB
```

**Trade-off:** 4x more storage, but 28x faster search ✅

---

## Summary

### Your Question: ✅ **Valid Concern!**

**Answer:** Full-text search **cannot** work directly on chunked/compressed data.

### Solution: Store Full Text Separately

**Approach:**
1. Keep chunks (compressed, for storage efficiency)
2. Store full decompressed text in `snippets.search_content` (for search)
3. Use PostgreSQL full-text search on `search_content`
4. Return matching snippets

**Trade-offs:**
- ✅ Fast search (28x faster)
- ✅ Full-text search works perfectly
- ⚠️ More storage (4x increase)
- ⚠️ Full text not encrypted (but neither are chunks)

**Recommendation:** ✅ **Store full text for search** - Worth the storage trade-off for fast search!

---

## Final Architecture

```
Storage:
  - Chunks (compressed) → Efficient storage
  - Full text (plaintext) → Fast search

Search:
  - PostgreSQL full-text search on full text
  - Returns matching snippet IDs
  - Fetch chunks → Decompress → Return
```

**Best of both worlds:** Efficient storage + Fast search! ✅


