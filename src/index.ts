/**
 * @spec architecture.md
 * @description RAG MCP Server 主入口
 */

// Layer 0: Types
export * from './types';

// Layer 1: Storage
export {
  IVectorStore,
  IMetadataStore,
  IFullTextStore,
  ICacheStore,
  StorageStats,
  CacheStats,
  MilvusVectorStore,
  SQLiteMetadataStore,
  SQLiteFullTextStore,
  MemoryCacheStore
} from './storage';

// Layer 1: Plugins
export {
  BasePlugin,
  PluginRegistry,
  pluginRegistry,
  PluginLoader,
  pluginLoader
} from './plugins';

// Layer 2: Chunking
export {
  DocumentAnalyzer,
  RecursiveChunker,
  FixedSizeChunker,
  MarkdownSectionChunker,
  TextEnhancer,
  ChunkValidator,
  ChunkingPipelineImpl,
  chunkingPipeline
} from './chunking';

// Layer 2: Embedding
export { EmbeddingPipeline } from './embedding';

// Layer 3: Query
export {
  QueryParser,
  QueryRouter,
  QueryDecomposer
} from './query';

// Layer 4: Retrieval
export {
  MultiPathRecall,
  RuleBasedReranker,
  RRFReranker,
  ResultFusion
} from './retrieval';

// Layer 5: Harness
export {
  ConstraintEngine,
  defaultRules,
  DefaultToolsetManager,
  Logger,
  Tracer,
  HealthChecker,
  FlowOrchestrator
} from './harness';

// Layer 6: Server
export {
  MCPServer,
  allToolDefinitions,
  resourceDefinitions,
  allPromptDefinitions
} from './server';

// Config
export { ConfigLoader, configLoader } from './config';

// 版本信息
export const VERSION = '0.1.0';

/**
 * 创建 RAG MCP Server 实例
 */
export async function createServer(_config?: Partial<import('./types').RAGConfig>): Promise<void> {
  console.log('RAG MCP Server initializing...');
}