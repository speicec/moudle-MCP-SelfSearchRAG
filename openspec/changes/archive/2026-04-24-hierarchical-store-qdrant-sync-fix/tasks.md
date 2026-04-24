## 1. Payload Enhancement

- [x] 1.1 Add optional `content` field to `VectorPayload` interface in `src/retrieval/vector-store-adapter.ts`
- [x] 1.2 Add `STORE_CONTENT_IN_PAYLOAD` environment variable configuration in `src/config/vector-db-config.ts`
- [x] 1.3 Modify `storeVectorsInQdrant()` in `src/server/document-processor.ts` to include content when enabled
- [x] 1.4 Add content truncation logic for chunks exceeding 10KB

## 2. Fallback Recovery Mechanism

- [x] 2.1 Add `recoverFromQdrant(parentId)` method to `HybridSmallToBigRetriever`
- [x] 2.2 Modify `expandToParents()` to check for null chunks and trigger fallback
- [x] 2.3 Implement temporary chunk addition to HierarchicalStore during recovery
- [x] 2.4 Add `recoveredFrom` and `recoveryStatus` fields to `HybridSearchResult` interface
- [x] 2.5 Add logging for recovery events (success, partial, failure)

## 3. Startup Synchronization

- [x] 3.1 Create `syncStores()` function in `src/server/http-server.ts`
- [x] 3.2 Implement `getMissingChunkIdsss()` to compare store counts
- [x] 3.3 Add batch recovery from Qdrant for missing chunks
- [x] 3.4 Integrate sync check into server initialization flow (async, non-blocking)
- [x] 3.5 Add startup log for sync status (chunks recovered, warnings)

## 4. Health Check API

- [x] 4.1 Create `/api/health/storage` endpoint in `src/server/routes/stats.ts`
- [x] 4.2 Implement `getStorageHealth()` function returning chunk counts and sync status
- [x] 4.3 Add `missingInStore` and `missingInQdrant` arrays to health response
- [x] 4.4 Add manual sync trigger endpoint `/api/health/storage/sync` (optional)

## 5. Testing

- [x] 5.1 Unit test for `recoverFromQdrant()` method
- [x] 5.2 Unit test for payload content field storage
- [x] 5.3 Integration test for startup sync with missing chunks
- [x] 5.4 Integration test for retrieval with fallback recovery
- [x] 5.5 Health API endpoint test

## 6. Documentation

- [x] 6.1 Update `docs/hybrid-retrieval.md` with recovery mechanism documentation
- [x] 6.2 Add `STORE_CONTENT_IN_PAYLOAD` to environment variable docs
- [x] 6.3 Document `/api/health/storage` API in README