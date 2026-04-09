## 1. Project Setup

- [x] 1.1 Initialize TypeScript project with package.json and tsconfig.json
- [x] 1.2 Configure build tools (tsc/esbuild) and output structure
- [x] 1.3 Add core dependencies: @anthropic-ai/mcp, vector database client, PDF parsing libraries
- [x] 1.4 Create src directory structure: core/, parsers/, embedding/, retrieval/, mcp/
- [x] 1.5 Set up development dependencies: TypeScript, testing framework, linting

## 2. Harness Core Framework

- [x] 2.1 Define Harness interface and base types in src/core/harness.ts
- [x] 2.2 Implement Stage abstract class with execute method
- [x] 2.3 Implement Plugin interface and registration system
- [x] 2.4 Implement Context data structure with type-safe field access
- [x] 2.5 Implement Pipeline orchestrator with sequential stage execution
- [x] 2.6 Add lifecycle hooks: pre-execution, post-execution, error handlers
- [x] 2.7 Implement pipeline configuration validation
- [x] 2.8 Add execution monitoring and timing metrics

## 3. Document Ingestion Module

- [x] 3.1 Create Document interface and metadata types in src/core/document.ts
- [x] 3.2 Implement DocumentValidator with format and size checks
- [x] 3.3 Implement DocumentStorage with unique ID assignment
- [x] 3.4 Implement IngestStage as first pipeline stage
- [x] 3.5 Add processing queue management with status tracking
- [x] 3.6 Create format detection and MIME type utilities

## 4. PDF Parsing Module

- [x] 4.1 Install and configure PDF parsing dependencies (pdf-parse, unstructured integration)
- [x] 4.2 Implement PDFTextExtractor for plain text extraction
- [x] 4.3 Implement PDFTableExtractor with structure preservation
- [x] 4.4 Implement PDFImageExtractor with position metadata
- [x] 4.5 Implement PDFChartDetector for chart/diagram identification
- [x] 4.6 Implement PDFFormulaExtractor for math formula extraction
- [x] 4.7 Implement PDFLayoutAnalyzer for multi-column handling
- [x] 4.8 Implement PageSegmenter for logical block detection
- [x] 4.9 Create ParseStage integrating all PDF extraction components
- [x] 4.10 Add accuracy validation and benchmark tests for table recognition

## 5. Multimodal Embedding Module

- [x] 5.1 Define EmbeddingModel interface for text and image embeddings
- [x] 5.2 Implement TextEmbeddingService using text-embedding model integration
- [x] 5.3 Implement ImageEmbeddingService using visual embedding model
- [x] 5.4 Implement ChunkingService with configurable chunk size and overlap
- [x] 5.5 Add semantic chunking strategy option
- [x] 5.6 Implement EmbeddingCache for reuse optimization
- [x] 5.7 Create EmbeddingStage for pipeline integration
- [x] 5.8 Add batch embedding processing support
- [x] 5.9 Implement metadata association for embeddings (source, position, type)

## 6. Retrieval Engine Module

- [x] 6.1 Define VectorStore interface for index operations
- [x] 6.2 Implement InMemoryVectorStore for development/testing
- [x] 6.3 Implement ChromaDBVectorStore as optional persistent backend
- [x] 6.4 Implement SemanticSearchEngine with cosine similarity
- [x] 6.5 Implement KeywordSearchEngine with term matching
- [x] 6.6 Implement HybridSearchEngine with configurable fusion weights
- [x] 6.7 Add multi-modal retrieval support (cross-text-image search)
- [x] 6.8 Implement ContextAssembler for result compilation
- [x] 6.9 Add source attribution in assembled context
- [x] 6.10 Implement IndexStage for pipeline integration
- [x] 6.11 Add index management operations (add, update, remove)

## 7. MCP Server Module

- [x] 7.1 Install and configure MCP SDK dependencies
- [x] 7.2 Implement MCP protocol handshake and initialization
- [x] 7.3 Define tool schemas for ingest_document, query, get_document, list_documents
- [x] 7.4 Implement ingest_document MCP tool handler
- [x] 7.5 Implement query MCP tool handler
- [x] 7.6 Implement get_document MCP tool handler
- [x] 7.7 Implement list_documents MCP tool handler
- [x] 7.8 Add tool input validation against schemas
- [x] 7.9 Configure stdio transport for MCP communication
- [x] 7.10 Implement server startup with configuration validation

## 8. Integration and Testing

- [x] 8.1 Create default pipeline configuration (Ingest → Parse → Chunk → Embed → Index)
- [x] 8.2 Write unit tests for Harness core components
- [x] 8.3 Write unit tests for PDF parsing components
- [x] 8.4 Write unit tests for embedding and retrieval
- [x] 8.5 Write integration tests for full pipeline execution
- [x] 8.6 Write MCP server integration tests
- [x] 8.7 Create sample documents for testing (PDF with tables, charts, multi-column)
- [x] 8.8 Add end-to-end test: document upload → retrieval query flow

## 9. Configuration and Deployment

- [x] 9.1 Create configuration schema for embedding models, chunking, search parameters
- [x] 9.2 Implement configuration file loading (JSON/YAML)
- [x] 9.3 Add environment variable support for sensitive configuration
- [x] 9.4 Create README with setup instructions and MCP server usage
- [x] 9.5 Add logging system with configurable verbosity
- [x] 9.6 Create example Claude Desktop MCP client configuration