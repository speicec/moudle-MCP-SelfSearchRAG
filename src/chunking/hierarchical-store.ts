import type {
  HierarchicalChunk,
  ChunkLevel,
  QualityScore,
  StructureBoundary,
} from './types.js';
import { createHierarchicalChunk, createDefaultQualityScore } from './types.js';
import type { SemanticChunkerConfig } from './config.js';
import { DEFAULT_SEMANTIC_CHUNKER_CONFIG } from './config.js';
import {
  estimateTokenCount,
  mergeChunks,
  aggregateEmbeddings,
} from './utils.js';
import { StructureBoundaryDetector, createStructureBoundaryDetector } from './structure-boundary-detector.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

/**
 * Storage file name for persistence
 */
const STORAGE_FILE = 'hierarchical-store.json';

/**
 * HierarchicalStore - manages storage and retrieval of hierarchical chunks
 *
 * Implements parent-child relationships:
 * - Small chunks: used for precise retrieval (100-300 tokens)
 * - Parent chunks: provide full context (500-1500 tokens)
 * - Bidirectional lookup: small→parent, parent→children
 *
 * Now supports persistence to disk for data recovery after restart.
 */
export class HierarchicalStore {
  private smallChunks: Map<string, HierarchicalChunk> = new Map();
  private parentChunks: Map<string, HierarchicalChunk> = new Map();
  private config: SemanticChunkerConfig;
  private documentEmbeddings: Map<string, number[]> = new Map();
  private storagePath?: string;
  private autoSave: boolean = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private boundaryDetector: StructureBoundaryDetector;

  constructor(config?: Partial<SemanticChunkerConfig>) {
    this.config = { ...DEFAULT_SEMANTIC_CHUNKER_CONFIG, ...config };
    this.boundaryDetector = createStructureBoundaryDetector(this.config.structureBoundaryConfig);
  }

  /**
   * Enable persistence with auto-save
   */
  async enablePersistence(storagePath: string, autoSave: boolean = true): Promise<void> {
    this.storagePath = storagePath;
    this.autoSave = autoSave;

    // Ensure directory exists
    await fs.mkdir(storagePath, { recursive: true });

    // Load existing data
    await this.load();
  }

  /**
   * Save store to disk
   */
  async save(): Promise<void> {
    if (!this.storagePath) return;

    const data = {
      version: 1,
      smallChunks: Array.from(this.smallChunks.entries()),
      parentChunks: Array.from(this.parentChunks.entries()),
      documentEmbeddings: Array.from(this.documentEmbeddings.entries()),
      savedAt: new Date().toISOString(),
    };

    const filePath = path.join(this.storagePath, STORAGE_FILE);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`[HierarchicalStore] Saved ${this.smallChunks.size} small chunks, ${this.parentChunks.size} parent chunks`);
  }

  /**
   * Schedule a debounced save (for auto-save after modifications)
   */
  private scheduleSave(): void {
    if (!this.autoSave || !this.storagePath) return;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.save().catch(err => {
        console.error('[HierarchicalStore] Auto-save failed:', err);
      });
    }, 1000); // Debounce 1 second
  }

  /**
   * Load store from disk
   */
  async load(): Promise<void> {
    if (!this.storagePath) return;

    const filePath = path.join(this.storagePath, STORAGE_FILE);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (data.version === 1) {
        this.smallChunks = new Map(data.smallChunks);
        this.parentChunks = new Map(data.parentChunks);
        this.documentEmbeddings = new Map(data.documentEmbeddings);

        console.log(`[HierarchicalStore] Loaded ${this.smallChunks.size} small chunks, ${this.parentChunks.size} parent chunks from ${data.savedAt}`);
      }
    } catch (error) {
      // File doesn't exist or is corrupted - start fresh
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[HierarchicalStore] Failed to load store, starting fresh:', (error as Error).message);
      }
    }
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

    // Trigger auto-save after building hierarchy
    this.scheduleSave();

    return [...smallChunks, ...parents];
  }

  /**
   * Group small chunks for parent creation (500-1500 token target)
   * Respects structure boundaries when enabled
   */
  private groupForParents(chunks: HierarchicalChunk[]): HierarchicalChunk[][] {
    if (chunks.length === 0) {
      return [];
    }

    // Detect structure boundaries in combined content if enabled
    let boundaries: StructureBoundary[] = [];
    if (this.config.respectStructureBoundaries) {
      const combinedContent = chunks.map(c => c.content).join('\n');
      boundaries = this.boundaryDetector.detect(combinedContent);
      const highConfidenceBoundaries = this.boundaryDetector.getHighConfidenceBoundaries(boundaries);

      console.log(
        '[HierarchicalStore] Structure boundaries detected:',
        boundaries.length,
        '| high confidence:', highConfidenceBoundaries.length
      );
    }

    const groups: HierarchicalChunk[][] = [];
    let currentGroup: HierarchicalChunk[] = [];
    let currentTokens = 0;
    let contentOffset = 0; // Track position in combined content

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;

      const chunkTokens = estimateTokenCount(chunk.content);

      // Check if this chunk crosses a structure boundary
      const chunkEndPosition = contentOffset + chunk.content.length;
      const crossesBoundary = this.config.respectStructureBoundaries &&
        boundaries.some(b =>
          b.position > contentOffset &&
          b.position < chunkEndPosition
        );

      // Check if adding this chunk would cross a high-confidence boundary before the chunk
      const nextChunkStart = contentOffset + chunk.content.length + 1; // +1 for newline
      const hasBoundaryAfter = this.config.respectStructureBoundaries &&
        this.boundaryDetector.isHighConfidenceBoundary(
          boundaries.find(b => b.position >= nextChunkStart - 10 && b.position <= nextChunkStart + 10) ?? { position: 0, type: 'section', confidence: 0 }
        );

      // Force split if crossing boundary
      if (crossesBoundary && currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
        currentTokens = 0;
      }

      // Enforce parent max size limit
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

      // Force split after high-confidence boundary
      if (hasBoundaryAfter && currentGroup.length > 0 && currentTokens >= this.config.smallChunkMinTokens) {
        groups.push(currentGroup);
        currentGroup = [];
        currentTokens = 0;
      }

      // Check minimum parent size
      if (currentTokens >= this.config.parentChunkMinTokens) {
        groups.push(currentGroup);
        currentGroup = [];
        currentTokens = 0;
      }

      // Update content offset (chunk content + newline separator)
      contentOffset += chunk.content.length + 1;
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

          // Check if merging would cross a boundary
          const wouldCrossBoundary = this.config.respectStructureBoundaries &&
            lastGroup.some(gc => {
              const gcIdx = chunks.findIndex(c => c.id === gc.id);
              const currentIdx = chunks.findIndex(c => currentGroup[0]?.id === c.id);
              return gcIdx !== -1 && currentIdx !== -1 && Math.abs(currentIdx - gcIdx) > 5;
            });

          if (!wouldCrossBoundary && lastGroupTokens + currentTokens <= this.config.parentChunkMaxTokens) {
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

    console.log('[HierarchicalStore] Created', groups.length, 'parent groups from', chunks.length, 'small chunks');
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
   * Get chunks paginated with filtering and sorting
   */
  getChunksPaginated(options: {
    documentId?: string;
    level?: ChunkLevel;
    page?: number;
    pageSize?: number;
    sortBy?: 'position' | 'qualityScore' | 'tokenCount';
    sortOrder?: 'asc' | 'desc';
    minQuality?: number;
    maxQuality?: number;
  }): {
    chunks: HierarchicalChunk[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } {
    const {
      documentId,
      level,
      page = 1,
      pageSize = 20,
      sortBy = 'position',
      sortOrder = 'asc',
      minQuality,
      maxQuality,
    } = options;

    // Collect chunks based on level filter
    let chunks: HierarchicalChunk[] = [];
    if (level === 'small') {
      chunks = Array.from(this.smallChunks.values());
    } else if (level === 'parent') {
      chunks = Array.from(this.parentChunks.values());
    } else {
      chunks = [...Array.from(this.smallChunks.values()), ...Array.from(this.parentChunks.values())];
    }

    // Filter by document ID
    if (documentId) {
      chunks = chunks.filter(c => c.sourceDocumentId === documentId);
    }

    // Filter by quality score
    if (minQuality !== undefined) {
      chunks = chunks.filter(c => c.qualityScore.composite >= minQuality);
    }
    if (maxQuality !== undefined) {
      chunks = chunks.filter(c => c.qualityScore.composite <= maxQuality);
    }

    // Sort
    chunks.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'position') {
        comparison = a.position.start - b.position.start;
      } else if (sortBy === 'qualityScore') {
        comparison = a.qualityScore.composite - b.qualityScore.composite;
      } else if (sortBy === 'tokenCount') {
        comparison = estimateTokenCount(a.content) - estimateTokenCount(b.content);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Paginate
    const total = chunks.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedChunks = chunks.slice(startIndex, startIndex + pageSize);

    return {
      chunks: paginatedChunks,
      total,
      page,
      pageSize,
      totalPages,
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

    // Trigger auto-save after removal
    this.scheduleSave();
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

    // Trigger auto-save after clear
    this.scheduleSave();
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

  /**
   * Get average parent chunk token length
   * Used for DynamicTopK calculation
   */
  getAvgParentTokenLength(): number {
    const parentChunks = this.getAllParentChunks();

    if (parentChunks.length === 0) {
      // Return default estimate if no parent chunks
      return 800; // Default parent chunk size
    }

    const totalTokens = parentChunks.reduce(
      (sum, chunk) => sum + estimateTokenCount(chunk.content),
      0
    );

    return Math.round(totalTokens / parentChunks.length);
  }

  /**
   * Get token statistics for both chunk levels
   */
  getTokenStats(): {
    avgSmallTokens: number;
    avgParentTokens: number;
    minParentTokens: number;
    maxParentTokens: number;
    totalParentTokens: number;
  } {
    const smallChunks = this.getAllSmallChunks();
    const parentChunks = this.getAllParentChunks();

    const smallTokens = smallChunks.map(c => estimateTokenCount(c.content));
    const parentTokens = parentChunks.map(c => estimateTokenCount(c.content));

    return {
      avgSmallTokens: smallTokens.length > 0
        ? Math.round(smallTokens.reduce((a, b) => a + b, 0) / smallTokens.length)
        : 0,
      avgParentTokens: parentTokens.length > 0
        ? Math.round(parentTokens.reduce((a, b) => a + b, 0) / parentTokens.length)
        : 0,
      minParentTokens: parentTokens.length > 0
        ? Math.min(...parentTokens)
        : 0,
      maxParentTokens: parentTokens.length > 0
        ? Math.max(...parentTokens)
        : 0,
      totalParentTokens: parentTokens.reduce((a, b) => a + b, 0),
    };
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