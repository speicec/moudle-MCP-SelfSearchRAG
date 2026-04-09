import { v4 as uuidv4 } from 'uuid';

/**
 * Chunk level in hierarchical structure
 */
export type ChunkLevel = 'small' | 'parent';

/**
 * Quality filter mode
 */
export type QualityFilterMode = 'discard' | 'merge' | 'flag';

/**
 * Content type within a chunk
 */
export type ChunkContentType = 'text' | 'table' | 'image' | 'formula';

/**
 * Position information for chunk boundaries
 */
export interface ChunkPosition {
  start: number;
  end: number;
  startOffset?: number;
  endOffset?: number;
}

/**
 * Quality score dimensions
 */
export interface QualityDimensions {
  informationDensity: number;  // 0-1, ratio of unique tokens to total
  repetitionRatio: number;     // 0-1, duplicate content ratio (lower is better)
  semanticCompleteness: number; // 0-1, sentence/paragraph structure score
  documentRelevance: number;   // 0-1, similarity to document theme
}

/**
 * Composite quality score
 */
export interface QualityScore {
  composite: number;           // 0-1, weighted average
  dimensions: QualityDimensions;
  evaluatedAt: Date;
}

/**
 * Hierarchical chunk with parent-child relationships
 */
export interface HierarchicalChunk {
  id: string;
  content: string;
  embedding: number[];
  level: ChunkLevel;
  parentId?: string;          // small chunk points to parent
  childIds?: string[];        // parent contains small chunk IDs
  position: ChunkPosition;
  qualityScore: QualityScore;
  sourceDocumentId: string;
  metadata: ChunkMetadata;
}

/**
 * Chunk metadata
 */
export interface ChunkMetadata {
  contentType: ChunkContentType;
  pageNumber?: number;
  section?: string;
  boundaryConfidence?: number; // confidence score for semantic boundary
}

/**
 * Detected semantic cliff (boundary candidate)
 */
export interface SemanticCliff {
  position: number;           // position in embedding sequence
  similarity: number;          // similarity value at cliff
  gradient: number;           // gradient magnitude
  width: number;              // cliff width (number of candidates)
  confidence: number;         // 0-1, confidence score
}

/**
 * Cliff detection result
 */
export interface CliffDetectionResult {
  cliffs: SemanticCliff[];
  similaritySequence: number[];
  embeddingSequence: number[][];
}

/**
 * Sentence with embedding for semantic chunking
 */
export interface SentenceEmbedding {
  index: number;              // position in document
  text: string;
  embedding: number[];
}

/**
 * Sliding window embedding result
 */
export interface WindowEmbedding {
  startIndex: number;
  endIndex: number;
  sentences: string[];
  embedding: number[];        // aggregated window embedding
}

/**
 * Retrieval result with hierarchical info
 */
export interface HierarchicalRetrievalResult {
  smallChunkId: string;
  parentChunkId: string;
  smallChunkContent: string;
  parentChunkContent: string;
  similarityScore: number;
  sourceDocumentId: string;
  metadata: ChunkMetadata;
  expandedFromSmallChunk: boolean;
}

/**
 * Context assembly result
 */
export interface AssembledContext {
  content: string;
  tokenCount: number;
  chunks: HierarchicalRetrievalResult[];
  truncated: boolean;
}

/**
 * Create a new hierarchical chunk
 */
export function createHierarchicalChunk(
  content: string,
  embedding: number[],
  level: ChunkLevel,
  position: ChunkPosition,
  sourceDocumentId: string,
  qualityScore: QualityScore,
  metadata: ChunkMetadata,
  parentId?: string,
  childIds?: string[]
): HierarchicalChunk {
  const chunk: HierarchicalChunk = {
    id: uuidv4(),
    content,
    embedding,
    level,
    position,
    qualityScore,
    sourceDocumentId,
    metadata,
  };

  if (parentId !== undefined) {
    chunk.parentId = parentId;
  }

  if (childIds !== undefined) {
    chunk.childIds = childIds;
  }

  return chunk;
}

/**
 * Create default quality score
 */
export function createDefaultQualityScore(): QualityScore {
  return {
    composite: 0.5,
    dimensions: {
      informationDensity: 0.5,
      repetitionRatio: 0.5,
      semanticCompleteness: 0.5,
      documentRelevance: 0.5,
    },
    evaluatedAt: new Date(),
  };
}

/**
 * Check if chunk is small level
 */
export function isSmallChunk(chunk: HierarchicalChunk): boolean {
  return chunk.level === 'small';
}

/**
 * Check if chunk is parent level
 */
export function isParentChunk(chunk: HierarchicalChunk): boolean {
  return chunk.level === 'parent';
}