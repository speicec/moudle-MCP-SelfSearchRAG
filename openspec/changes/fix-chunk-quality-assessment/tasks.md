## 1. Import and Setup

- [x] 1.1 Add imports in `document-processor.ts`: `ChunkQualityFilter`, `createChunkQualityFilter`, `aggregateEmbeddings` from chunking module

## 2. Core Implementation

- [x] 2.1 Modify `storeInHierarchical()` to create `ChunkQualityFilter` instance with default config
- [x] 2.2 Collect all chunk embeddings before creating hierarchical chunks
- [x] 2.3 Aggregate embeddings using `aggregateEmbeddings()` to compute document embedding
- [x] 2.4 Call `qualityFilter.setDocumentEmbedding(documentId, docEmbedding)` before evaluating chunks
- [x] 2.5 Replace `createDefaultQualityScore()` with `qualityFilter.evaluate(chunk)` for each chunk

## 3. Logging and Debugging

- [x] 3.1 Add logging for document embedding computation (documentId, embedding dimension)
- [x] 3.2 Add logging for quality evaluation results (avg composite, dimension breakdown)

## 4. Testing and Verification

- [x] 4.1 Build project: `npm run build`
- [ ] 4.2 Upload test document via frontend
- [ ] 4.3 Verify chunk quality scores are not all 0.5 in ChunkExplorer
- [ ] 4.4 Verify quality distribution chart shows real high/medium/low distribution
- [ ] 4.5 Check API response: `/api/documents/:id/chunks` returns real quality scores