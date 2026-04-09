import type {
  HierarchicalChunk,
  ChunkLevel,
  QualityScore,
} from './types.js';
import { createHierarchicalChunk, createDefaultQualityScore } from './types.js';
import type { SemanticChunkerConfig } from './config.js';
import { DEFAULT_SEMANTIC_CHUNKER_CONFIG } from './config.js';
import {
  estimateTokenCount,
  mergeChunks,
  aggregateEmbeddings,
} from './utils.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * HierarchicalStore - manages storage and retrieval of hierarchical chunks
 *
 * Implements parent-child relationships:
 * - Small chunks: used for precise retrieval (100-300 tokens)
 * - Parent chunks: provide full context (500-1500 tokens)
 * - Bidirectional lookup: small→parent, parent→children
 */
export class HierarchicalStore {
  private smallChunks: Map<string, HierarchicalChunk> = new Map();
  private parentChunks: Map<string, HierarchicalChunk> = new Map();
  private config: SemanticChunkerConfig;
  private documentEmbeddings: Map<string, number[]> = new Map();

  constructor(config?: Partial<SemanticChunkerConfig>) {
    this.config = { ...DEFAULT_SEMANTIC_CHUNKER_CONFIG, ...config };
  }

  /**
   * 4.1: Create hierarchical chunks from small chunks
   */
  async buildHierarchy(
    smallChunks: HierarchicalChunk[],
    sourceDocumentId: string
  ): Promise<HierarchicalChunk[]> {
    // 4.2: Group small chunks by proximity for parent creation
    const parentGroups = this.groupForParents(smallChunks);

    // 4.3: Create parent chunks from groups
    const parents: HierarchicalChunk[] = [];
    for (const group of parentGroups) {
      const parent = await this.createParentChunk(group, sourceDocumentId);
      parents.push(parent);

      // 4.4: Link small chunks to parent
      for (const small of group) {
        small.parentId = parent.id;
        this.smallChunks.set(small.id, small);
      }

      // 4.5: Add child IDs to parent
      parent.childIds = group.map(c => c.id);
      this.parentChunks.set(parent.id, parent);
    }

    return [...smallChunks, ...parents];
  }

  /**
   * Group small chunks for parent creation (500-1500 token target)
   */
  private groupForParents(chunks: HierarchicalChunk[]): HierarchicalChunk[][] {
    if (chunks.length === 0) {
      return [];
    }

    const groups: HierarchicalChunk[][] = [];
    let currentGroup: HierarchicalChunk[] = [];
    let currentTokens = 0;

    for (const chunk of chunks) {
      const chunkTokens = estimateTokenCount(chunk.content);

      // 4.5: Enforce parent max size limit
      if (currentTokens + chunkTokens > this.config.parentChunkMaxTokens) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [chunk];
        currentTokens = chunkTokens;
      } else {
        currentGroup.push(chunk);
        currentTokens += chunkTokens;
      }

      // Check minimum parent size
      if (currentTokens >= this.config.parentChunkMinTokens) {
        groups.push(currentGroup);
        currentGroup = [];
        currentTokens = 0;
      }
    }

    // Handle remaining chunks
    if (currentGroup.length > 0) {
      // If last group is too small, merge with previous
      if (currentTokens < this.config.parentChunkMinTokens && groups.length > 0) {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup) {
          const lastGroupTokens = lastGroup.reduce(
            (sum, c) => sum + estimateTokenCount(c.content),
            0
          );

          if (lastGroupTokens + currentTokens <= this.config.parentChunkMaxTokens) {
            lastGroup.push(...currentGroup);
          } else {
            groups.push(currentGroup);
          }
        } else {
          groups.push(currentGroup);
        }
      } else {
        groups.push(currentGroup);
      }
    }

    return groups;
  }

  /**
   * Create parent chunk from small chunk group
   */
  private async createParentChunk(
    smallChunks: HierarchicalChunk[],
    sourceDocumentId: string
  ): Promise<HierarchicalChunk> {
    // Merge content from small chunks
    const content = smallChunks.map(c => c.content).join('\n\n');

    // Calculate parent embedding (aggregate from children)
    const childEmbeddings = smallChunks
      .filter(c => c.embedding.length > 0)
      .map(c => c.embedding);

    const embedding = childEmbeddings.length > 0
      ? aggregateEmbeddings(childEmbeddings)
      : [];

    // Calculate position
    const minStart = Math.min(...smallChunks.map(c => c.position.start));
    const maxEnd = Math.max(...smallChunks.map(c => c.position.end));

    // Calculate quality score (average of children)
    const avgQuality = this.averageQualityScore(smallChunks);

    return createHierarchicalChunk(
      content,
      embedding,
      'parent',
      { start: minStart, end: maxEnd },
      sourceDocumentId,
      avgQuality,
      {
        contentType: 'text',
        boundaryConfidence: Math.max(...smallChunks.map(c => c.metadata.boundaryConfidence ?? 0)),
      },
      undefined, // no parentId for parent chunks
      smallChunks.map(c => c.id)
    );
  }

  /**
   * Calculate average quality score from multiple chunks
   */
  private averageQualityScore(chunks: HierarchicalChunk[]): QualityScore {
    if (chunks.length === 0) {
      return createDefaultQualityScore();
    }

    const avgComposite = chunks.reduce(
      (sum, c) => sum + c.qualityScore.composite,
      0
    ) / chunks.length;

    const avgDimensions = {
      informationDensity: chunks.reduce(
        (sum, c) => sum + c.qualityScore.dimensions.informationDensity,
        0
      ) / chunks.length,
      repetitionRatio: chunks.reduce(
        (sum, c) => sum + c.qualityScore.dimensions.repetitionRatio,
        0
      ) / chunks.length,
      semanticCompleteness: chunks.reduce(
        (sum, c) => sum + c.qualityScore.dimensions.semanticCompleteness,
        0
      ) / chunks.length,
      documentRelevance: chunks.reduce(
        (sum, c) => sum + c.qualityScore.dimensions.documentRelevance,
        0
      ) / chunks.length,
    };

    return {
      composite: avgComposite,
      dimensions: avgDimensions,
      evaluatedAt: new Date(),
    };
  }

  /**
   * 4.6: Store chunk in appropriate collection
   */
  addChunk(chunk: HierarchicalChunk): void {
    if (chunk.level === 'small') {
      this.smallChunks.set(chunk.id, chunk);
    } else {
      this.parentChunks.set(chunk.id, chunk);
    }
  }

  /**
   * Get chunk by ID
   */
  getChunk(id: string): HierarchicalChunk | undefined {
    return this.smallChunks.get(id) ?? this.parentChunks.get(id);
  }

  /**
   * 4.7: Get parent chunk for a small chunk
   */
  getParentChunk(smallChunkId: string): HierarchicalChunk | undefined {
    const smallChunk = this.smallChunks.get(smallChunkId);
    if (!smallChunk || !smallChunk.parentId) {
      return undefined;
    }

    return this.parentChunks.get(smallChunk.parentId);
  }

  /**
   * 4.7: Get all small chunks belonging to a parent
   */
  getChildChunks(parentChunkId: string): HierarchicalChunk[] {
    const parentChunk = this.parentChunks.get(parentChunkId);
    if (!parentChunk || !parentChunk.childIds) {
      return [];
    }

    return parentChunk.childIds
      .map(id => this.smallChunks.get(id))
      .filter((c): c is HierarchicalChunk => c !== undefined);
  }

  /**
   * Get all small chunks
   */
  getAllSmallChunks(): HierarchicalChunk[] {
    return Array.from(this.smallChunks.values());
  }

  /**
   * Get all parent chunks
   */
  getAllParentChunks(): HierarchicalChunk[] {
    return Array.from(this.parentChunks.values());
  }

  /**
   * Get chunks by document ID
   */
  getChunksByDocument(documentId: string): {
    small: HierarchicalChunk[];
    parent: HierarchicalChunk[];
  } {
    return {
      small: this.getAllSmallChunks().filter(c => c.sourceDocumentId === documentId),
      parent: this.getAllParentChunks().filter(c => c.sourceDocumentId === documentId),
    };
  }

  /**
   * Remove all chunks for a document
   */
  removeDocumentChunks(documentId: string): void {
    const { small, parent } = this.getChunksByDocument(documentId);

    for (const chunk of small) {
      this.smallChunks.delete(chunk.id);
    }

    for (const chunk of parent) {
      this.parentChunks.delete(chunk.id);
    }

    this.documentEmbeddings.delete(documentId);
  }

  /**
   * Set document embedding for relevance scoring
   */
  setDocumentEmbedding(documentId: string, embedding: number[]): void {
    this.documentEmbeddings.set(documentId, embedding);
  }

  /**
   * Get document embedding
   */
  getDocumentEmbedding(documentId: string): number[] | undefined {
    return this.documentEmbeddings.get(documentId);
  }

  /**
   * Get chunk count
   */
  getChunkCount(): { small: number; parent: number } {
    return {
      small: this.smallChunks.size,
      parent: this.parentChunks.size,
    };
  }

  /**
   * Clear all chunks
   */
  clear(): void {
    this.smallChunks.clear();
    this.parentChunks.clear();
    this.documentEmbeddings.clear();
  }

  /**
   * Validate hierarchy consistency
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check all small chunks have valid parent references
    for (const small of this.smallChunks.values()) {
      if (small.parentId && !this.parentChunks.has(small.parentId)) {
        errors.push(`Small chunk ${small.id} references missing parent ${small.parentId}`);
      }
    }

    // Check all parent chunks have valid child references
    for (const parent of this.parentChunks.values()) {
      if (!parent.childIds || parent.childIds.length === 0) {
        errors.push(`Parent chunk ${parent.id} has no children`);
      }

      for (const childId of parent.childIds ?? []) {
        if (!this.smallChunks.has(childId)) {
          errors.push(`Parent chunk ${parent.id} references missing child ${childId}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get config
   */
  getConfig(): SemanticChunkerConfig {
    return { ...this.config };
  }
}

/**
 * Create hierarchical store
 */
export function createHierarchicalStore(
  config?: Partial<SemanticChunkerConfig>
): HierarchicalStore {
  return new HierarchicalStore(config);
}