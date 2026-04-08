/**
 * @spec architecture.md#配置系统
 * @description 配置系统实现
 */

import * as fs from 'fs';
import * as path from 'path';

export interface RAGConfig {
  server: {
    name: string;
    version: string;
  };
  embedding: {
    provider: string;
    model: string;
    dimension: number;
    batchSize: number;
    apiUrl?: string;
    apiKey?: string;
  };
  storage: {
    milvus: {
      host: string;
      port: number;
      collection: string;
    };
    sqlite: {
      path: string;
    };
  };
  chunking: {
    strategy: string;
    chunkSize: number;
    overlap: number;
    minChunkSize: number;
    maxChunkSize: number;
  };
  search: {
    defaultTopK: number;
    defaultMode: string;
    rerankEnabled: boolean;
  };
}

const DEFAULT_CONFIG: RAGConfig = {
  server: {
    name: 'rag-mcp-server',
    version: '1.0.0'
  },
  embedding: {
    provider: 'mock',
    model: 'default',
    dimension: 384,
    batchSize: 50
  },
  storage: {
    milvus: {
      host: 'localhost',
      port: 19530,
      collection: 'rag_collection'
    },
    sqlite: {
      path: ':memory:'
    }
  },
  chunking: {
    strategy: 'recursive',
    chunkSize: 500,
    overlap: 50,
    minChunkSize: 50,
    maxChunkSize: 5000
  },
  search: {
    defaultTopK: 10,
    defaultMode: 'hybrid',
    rerankEnabled: true
  }
};

export class ConfigLoader {
  private config: RAGConfig;
  private configPath?: string;

  constructor(configPath?: string) {
    this.config = { ...DEFAULT_CONFIG };
    this.configPath = configPath;
  }

  load(): RAGConfig {
    // 1. Load from file if exists
    if (this.configPath && fs.existsSync(this.configPath)) {
      try {
        const fileContent = fs.readFileSync(this.configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        this.config = this.mergeConfig(this.config, fileConfig);
      } catch (error) {
        console.warn('Failed to load config file:', error);
      }
    }

    // 2. Override with environment variables
    this.loadFromEnv();

    return this.config;
  }

  get(): RAGConfig {
    return this.config;
  }

  set(key: string, value: unknown): void {
    const parts = key.split('.');
    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  private loadFromEnv(): void {
    // Milvus
    if (process.env.MILVUS_HOST) {
      this.config.storage.milvus.host = process.env.MILVUS_HOST;
    }
    if (process.env.MILVUS_PORT) {
      this.config.storage.milvus.port = parseInt(process.env.MILVUS_PORT, 10);
    }
    if (process.env.MILVUS_COLLECTION) {
      this.config.storage.milvus.collection = process.env.MILVUS_COLLECTION;
    }

    // Embedding
    if (process.env.EMBEDDING_PROVIDER) {
      this.config.embedding.provider = process.env.EMBEDDING_PROVIDER;
    }
    if (process.env.EMBEDDING_MODEL) {
      this.config.embedding.model = process.env.EMBEDDING_MODEL;
    }
    if (process.env.EMBEDDING_API_URL) {
      this.config.embedding.apiUrl = process.env.EMBEDDING_API_URL;
    }
    if (process.env.EMBEDDING_API_KEY) {
      this.config.embedding.apiKey = process.env.EMBEDDING_API_KEY;
    }
    if (process.env.EMBEDDING_DIMENSION) {
      this.config.embedding.dimension = parseInt(process.env.EMBEDDING_DIMENSION, 10);
    }

    // Chunking
    if (process.env.CHUNK_SIZE) {
      this.config.chunking.chunkSize = parseInt(process.env.CHUNK_SIZE, 10);
    }
    if (process.env.CHUNK_OVERLAP) {
      this.config.chunking.overlap = parseInt(process.env.CHUNK_OVERLAP, 10);
    }

    // Search
    if (process.env.SEARCH_TOP_K) {
      this.config.search.defaultTopK = parseInt(process.env.SEARCH_TOP_K, 10);
    }
  }

  private mergeConfig(base: RAGConfig, override: Partial<RAGConfig>): RAGConfig {
    return {
      ...base,
      ...override,
      server: { ...base.server, ...override.server },
      embedding: { ...base.embedding, ...override.embedding },
      storage: {
        ...base.storage,
        ...override.storage,
        milvus: { ...base.storage.milvus, ...override.storage?.milvus },
        sqlite: { ...base.storage.sqlite, ...override.storage?.sqlite }
      },
      chunking: { ...base.chunking, ...override.chunking },
      search: { ...base.search, ...override.search }
    };
  }
}

export const configLoader = new ConfigLoader();