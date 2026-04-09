import { BasePlugin } from '../core/plugin.js';
import { BaseStage } from '../core/stage.js';
import type { Context, TextChunk, EmbeddingResult } from '../core/context.js';
import { ProcessingState as State } from '../core/context.js';
import type { ParsedContent, ImageBlock, EmbeddingVector } from '../core/types.js';
import { TextEmbeddingService } from './embedding-service.js';
import { ImageEmbeddingService } from './image-embedding-service.js';
import { ChunkingService, type ChunkingConfig, DEFAULT_CHUNKING_CONFIG } from './chunking.js';
import { EmbeddingCache } from './cache.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Embedding stage configuration
 */
export interface EmbeddingStageConfig extends Partial<ChunkingConfig> {
  enableTextEmbeddings?: boolean;
  enableImageEmbeddings?: boolean;
  cacheEnabled?: boolean;
}

/**
 * Default embedding stage configuration
 */
export const DEFAULT_EMBEDDING_STAGE_CONFIG: EmbeddingStageConfig = {
  enableTextEmbeddings: true,
  enableImageEmbeddings: true,
  cacheEnabled: true,
  chunkSize: DEFAULT_CHUNKING_CONFIG.chunkSize,
  overlap: DEFAULT_CHUNKING_CONFIG.overlap,
};

/**
 * Embedding plugin - generates embeddings for document content
 */
export class EmbeddingPlugin extends BasePlugin {
  private textEmbedder: TextEmbeddingService;
  private imageEmbedder: ImageEmbeddingService;
  private chunker: ChunkingService;
  private cache: EmbeddingCache;
  private config: EmbeddingStageConfig;

  constructor(config: EmbeddingStageConfig = {}) {
    super('embed');
    this.config = { ...DEFAULT_EMBEDDING_STAGE_CONFIG, ...config };
    this.textEmbedder = new TextEmbeddingService();
    this.imageEmbedder = new ImageEmbeddingService();
    this.chunker = new ChunkingService({
      chunkSize: this.config.chunkSize ?? DEFAULT_CHUNKING_CONFIG.chunkSize,
      overlap: this.config.overlap ?? DEFAULT_CHUNKING_CONFIG.overlap,
    });
    this.cache = new EmbeddingCache();
  }

  /**
   * Process content through embedding
   */
  async process(ctx: Context): Promise<Context> {
    const parsedContent = ctx.getParsedContent();
    const documentId = ctx.getDocumentId();

    if (!parsedContent || !documentId) {
      ctx.addError({
        stage: 'embed',
        plugin: this.name,
        message: 'Missing parsed content or document ID',
        recoverable: false,
      });
      return ctx;
    }

    try {
      // 1. Chunk text content
      const chunks = this.chunker.chunkContent(parsedContent, documentId);
      ctx.set('chunks', chunks);

      // 2. Generate text embeddings
      const embeddings: EmbeddingResult[] = [];

      if (this.config.enableTextEmbeddings) {
        const textEmbeddings = await this.generateTextEmbeddings(chunks, documentId);
        embeddings.push(...textEmbeddings);
      }

      // 3. Generate image embeddings
      if (this.config.enableImageEmbeddings) {
        const images = this.extractImages(parsedContent);
        const imageEmbeddings = await this.generateImageEmbeddings(images, documentId);
        embeddings.push(...imageEmbeddings);
      }

      ctx.set('embeddings', embeddings);
      ctx.setState(State.EMBEDDING);

    } catch (error) {
      ctx.addError({
        stage: 'embed',
        plugin: this.name,
        message: error instanceof Error ? error.message : 'Embedding generation failed',
        recoverable: false,
      });
    }

    return ctx;
  }

  /**
   * Generate embeddings for text chunks
   */
  private async generateTextEmbeddings(
    chunks: TextChunk[],
    documentId: string
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (const chunk of chunks) {
      let vector: number[];

      // Check cache first
      const cacheKey = chunk.text;
      if (this.config.cacheEnabled && this.cache.has(cacheKey, 'text')) {
        const cached = this.cache.get(cacheKey, 'text');
        vector = cached!;
      } else {
        vector = await this.textEmbedder.embedText(chunk.text);
        if (this.config.cacheEnabled) {
          this.cache.set(cacheKey, vector, 'text');
        }
      }

      results.push({
        id: uuidv4(),
        vector,
        chunkId: chunk.id,
        modality: 'text',
        metadata: {
          sourceDocumentId: documentId,
          pageNumber: chunk.pageNumber,
          contentType: chunk.metadata.contentType,
          createdAt: new Date(),
        },
      });
    }

    return results;
  }

  /**
   * Extract images from parsed content
   */
  private extractImages(parsedContent: ParsedContent): ImageBlock[] {
    const images: ImageBlock[] = [];

    for (const page of parsedContent.pages) {
      images.push(...page.images);
    }

    return images;
  }

  /**
   * Generate embeddings for images
   */
  private async generateImageEmbeddings(
    images: ImageBlock[],
    documentId: string
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (const image of images) {
      const content = typeof image.content === 'string'
        ? Buffer.from(image.content, 'base64')
        : image.content;

      let vector: number[];

      // Check cache
      const cacheKey = content.toString('base64').slice(0, 100);
      if (this.config.cacheEnabled && this.cache.has(cacheKey, 'image')) {
        vector = this.cache.get(cacheKey, 'image')!;
      } else {
        vector = await this.imageEmbedder.embedImageBuffer(content);
        if (this.config.cacheEnabled) {
          this.cache.set(cacheKey, vector, 'image');
        }
      }

      results.push({
        id: uuidv4(),
        vector,
        chunkId: image.blockIndex.toString(),
        modality: 'image',
        metadata: {
          sourceDocumentId: documentId,
          pageNumber: image.position.page,
          contentType: 'image',
          createdAt: new Date(),
        },
      });
    }

    return results;
  }
}

/**
 * Embedding stage - orchestrates embedding generation
 */
export class EmbeddingStage extends BaseStage {
  constructor(config?: EmbeddingStageConfig) {
    super('embed', [new EmbeddingPlugin(config)]);
  }
}

/**
 * Create embedding plugin
 */
export function createEmbeddingPlugin(config?: EmbeddingStageConfig): EmbeddingPlugin {
  return new EmbeddingPlugin(config);
}

/**
 * Create embedding stage
 */
export function createEmbeddingStage(config?: EmbeddingStageConfig): EmbeddingStage {
  return new EmbeddingStage(config);
}