## Context

### Root Cause Analysis

The sparse vector issue is NOT just a field name bug. The fundamental problem is:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ROOT CAUSE                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Collection Configuration:                                         │
│   vectors: {size: 1024}         ← UNNAMED dense vector             │
│   sparse_vectors: {text_sparse} ← NAMED sparse vector              │
│                                                                     │
│   Problem: When using NAMED sparse vectors, you MUST use NAMED     │
│   dense vectors too. Both go in the SAME `vector` object.          │
│                                                                     │
│   Current Wrong Upsert Format:                                      │
│   point.vector = [array]                    ← array for unnamed    │
│   point.sparse_vector = {text_sparse: ...}  ← separate field       │
│                                                                     │
│   Correct Upsert Format:                                            │
│   point.vector = {                                           │
│     "text_dense": [array],        ← named dense in vector obj      │
│     "text_sparse": {indices, values}  ← named sparse in vector obj │
│   }                                                                 │
│                                                                     │
│   Qdrant Requirement: Named vectors → vector field is an OBJECT    │
│                       Unnamed vectors → vector field is an ARRAY   │
│                       Cannot mix unnamed dense + named sparse!     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Verified Solution

Tested with new collection `test_sparse_mixed`:
- Created with: `vectors: {dense: {size: 1024}}`, `sparse_vectors: {text_sparse: {...}}`
- Upserted with: `vector: {dense: [...], text_sparse: {indices, values}}`
- Sparse search returned results with score 0.23589933 ✓
- Retrieval shows both vectors in response ✓

### Stakeholders

- `QdrantVectorStoreAdapter` - Handles all vector storage/retrieval
- `HybridSmallToBigRetriever` - Uses sparse search for keyword matching
- `document-processor.ts` - Calls upsert during document processing

### Qdrant API Reference

Based on Qdrant documentation, the correct field names are:
- `sparse_vector` (singular) for point data
- `sparse_vectors` (plural) for collection configuration

## Goals / Non-Goals

**Goals:**
1. Fix sparse vector field name to use correct Qdrant API
2. Ensure content is stored in payload for recovery mechanism
3. Update retrieval to correctly parse sparse vectors
4. Add unit tests to verify sparse vector storage

**Non-Goals:**
- Changing the retrieval algorithm or RRF fusion
- Modifying the embedding generation process
- Creating new collections or changing collection names

## Decisions

### Decision 1: Collection Architecture Change

**Choice**: Change to NAMED dense vectors for all collections

**Current (wrong)**:
```
text_chunks: vectors: {size: 1024} (unnamed) + sparse_vectors: {text_sparse}
parent_chunks: sparse_vectors: {parent_sparse} only
image_chunks: vectors: {size: 512} (unnamed)
```

**New (correct)**:
```
text_chunks: vectors: {text_dense: {size: 1024}} + sparse_vectors: {text_sparse}
parent_chunks: vectors: {} + sparse_vectors: {parent_sparse}
image_chunks: vectors: {image_dense: {size: 512}}
```

**Rationale**: Qdrant requires named vectors to be consistent. When using named sparse vectors, dense vectors must also be named. Both go in the same `vector` object.

### Decision 2: Upsert Format Change

**Choice**: Use single `vector` object containing both dense and sparse

**Format**:
```typescript
// text_chunks: dense + sparse
point.vector = {
  "text_dense": denseArray,
  "text_sparse": { indices: [...], values: [...] }
}

// parent_chunks: sparse only
point.vector = {}  // empty object
// OR use sparse_vectors field separately
```

**Rationale**: Verified working with direct HTTP API test.

### Decision 3: Search Format Change

**Choice**: Use NamedVector format for dense search

**Dense search**:
```typescript
{
  vector: {
    name: "text_dense",
    vector: denseArray
  }
}
```

**Sparse search** (already correct):
```typescript
{
  vector: {
    name: "text_sparse",
    vector: { indices: [...], values: [...] }
  }
}
```

### Decision 4: Retrieval Parsing Update

**Choice**: Parse named vectors from response object

**Response format** (after fix):
```json
{
  "vector": {
    "text_dense": [...],
    "text_sparse": { "indices": [...], "values": [...] }
  }
}
```

**Parse logic**:
```typescript
const denseVector = p.vector?.text_dense ?? p.vector?.dense;
const sparseVector = p.vector?.text_sparse ?? p.vector?.parent_sparse;
``

## Risks / Trade-offs

### Risk 1: Existing Data Migration

**Risk**: Existing documents in Qdrant have no sparse vectors
**Mitigation**: Document that users must reprocess documents after fix

### Risk 2: Collection Recreation

**Risk**: May need to recreate collections if sparse vector config is wrong
**Mitigation**: Sparse vector config (`text_sparse`) is correct - only point data is wrong

### Risk 3: API Compatibility

**Risk**: Different Qdrant versions may have different field names
**Mitigation**: Test with current Qdrant version (v1.7+)

## Migration Plan

### Phase 1: Code Changes

1. Update collection creation to use named dense vectors
2. Update upsert format to use single vector object
3. Update search methods to use named vector format
4. Update getPoint to parse named vectors

### Phase 2: Testing

1. Create test collection with new architecture
2. Verify sparse search works
3. Verify dense search works
4. Verify hybrid search works

### Phase 3: Production Migration

**CRITICAL**: This requires recreating collections and reprocessing ALL documents!

1. Backup existing data (export if needed)
2. Delete existing collections (`text_chunks`, `parent_chunks`, `image_chunks`)
3. Create new collections with named dense vectors
4. Reprocess all documents to populate vectors with new format
5. Verify hybrid search with real queries

### Phase 4: Cleanup

1. Remove old test files
2. Update documentation
3. Verify all tests pass

**Rollback**: Can restore old collections by:
1. Deleting new collections
2. Recreating with old unnamed format (sparse search will not work)
3. Reprocess documents with old code