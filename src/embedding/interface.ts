/**
 * @spec architecture.md#Embedding
 * @layer 2
 * @description Embedding接口定义
 */

import type { Chunk } from '../types/index';

// Embedding结果
export interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
  dimensions: number;
}

// 批量Embedding结果
export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalTokens?: number;
  duration: number;
}

// Embedder配置
export interface EmbedderConfig {
  model?: string;
  dimensions?: number;
  batchSize?: number;
  maxRetries?: number;
  timeout?: number;
}

// Embedder接口
export interface IEmbedder {
  // 单文本Embedding
  embed(text: string): Promise<EmbeddingResult>;

  // 批量Embedding
  embedBatch(texts: string[]): Promise<BatchEmbeddingResult>;

  // 获取模型信息
  getModelInfo(): { name: string; dimensions: number };
}

// Chunk with Embedding
export interface ChunkWithEmbedding extends Chunk {
  embedding: number[];
}

// Embedding管道配置
export interface EmbeddingPipelineConfig {
  embedder?: IEmbedder;
  batchSize?: number;
  parallel?: boolean;
}

// Embedding追踪
export interface EmbeddingTrace {
  traceId: string;
  timestamp: Date;
  inputCount: number;
  outputCount: number;
  totalTokens?: number;
  duration: number;
  model: string;
  dimensions: number;
  errors: string[];
}