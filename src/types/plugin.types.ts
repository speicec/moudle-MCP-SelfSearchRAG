/**
 * @spec plugin-system.md
 * @layer 0
 * @description 插件类型定义
 */

export type PluginType =
  | 'embedder'
  | 'chunker'
  | 'retriever'
  | 'reranker'
  | 'index-store'
  | 'cache-store'
  | 'evaluator';

export type PluginStatus = 'uninitialized' | 'initialized' | 'running' | 'stopped' | 'error';

export interface PluginMeta {
  name: string;
  version: string;
  type: PluginType;
  author?: string;
  description?: string;
  dependencies?: string[];
  compatibleVersions: string[];
}

export interface Plugin {
  meta: PluginMeta;
  status: PluginStatus;
  init(config: PluginConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;
}

export interface PluginConfig {
  [key: string]: unknown;
}

export interface PluginDefinition {
  meta: PluginMeta;
  factory: PluginFactory;
  defaultConfig?: PluginConfig;
}

export type PluginFactory = (config: PluginConfig) => Plugin;

export interface PluginError {
  pluginName: string;
  code: string;
  message: string;
  timestamp: Date;
  stack?: string;
}

// Embedder 插件接口
export interface EmbedderCapabilities {
  modalities: ('text' | 'code' | 'image' | 'audio')[];
  dimensions: number;
  batchSupport: boolean;
}

// Chunker 插件接口
export interface ChunkerCapabilities {
  supportedTypes: ('text' | 'code' | 'markdown')[];
  overlapSupport: boolean;
  adaptiveChunking: boolean;
}

// Retriever 插件接口
export interface RetrieverCapabilities {
  searchTypes: ('vector' | 'fulltext' | 'hybrid')[];
  filterSupport: boolean;
  offlineSupport: boolean;
}