/**
 * @spec architecture.md#数据结构
 * @layer 0
 * @description 检索结果类型定义
 */

import type { ChunkMetadata } from './chunk.types';

export interface SearchResult {
  chunkId: string;
  docId: string;
  content: string;
  score: number;
  source: string;
  metadata: ChunkMetadata;
  rerankInfo?: {
    strategy: string;
    rerankScore: number;
    confidence: number;
    reason?: string;
  };
}

export interface FusedResult extends SearchResult {
  fusedScore: number;
  sources?: string[];
  fusionMethod?: string;
}

export interface RetrievalTrace {
  traceId: string;
  query: string;
  timestamp: Date;
  stages: {
    parse?: { duration: number; output: object };
    route?: { duration: number; decision: object };
    recall?: { duration: number; paths: object };
    rerank?: { duration: number; strategy: string };
    fusion?: { duration: number; method: string };
  };
  totalDuration: number;
  totalResults: number;
}