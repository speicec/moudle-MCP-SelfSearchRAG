## 1. Setup & Infrastructure

- [ ] 1.1 Create chunking module directory structure under `src/chunking/`
- [ ] 1.2 Define core types and interfaces in `src/chunking/types.ts` (HierarchicalChunk, ChunkLevel, QualityScore)
- [ ] 1.3 Create configuration interface in `src/chunking/config.ts` with default values for thresholds
- [ ] 1.4 Add utility functions for cosine similarity calculation in `src/chunking/utils.ts`

## 2. Similarity Cliff Detector

- [ ] 2.1 Implement cosine similarity calculation between adjacent embeddings
- [ ] 2.2 Implement threshold-based cliff candidate identification
- [ ] 2.3 Implement gradient validation for cliff confirmation
- [ ] 2.4 Implement noise filtering with minCliffWidth requirement
- [ ] 2.5 Implement cliff boundary selection from confirmed candidates
- [ ] 2.6 Add cliff confidence scoring logic
- [ ] 2.7 Create CliffDetector class with configurable parameters
- [ ] 2.8 Write unit tests for cliff detection scenarios

## 3. Semantic Chunker

- [ ] 3.1 Implement sentence-level text splitting
- [ ] 3.2 Implement sliding window embedding generation
- [ ] 3.3 Implement batch embedding API calls with caching
- [ ] 3.4 Integrate CliffDetector for semantic boundary identification
- [ ] 3.5 Implement chunk creation at semantic boundaries
- [ ] 3.6 Add fallback to fixed-length chunking when no cliffs detected
- [ ] 3.7 Implement chunk metadata preservation (position, document ref, confidence)
- [ ] 3.8 Create SemanticChunker class integrating all components
- [ ] 3.9 Write unit tests for semantic chunking scenarios

## 4. Hierarchical Chunk Structure

- [ ] 4.1 Implement HierarchicalChunk data structure with parent-child relationships
- [ ] 4.2 Implement small chunk creation logic (100-300 token target)
- [ ] 4.3 Implement parent chunk aggregation logic (500-1500 token target)
- [ ] 4.4 Implement parent-child relationship linking (parentId/childIds)
- [ ] 4.5 Implement parent chunk size limit enforcement with overflow handling
- [ ] 4.6 Create HierarchicalStore for storing and retrieving chunks with relationships
- [ ] 4.7 Implement bidirectional lookup (small→parent, parent→children)
- [ ] 4.8 Write unit tests for hierarchical structure scenarios

## 5. Chunk Quality Filter

- [ ] 5.1 Implement information density scoring (unique token ratio)
- [ ] 5.2 Implement repetition ratio scoring
- [ ] 5.3 Implement semantic completeness scoring (sentence/paragraph structure)
- [ ] 5.4 Implement document relevance scoring (chunk vs document embedding)
- [ ] 5.5 Implement composite quality score calculation with configurable weights
- [ ] 5.6 Implement threshold-based quality filtering
- [ ] 5.7 Implement filter modes: discard, merge, flag
- [ ] 5.8 Create ChunkQualityFilter class
- [ ] 5.9 Write unit tests for quality filter scenarios

## 6. Small-to-Big Retrieval

- [ ] 6.1 Implement query embedding generation with caching
- [ ] 6.2 Implement top-k small chunk retrieval with cosine similarity ranking
- [ ] 6.3 Implement similarity threshold filtering for small chunks
- [ ] 6.4 Implement parent chunk expansion from small chunk results
- [ ] 6.5 Implement duplicate parent merging
- [ ] 6.6 Implement context assembly with token limit enforcement
- [ ] 6.7 Implement fallback to direct parent search
- [ ] 6.8 Implement retrieval result metadata (source attribution, scores)
- [ ] 6.9 Create SmallToBigRetriever class
- [ ] 6.10 Write unit tests for retrieval scenarios

## 7. Integration & Testing

- [ ] 7.1 Integrate SemanticChunker with existing Harness pipeline
- [ ] 7.2 Integrate HierarchicalStore with existing vector store
- [ ] 7.3 Update retrieval engine to use Small-to-Big strategy
- [ ] 7.4 Add configuration options to MCP server interface
- [ ] 7.5 Write integration tests for end-to-end chunking pipeline
- [ ] 7.6 Write integration tests for end-to-end retrieval pipeline
- [ ] 7.7 Add performance benchmarks for chunking speed
- [ ] 7.8 Add performance benchmarks for retrieval accuracy