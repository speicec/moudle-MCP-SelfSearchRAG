/**
 * @spec architecture.md#数据结构
 * @layer 0
 * @description 分块类型定义
 */

export interface Chunk {
  id: string;
  docId: string;
  content: string;
  embedding?: number[];
  position: ChunkPosition;
  metadata: ChunkMetadata;
}

export interface ChunkPosition {
  start: number;
  end: number;
}

export interface ChunkMetadata {
  type: 'text' | 'code' | 'mixed';
  language?: string;
  section?: string;
  parentChunkId?: string;
  childChunkIds?: string[];
}

export interface ChunkWithEmbedding extends Chunk {
  embedding: number[];
}

export interface EnhancedChunk extends Chunk {
  originalContent: string;
  enhancedContent: string;
  enhancementTypes: string[];
  enhancement: {
    addedTitle?: string;
    addedContext?: string;
    addedKeywords?: string[];
    addedSummary?: string;
  };
}