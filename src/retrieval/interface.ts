/**
 * @spec reranker.md
 * @layer 4
 * @description 检索层接口定义
 */

import type { SearchResult, Chunk } from '../types/index';
import type { ProcessedQuery } from '../query/interface';

// 召回路径
export type RecallPath = 'vector' | 'fulltext' | 'code' | 'offline';

// 召回配置
export interface RecallConfig {
  vector?: { enabled: boolean; topK: number; threshold: number };
  fulltext?: { enabled: boolean; topK: number; minScore: number };
  code?: { enabled: boolean; topK: number; astMatch: boolean };
  offline?: { enabled: boolean; topK: number };
  parallel?: boolean;
  timeout?: number;
}

// 召回结果
export interface RecallResult {
  chunkId: string;
  docId: string;
  content: string;
  source: string;
  score: number;
  recallPath: RecallPath;
  metadata: Chunk['metadata'];
}

// Rerank策略
export type RerankStrategy = 'cross-encoder' | 'llm-based' | 'rule-based' | 'hybrid';

// Rerank结果
export interface RerankedResult extends RecallResult {
  rerankScore: number;
  relevanceReason?: string;
  confidence: number;
}

// 过滤条件
export interface FilterCriteria {
  minScore?: number;
  maxAge?: number;
  dedupByDoc?: boolean;
  dedupByContent?: boolean;
  extensions?: string[];
  languages?: string[];
}

// 融合方法
export type FusionMethod = 'rrf' | 'weighted' | 'max' | 'llm-synthesis';

// 检索器接口
export interface IRetriever {
  search(query: ProcessedQuery, config?: RecallConfig): Promise<RecallResult[]>;
}

// 导出 ProcessedQuery 供其他模块使用
export type { ProcessedQuery };

// Reranker接口
export interface IReranker {
  rerank(query: ProcessedQuery, candidates: RecallResult[]): Promise<RerankedResult[]>;
  getStrategy(): RerankStrategy;
}

// 过滤器接口
export interface IResultFilter {
  filter(results: RerankedResult[], criteria: FilterCriteria): Promise<RerankedResult[]>;
}

// 融合器接口
export interface IResultFusion {
  fuse(results: Map<string, RecallResult[]>, method: FusionMethod): Promise<RecallResult[]>;
}

// 检索追踪
export interface RetrievalTrace {
  traceId: string;
  query: string;
  timestamp: Date;
  stages: {
    recall: {
      duration: number;
      paths: Record<RecallPath, { count: number; topScore: number }>;
      merged: number;
    };
    rerank?: {
      duration: number;
      strategy: string;
      input: number;
      output: number;
    };
    filter?: {
      duration: number;
      input: number;
      output: number;
    };
    fusion?: {
      duration: number;
      method: string;
      output: number;
    };
  };
  totalDuration: number;
  finalResults: number;
}