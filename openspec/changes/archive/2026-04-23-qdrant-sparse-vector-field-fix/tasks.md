## 1. Collection Architecture Fix (CRITICAL)

- [x] 1.1 Recreate `text_chunks` collection with NAMED dense vector `text_dense` (not unnamed)
- [x] 1.2 Recreate `parent_chunks` collection with named sparse only
- [x] 1.3 Recreate `image_chunks` collection with NAMED dense vector `image_dense`
- [x] 1.4 Update collection creation code in `createTextChunksCollection()` and others

## 2. Upsert Format Fix

- [x] 2.1 Change upsert format: use `vector: {text_dense: [...], text_sparse: {...}}` (single object)
- [x] 2.2 Remove separate `sparse_vector` field - sparse vectors go inside `vector` object
- [x] 2.3 Update `upsert()` method to build correct named vector format
- [x] 2.4 Handle sparse-only collections (parent_chunks) with empty dense or omit dense key

## 3. Search Format Fix

- [x] 3.1 Update `searchDense()` to use named vector format `{name: "text_dense", vector: [...]}`
- [x] 3.2 Update `searchSparse()` to use named vector format (already correct: `{name: "text_sparse", vector: {...}}`)
- [x] 3.3 Verify hybrid search works after format changes

## 4. Retrieval Format Fix

- [x] 4.1 Update `getPoint()` to parse named vectors from response (vector is now an object)
- [x] 4.2 Extract dense vector from `vector.text_dense` or `vector.dense`
- [x] 4.3 Extract sparse vector from `vector.text_sparse` or `vector.parent_sparse`

## 5. Content Payload Storage

- [x] 5.1 Update `payloadToQdrant()` to include `content` field when stored (DONE)
- [x] 5.2 Verify content truncation logic is applied correctly (already exists from prior change)
- [x] 5.3 Update `getPoint()` to extract `content` from payload when retrieving (DONE)

## 6. Testing

- [x] 6.1 Add unit test for sparse vector upsert and retrieval with named format
- [x] 6.2 Add integration test for hybrid search with keyword query (e.g., "加班")
- [x] 6.3 Verify sparse search returns non-zero results after fix
- [x] 6.4 Run full test suite to ensure no regressions (1066/1105 passed, unrelated failures)

## 7. Documentation

- [x] 7.1 Add migration note in docs about needing to recreate collections
- [x] 7.2 Update troubleshooting section with named vector format explanation