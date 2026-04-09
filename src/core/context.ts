import type { Document, DocumentMetadata } from './document.js';
import type { PipelineError, StageMetrics } from './harness.js';
import type { ParsedContent } from './types.js';

/**
 * Context keys for type-safe access
 */
export type ContextKey =
  | 'document'
  | 'documentId'
  | 'metadata'
  | 'parsedContent'
  | 'chunks'
  | 'embeddings'
  | 'errors'
  | 'processingState';

/**
 * Processing state enum
 */
export enum ProcessingState {
  PENDING = 'pending',
  INGESTING = 'ingesting',
  PARSING = 'parsing',
  CHUNKING = 'chunking',
  EMBEDDING = 'embedding',
  INDEXING = 'indexing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Internal metrics tracking
 */
interface InternalStageMetrics {
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed';
}

interface InternalPluginMetrics {
  durationMs: number;
  status: 'success' | 'failed';
}

/**
 * Context - the data container passed between stages
 */
export class Context {
  private data: Map<string, unknown> = new Map();
  private errors: PipelineError[] = [];
  private stageMetrics: Map<string, InternalStageMetrics> = new Map();
  private pluginMetrics: Map<string, Map<string, InternalPluginMetrics>> = new Map();
  private state: ProcessingState = ProcessingState.PENDING;

  constructor(initialDocument?: Document) {
    if (initialDocument) {
      this.set('document', initialDocument);
      this.set('documentId', initialDocument.id);
      this.set('metadata', initialDocument.metadata);
    }
  }

  /**
   * Get a value with type safety
   */
  get<T>(key: ContextKey | string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  /**
   * Set a value
   */
  set(key: ContextKey | string, value: unknown): void {
    this.data.set(key, value);
  }

  /**
   * Check if key exists
   */
  has(key: ContextKey | string): boolean {
    return this.data.has(key);
  }

  /**
   * Delete a key
   */
  delete(key: ContextKey | string): boolean {
    return this.data.delete(key);
  }

  /**
   * Get typed document
   */
  getDocument(): Document | undefined {
    return this.get<Document>('document');
  }

  /**
   * Get typed document ID
   */
  getDocumentId(): string | undefined {
    return this.get<string>('documentId');
  }

  /**
   * Get typed metadata
   */
  getMetadata(): DocumentMetadata | undefined {
    return this.get<DocumentMetadata>('metadata');
  }

  /**
   * Get typed parsed content
   */
  getParsedContent(): ParsedContent | undefined {
    return this.get<ParsedContent>('parsedContent');
  }

  /**
   * Get typed chunks
   */
  getChunks(): TextChunk[] | undefined {
    return this.get<TextChunk[]>('chunks');
  }

  /**
   * Get typed embeddings
   */
  getEmbeddings(): EmbeddingResult[] | undefined {
    return this.get<EmbeddingResult[]>('embeddings');
  }

  /**
   * Add an error
   */
  addError(error: PipelineError): void {
    this.errors.push(error);
  }

  /**
   * Get all errors
   */
  getErrors(): PipelineError[] {
    return [...this.errors];
  }

  /**
   * Check if there are errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Set processing state
   */
  setState(state: ProcessingState): void {
    this.state = state;
    this.set('processingState', state);
  }

  /**
   * Get processing state
   */
  getState(): ProcessingState {
    return this.state;
  }

  /**
   * Set stage metrics
   */
  setStageMetrics(stage: string, metrics: InternalStageMetrics): void {
    this.stageMetrics.set(stage, metrics);
  }

  /**
   * Get stage metrics
   */
  getStageMetrics(stage: string): StageMetrics | undefined {
    const internal = this.stageMetrics.get(stage);
    if (!internal) return undefined;

    return {
      durationMs: internal.endTime ? internal.endTime - internal.startTime : 0,
      inputSize: 0,
      outputSize: 0,
    };
  }

  /**
   * Set plugin metrics
   */
  setPluginMetrics(stage: string, plugin: string, metrics: InternalPluginMetrics): void {
    if (!this.pluginMetrics.has(stage)) {
      this.pluginMetrics.set(stage, new Map());
    }
    this.pluginMetrics.get(stage)?.set(plugin, metrics);
  }

  /**
   * Get all stage metrics
   */
  getAllStageMetrics(): Map<string, StageMetrics> {
    const result = new Map<string, StageMetrics>();
    for (const [stage, internal] of this.stageMetrics) {
      if (internal.endTime) {
        result.set(stage, {
          durationMs: internal.endTime - internal.startTime,
          inputSize: 0,
          outputSize: 0,
        });
      }
    }
    return result;
  }

  /**
   * Clone the context
   */
  clone(): Context {
    const cloned = new Context();
    for (const [key, value] of this.data) {
      cloned.data.set(key, value);
    }
    cloned.errors = [...this.errors];
    cloned.state = this.state;
    return cloned;
  }

  /**
   * Merge another context into this one
   */
  merge(other: Context): void {
    for (const [key, value] of other.data) {
      this.data.set(key, value);
    }
    for (const error of other.errors) {
      this.errors.push(error);
    }
  }

  /**
   * Create a frozen snapshot
   */
  snapshot(): ContextSnapshot {
    return {
      data: new Map(this.data),
      errors: [...this.errors],
      state: this.state,
    };
  }
}

/**
 * Immutable snapshot of context state
 */
export interface ContextSnapshot {
  data: Map<string, unknown>;
  errors: PipelineError[];
  state: ProcessingState;
}

/**
 * Text chunk for embedding
 */
export interface TextChunk {
  id: string;
  text: string;
  sourceDocumentId: string;
  pageNumber?: number | undefined;
  position: number;
  metadata: ChunkMetadata;
}

/**
 * Chunk metadata
 */
export interface ChunkMetadata {
  contentType: 'text' | 'table' | 'image' | 'formula';
  section?: string | undefined;
  startOffset?: number | undefined;
  endOffset?: number | undefined;
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  id: string;
  vector: number[];
  chunkId: string;
  modality: 'text' | 'image';
  metadata: EmbeddingMetadata;
}

/**
 * Embedding metadata
 */
export interface EmbeddingMetadata {
  sourceDocumentId: string;
  pageNumber?: number | undefined;
  contentType: string;
  createdAt: Date;
}