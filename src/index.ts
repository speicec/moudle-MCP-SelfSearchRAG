/**
 * @spec architecture.md
 * @description RAG MCP Server 主入口
 */

// Layer 0: Types
export * from './types';

// Layer 1: Storage - 类型导出
export type {
  IVectorStore,
  IMetadataStore,
  IFullTextStore,
  ICacheStore,
  StorageStats,
  CacheStats
} from './storage';

// Layer 1: Storage - 值导出 (类)
export {
  MilvusVectorStore,
  SQLiteMetadataStore,
  SQLiteFullTextStore,
  MemoryCacheStore
} from './storage';

// Layer 1: Plugins - 类型导出
export type { BasePlugin } from './plugins';

// Layer 1: Plugins - 值导出
export {
  PluginRegistry,
  pluginRegistry,
  PluginLoader,
  pluginLoader
} from './plugins';

// Layer 2: Chunking - 值导出 (都是类)
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

// Layer 2: Embedding - 值导出 (类)
export { EmbeddingPipeline } from './embedding';

// Layer 3: Query - 值导出 (都是类)
export {
  QueryParser,
  QueryRouter,
  QueryDecomposer
} from './query';

// Layer 4: Retrieval - 值导出 (都是类)
export {
  MultiPathRecall,
  RuleBasedReranker,
  RRFReranker,
  ResultFusion
} from './retrieval';

// Layer 5: Harness - 值导出 (都是类)
export {
  ConstraintEngine,
  defaultRules,
  DefaultToolsetManager,
  Logger,
  Tracer,
  HealthChecker,
  FlowOrchestrator
} from './harness';

// Layer 6: Server - 值导出 (类)
export {
  MCPServer,
  allToolDefinitions,
  resourceDefinitions,
  allPromptDefinitions
} from './server';

// Evaluation - 值导出 (都是类)
export {
  RetrievalEvaluator,
  RegressionRunner,
  BenchmarkRunner,
  defaultRegressionTests,
  defaultBenchmarks
} from './evaluation';

// Config - 值导出 (类)
export { ConfigLoader, configLoader } from './config';

// 版本信息
export const VERSION = '0.1.0';

/**
 * 创建 RAG MCP Server 实例
 */
export async function createServer(_config?: Partial<import('./types').RAGConfig>): Promise<void> {
  console.log('RAG MCP Server initializing...');
}