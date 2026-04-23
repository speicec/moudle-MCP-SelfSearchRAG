## Why

Qdrant sparse vector search returns 0 results because the field name `sparse_values` is incorrect in the upsert code. The correct Qdrant API field name is `sparse_vector`. This bug causes keyword matching to fail, making Chinese keyword queries like "加班" ineffective - only dense semantic search works, resulting in low-quality retrieval results.

**Root Cause**: `qdrant-client.ts:212` uses `point.sparse_values` but Qdrant expects `point.sparse_vector`.

## What Changes

- **FIX**: Change `sparse_values` to `sparse_vector` in `qdrant-client.ts` upsert method
- **FIX**: Update `payloadToQdrant()` to include `content` field when `STORE_CONTENT_IN_PAYLOAD=true`
- **FIX**: Update `getPoint()` retrieval to correctly parse sparse vectors from Qdrant response
- **DOCUMENTATION**: Add migration note for existing data that lacks sparse vectors

## Capabilities

### New Capabilities

None - this is a bug fix.

### Modified Capabilities

- `hybrid-retrieval`: Sparse vector storage now works correctly, enabling keyword matching in hybrid search

## Impact

**Code Files**:
- `src/retrieval/qdrant-client.ts` - Fix sparse vector field name in upsert and retrieval

**Data Migration**:
- Existing documents in Qdrant lack sparse vectors due to this bug
- Users need to reprocess documents after fix to enable sparse search

**API Impact**:
- No API changes - internal bug fix only

**Performance Impact**:
- Sparse search will now return results, improving hybrid retrieval quality
- Chinese keyword queries will work properly