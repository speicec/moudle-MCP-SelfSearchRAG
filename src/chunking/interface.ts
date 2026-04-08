/**
 * @spec chunking-layer.md
 * @layer 2
 * @description 切分接口定义
 */

import type { Document, Chunk, ChunkMetadata, ChunkPosition } from '../types/index';

// 文档类型
export type DocType = 'text' | 'code' | 'markdown' | 'json' | 'html' | 'pdf';

// 切分策略
export type ChunkStrategy =
  | 'fixed-size'
  | 'semantic-boundary'
  | 'recursive'
  | 'ast-based'
  | 'markdown-section'
  | 'sliding-window'
  | 'multi-granularity';

// 文档分析结果
export interface DocumentAnalysis {
  docType: DocType;
  language: string;
  structure: {
    hasTitle: boolean;
    hasSections: boolean;
    sectionCount: number;
    hasList: boolean;
    hasTable: boolean;
    hasCodeBlock: boolean;
    paragraphCount: number;
  };
  semanticDensity: {
    level: 'low' | 'medium' | 'high';
    avgSentenceLength: number;
    avgParagraphLength: number;
    technicalTermRatio: number;
  };
  recommendedStrategy: ChunkStrategy;
}

// 切分配置
export interface ChunkingConfig {
  strategy?: ChunkStrategy;
  chunkSize?: number;
  overlap?: number;
  minChunkSize?: number;
  maxChunkSize?: number;
  semanticThreshold?: number;
  separators?: string[];
}

// 切分器接口
export interface IChunker {
  chunk(document: Document, config?: ChunkingConfig): Promise<Chunk[]>;
}

// 文档分析器接口
export interface IDocumentAnalyzer {
  analyze(document: Document): Promise<DocumentAnalysis>;
}

// 文本增强器接口
export interface ITextEnhancer {
  enhance(chunk: Chunk, context: EnhancementContext): Promise<EnhancedChunk>;
}

// 增强上下文
export interface EnhancementContext {
  document: {
    title?: string;
    summary?: string;
    keywords?: string[];
  };
  prevChunk?: Chunk;
  nextChunk?: Chunk;
  globalContext?: string;
}

// 增强后的分块
export interface EnhancedChunk extends Chunk {
  originalContent: string;
  enhancedContent: string;
  enhancementTypes: EnhancementType[];
  enhancement: {
    addedTitle?: string;
    addedContext?: string;
    addedKeywords?: string[];
    addedSummary?: string;
  };
}

export type EnhancementType =
  | 'title-prefix'
  | 'context-window'
  | 'keyword-injection'
  | 'summary-injection'
  | 'metadata-expansion';

// 分块验证结果
export interface ValidationResult {
  validChunks: Chunk[];
  invalidChunks: InvalidChunk[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
    avgChunkSize: number;
    sizeDistribution: { min: number; max: number; median: number };
  };
}

export interface InvalidChunk {
  chunk: Chunk;
  reason: InvalidReason;
  suggestion: string;
}

export type InvalidReason =
  | 'too-small'
  | 'too-large'
  | 'incomplete'
  | 'low-quality'
  | 'duplicate';

// 切分管道
export interface ChunkingPipeline {
  process(document: Document, config?: ChunkingConfig): Promise<Chunk[]>;
}