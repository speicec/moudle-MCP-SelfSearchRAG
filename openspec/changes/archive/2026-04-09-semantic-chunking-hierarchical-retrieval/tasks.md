## 1. Setup & Infrastructure

- [x] 1.1 Create chunking module directory structure under `src/chunking/`
- [x] 1.2 Define core types and interfaces in `src/chunking/types.ts` (HierarchicalChunk, ChunkLevel, QualityScore)
- [x] 1.3 Create configuration interface in `src/chunking/config.ts` with default values for thresholds
- [x] 1.4 Add utility functions for cosine similarity calculation in `src/chunking/utils.ts`

## 2. Similarity Cliff Detector

- [x] 2.1 Implement cosine similarity calculation between adjacent embeddings
- [x] 2.2 Implement threshold-based cliff candidate identification
- [x] 2.3 Implement gradient validation for cliff confirmation
- [x] 2.4 Implement noise filtering with minCliffWidth requirement
- [x] 2.5 Implement cliff boundary selection from confirmed candidates
- [x] 2.6 Add cliff confidence scoring logic
- [x] 2.7 Create CliffDetector class with configurable parameters
- [x] 2.8 Write unit tests for cliff detection scenarios

## 3. Semantic Chunker

- [x] 3.1 Implement sentence-level text splitting
- [x] 3.2 Implement sliding window embedding generation
- [x] 3.3 Implement batch embedding API calls with caching
- [x] 3.4 Integrate CliffDetector for semantic boundary identification
- [x] 3.5 Implement chunk creation at semantic boundaries
- [x] 3.6 Add fallback to fixed-length chunking when no cliffs detected
- [x] 3.7 Implement chunk metadata preservation (position, document ref, confidence)
- [x] 3.8 Create SemanticChunker class integrating all components
- [x] 3.9 Write unit tests for semantic chunking scenarios

## 4. Hierarchical Chunk Structure

- [x] 4.1 Implement HierarchicalChunk data structure with parent-child relationships
- [x] 4.2 Implement small chunk creation logic (100-300 token target)
- [x] 4.3 Implement parent chunk aggregation logic (500-1500 token target)
- [x] 4.4 Implement parent-child relationship linking (parentId/childIds)
- [x] 4.5 Implement parent chunk size limit enforcement with overflow handling
- [x] 4.6 Create HierarchicalStore for storing and retrieving chunks with relationships
- [x] 4.7 Implement bidirectional lookup (small→parent, parent→children)
- [x] 4.8 Write unit tests for hierarchical structure scenarios

## 5. Chunk Quality Filter

- [x] 5.1 Implement information density scoring (unique token ratio)
- [x] 5.2 Implement repetition ratio scoring
- [x] 5.3 Implement semantic completeness scoring (sentence/paragraph structure)
- [x] 5.4 Implement document relevance scoring (chunk vs document embedding)
- [x] 5.5 Implement composite quality score calculation with configurable weights
- [x] 5.6 Implement threshold-based quality filtering
- [x] 5.7 Implement filter modes: discard, merge, flag
- [x] 5.8 Create ChunkQualityFilter class
- [x] 5.9 Write unit tests for quality filter scenarios

## 6. Small-to-Big Retrieval

- [x] 6.1 Implement query embedding generation with caching
- [x] 6.2 Implement top-k small chunk retrieval with cosine similarity ranking
- [x] 6.3 Implement similarity threshold filtering for small chunks
- [x] 6.4 Implement parent chunk expansion from small chunk results
- [x] 6.5 Implement duplicate parent merging
- [x] 6.6 Implement context assembly with token limit enforcement
- [x] 6.7 Implement fallback to direct parent search
- [x] 6.8 Implement retrieval result metadata (source attribution, scores)
- [x] 6.9 Create SmallToBigRetriever class
- [x] 6.10 Write unit tests for retrieval scenarios

## 7. Integration & Testing

- [x] 7.1 Integrate SemanticChunker with existing Harness pipeline
- [x] 7.2 Integrate HierarchicalStore with existing vector store
- [x] 7.3 Update retrieval engine to use Small-to-Big strategy
- [x] 7.4 Add configuration options to MCP server interface
- [x] 7.5 Write integration tests for end-to-end chunking pipeline
- [x] 7.6 Write integration tests for end-to-end retrieval pipeline
- [x] 7.7 Add performance benchmarks for chunking speed
- [x] 7.8 Add performance benchmarks for retrieval accuracy