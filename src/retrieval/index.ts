// Retrieval module exports
export * from './vector-store.js';
export * from './search-engine.js';
export * from './context-assembler.js';

// Enhanced Retrieval exports
export * from './config.js';
export * from './types.js';
export * from './query-analyzer.js';
export * from './query-rewriter.js';
export * from './query-decomposer.js';
export * from './query-dsl-builder.js';
export * from './query-expander.js';
export * from './dynamic-topk-calculator.js';
export * from './confidence-calculator.js';
export * from './local-reranker.js';
export * from './hybrid-reranker.js';
export * from './low-confidence-handler.js';
export * from './enhanced-context-assembler.js';
// Explicit exports to avoid name collision with core/PipelineResult
export {
  EnhancedRetrievalPipeline,
  createEnhancedRetrievalPipeline,
  PipelineStats,
} from './enhanced-retrieval-pipeline.js';
// Rename to avoid collision
export { PipelineResult as EnhancedPipelineResult } from './enhanced-retrieval-pipeline.js';

// Vector Store Adapter exports (new)
export * from './vector-store-adapter.js';
export * from './in-memory-adapter.js';
export * from './vector-store-factory.js';
export * from './qdrant-client.js';

// Hybrid Retrieval exports (new)
export * from './rrf-fusion.js';
export * from './hybrid-small-to-big-retriever.js';

// Rename SearchResult from vector-store-adapter to avoid collision with core
export { SearchResult as VectorSearchResult } from './vector-store-adapter.js';