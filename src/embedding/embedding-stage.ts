import { BasePlugin } from '../core/plugin.js';
import { BaseStage } from '../core/stage.js';
import type { Context, TextChunk, EmbeddingResult } from '../core/context.js';
import { ProcessingState as State } from '../core/context.js';
import type { ParsedContent, ImageBlock, EmbeddingVector } from '../core/types.js';
import { TextEmbeddingService } from './embedding-service.js';
import { ImageEmbeddingService } from './image-embedding-service.js';
import { ChunkingService, type ChunkingConfig, DEFAULT_CHUNKING_CONFIG } from './chunking.js';
import { EmbeddingCache } from './cache.js';
import { getEmbeddingFactory, getEmbeddingMode } from './embedding-factory.js';
import type { TextEmbeddingModel } from './embedding-model.js';
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
  private textEmbedder: TextEmbeddingModel;
  private imageEmbedder: ImageEmbeddingService;
  private chunker: ChunkingService;
  private cache: EmbeddingCache;
  private config: EmbeddingStageConfig;

  constructor(config: EmbeddingStageConfig = {}) {
    super('embed');
    this.config = { ...DEFAULT_EMBEDDING_STAGE_CONFIG, ...config };

    // Use factory to create embedding service based on EMBEDDING_MODE
    const factory = getEmbeddingFactory();
    this.textEmbedder = factory.createTextEmbeddingService();

    console.log(`[EmbeddingPlugin] Using ${getEmbeddingMode()} embedding mode, dimension: ${this.textEmbedder.getDimension()}`);

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
      console.log(`[EmbeddingPlugin] Starting chunking for document ${documentId}`);
      const chunks = this.chunker.chunkContent(parsedContent, documentId);
      console.log(`[EmbeddingPlugin] Created ${chunks.length} chunks for document ${documentId}`);

      if (chunks.length === 0) {
        ctx.addError({
          stage: 'embed',
          plugin: this.name,
          message: 'No text chunks created from document. The document may be empty or contain only images.',
          recoverable: false,
        });
        return ctx;
      }

      ctx.set('chunks', chunks);

      // 2. Generate text embeddings
      const embeddings: EmbeddingResult[] = [];

      if (this.config.enableTextEmbeddings) {
        console.log(`[EmbeddingPlugin] Generating embeddings for ${chunks.length} chunks...`);
        const textEmbeddings = await this.generateTextEmbeddings(chunks, documentId);
        console.log(`[EmbeddingPlugin] Generated ${textEmbeddings.length} embeddings`);
        embeddings.push(...textEmbeddings);
      }

      // 3. Generate image embeddings
      if (this.config.enableImageEmbeddings) {
        const images = this.extractImages(parsedContent);
        if (images.length > 0) {
          console.log(`[EmbeddingPlugin] Generating embeddings for ${images.length} images...`);
          const imageEmbeddings = await this.generateImageEmbeddings(images, documentId);
          embeddings.push(...imageEmbeddings);
        }
      }

      if (embeddings.length === 0) {
        ctx.addError({
          stage: 'embed',
          plugin: this.name,
          message: 'No embeddings were generated. Check if the embedding service is working correctly.',
          recoverable: false,
        });
        return ctx;
      }

      ctx.set('embeddings', embeddings);
      ctx.setState(State.EMBEDDING);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Embedding generation failed';
      console.error(`[EmbeddingPlugin] Error during embedding: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        console.error(`[EmbeddingPlugin] Stack trace: ${error.stack}`);
      }
      ctx.addError({
        stage: 'embed',
        plugin: this.name,
        message: errorMessage,
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
    const totalChunks = chunks.length;
    const batchSize = 10; // Process in batches to avoid memory issues

    console.log(`[EmbeddingPlugin] Processing ${totalChunks} chunks in batches of ${batchSize}`);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, Math.min(i + batchSize, chunks.length));
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(totalChunks / batchSize);

      console.log(`[EmbeddingPlugin] Processing batch ${batchNum}/${totalBatches} (${batch.length} chunks)`);

      for (const chunk of batch) {
        try {
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
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[EmbeddingPlugin] Failed to embed chunk ${chunk.id}: ${errorMsg}`);
          // Continue with other chunks instead of failing completely
        }
      }

      // Log progress
      const progress = Math.min(100, Math.round(((i + batch.length) / totalChunks) * 100));
      console.log(`[EmbeddingPlugin] Embedding progress: ${progress}% (${results.length}/${totalChunks} successful)`);
    }

    console.log(`[EmbeddingPlugin] Completed embedding: ${results.length}/${totalChunks} chunks successful`);

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