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

// Layer 5: Harness
export {
  ConstraintEngine,
  defaultRules,
  DefaultToolsetManager
} from './harness';

// 版本信息
export const VERSION = '0.1.0';

/**
 * 创建 RAG MCP Server 实例
 */
export async function createServer(_config?: Partial<import('./types').RAGConfig>): Promise<void> {
  console.log('RAG MCP Server initializing...');
}