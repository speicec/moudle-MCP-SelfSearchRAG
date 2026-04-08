/**
 * @spec architecture.md
 * @layer 0
 * @description 配置类型定义
 */

export interface RAGConfig {
  embedding: EmbeddingConfig;
  chunk: ChunkConfig;
  search: SearchConfig;
  storage: StorageConfig;
  harness: HarnessConfig;
}

export interface EmbeddingConfig {
  serviceUrl?: string;
  model: string;
  dimension: number;
  batchSize: number;
  timeout: number;
}

export interface ChunkConfig {
  maxSize: number;
  minSize: number;
  overlap: number;
  strategy: 'fixed' | 'semantic' | 'recursive' | 'ast';
}

export interface SearchConfig {
  defaultTopK: number;
  maxCandidates: number;
  hybridWeight: number;
  rerankEnabled: boolean;
}

export interface StorageConfig {
  milvus: {
    host: string;
    port: number;
    collection: string;
  };
  sqlite: {
    path: string;
  };
  cache: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };
}

export interface HarnessConfig {
  constraints: ConstraintConfig[];
  feedback: {
    enabled: boolean;
    autoAdjust: boolean;
  };
  observability: {
    metricsEnabled: boolean;
    tracingEnabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface ConstraintConfig {
  id: string;
  name: string;
  type: 'block' | 'warn' | 'transform';
  condition: object;
  message?: string;
}