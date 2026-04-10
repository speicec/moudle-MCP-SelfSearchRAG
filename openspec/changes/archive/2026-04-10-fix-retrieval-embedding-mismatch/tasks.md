## 1. Embedding Service Injection

- [x] 1.1 Add TextEmbeddingService import to http-server.ts
- [x] 1.2 Create embeddingService instance in http-server initialization
- [x] 1.3 Decorate Fastify with embeddingService using fastify.decorate()
- [x] 1.4 Add TypeScript type declaration for fastify.embeddingService

## 2. Retriever Configuration

- [x] 2.1 Import TextEmbeddingService in chat.ts
- [x] 2.2 Get embeddingService from fastify decorator in chat routes
- [x] 2.3 Set embeddingGenerator on SmallToBigRetriever using setEmbeddingGenerator()
- [x] 2.4 Verify embedding dimension matches stored chunk embeddings (add validation)

## 3. Fallback Optimization

- [x] 3.1 Update DEFAULT_RETRIEVAL_CONFIG.fallbackThreshold to 0.4 in config.ts
- [x] 3.2 Ensure assembleContext respects maxContextTokens for fallback results
- [x] 3.3 Add early termination when no fallback results meet threshold

## 4. Debugging & Logging

- [x] 4.1 Add similarity score logging in searchSmallChunks method
- [x] 4.2 Add fallback trigger logging with reason and result count
- [x] 4.3 Add request/response logging for embedding API calls

## 5. Error Handling

- [x] 5.1 Add try-catch in getQueryEmbedding for embedding service errors
- [x] 5.2 Return 500 error response when embedding generation fails
- [x] 5.3 Remove synthetic embedding fallback (no longer needed)
- [x] 5.4 Add timeout handling for embedding service calls

## 6. Testing

- [x] 6.1 Add unit test for embedding generator configuration
- [x] 6.2 Add integration test for retrieval with real embeddings
- [x] 6.3 Verify retrieval returns relevant chunks not full documents
- [x] 6.4 Test error handling scenarios (API failure, timeout)