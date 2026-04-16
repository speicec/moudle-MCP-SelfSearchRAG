import fs from 'fs/promises';
import path from 'path';
import type { FastifyInstance } from 'fastify';
import type { DocumentMetadata, PipelineEvent, ChunkCreatedData } from './types.js';
import { createDocumentFromFile, detectMimeType } from '../core/document.js';
import { createPipeline } from '../core/pipeline.js';
import { createIngestStage } from '../core/ingest-stage.js';
import { createParseStage } from '../parsers/parse-stage.js';
import { createEmbeddingStage } from '../embedding/embedding-stage.js';
import { createIndexStage } from '../retrieval/index-stage.js';
import { PipelineEmitter } from './pipeline-emitter.js';
import { WebSocketHandler } from './websocket-handler.js';
import { HierarchicalStore } from '../chunking/hierarchical-store.js';
import { ImageStore, type ImageBlockRecord, type ImageBlockType } from '../chunking/image-store.js';
import { createHierarchicalChunk, createDefaultQualityScore } from '../chunking/types.js';
import { ChunkQualityFilter, createChunkQualityFilter, aggregateEmbeddings } from '../chunking/index.js';
import type { Harness } from '../core/harness.js';
import { PluginRegistry } from '../core/plugin.js';
import type { TextChunk, EmbeddingResult } from '../core/context.js';
import type { ParsedContent } from '../core/types.js';
import { v4 as uuidv4 } from 'uuid';
import type { VectorStoreAdapter, VectorPoint } from '../retrieval/vector-store-adapter.js';
import { COLLECTION_NAMES } from '../retrieval/vector-store-adapter.js';
import type { QdrantVectorStoreAdapter } from '../retrieval/qdrant-client.js';
import type { HybridEmbeddingService } from '../embedding/hybrid-embedding-service.js';
import { ImageEmbeddingService, createImageEmbeddingService } from '../embedding/image-embedding-service.js';

/**
 * Processing options
 */
interface ProcessOptions {
  documentId: string;
  filePath: string;
  fastify: FastifyInstance;
  storagePath: string;
}

/**
 * Update document metadata file
 */
async function updateMetadata(
  storagePath: string,
  documentId: string,
  updates: Partial<DocumentMetadata>
): Promise<void> {
  const metaPath = path.join(storagePath, `${documentId}.json`);
  try {
    const content = await fs.readFile(metaPath, 'utf-8');
    const existing = JSON.parse(content) as DocumentMetadata;
    const updated = { ...existing, ...updates };
    await fs.writeFile(metaPath, JSON.stringify(updated, null, 2));
  } catch {
    // Metadata file might not exist
    const metadata: DocumentMetadata = {
      id: documentId,
      filename: updates.filename ?? 'unknown',
      size: updates.size ?? 0,
      uploadedAt: Date.now(),
      status: updates.status ?? 'pending',
      ...updates,
    };
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
  }
}

/**
 * Build pipeline with stages and WebSocket emitter
 * Includes metrics collection for each stage
 */
function buildPipeline(
  documentId: string,
  wsHandler: WebSocketHandler,
  hierarchicalStore: HierarchicalStore,
  imageStore?: ImageStore
): Harness {
  const registry = new PluginRegistry();
  const emitter = new PipelineEmitter(documentId, wsHandler);

  // Track stage start times for metrics
  const stageStartTimes: Map<string, number> = new Map();
  let pipelineStartTime = 0;
  let documentSize = 0;

  // Register stage factories
  registry.registerFactory('ingest', () => createIngestStage()['plugins'][0]!);
  registry.registerFactory('parse', () => createParseStage()['plugins'][0]!);
  registry.registerFactory('embed', () => createEmbeddingStage()['plugins'][0]!);
  registry.registerFactory('index', () => createIndexStage()['plugins'][0]!);

  // Create pipeline with hooks
  const pipeline = createPipeline({
    stages: [
      { name: 'ingest', plugins: [{ name: 'ingest' }] },
      { name: 'parse', plugins: [{ name: 'parse' }] },
      { name: 'embed', plugins: [{ name: 'embed' }] },
      { name: 'index', plugins: [{ name: 'index' }] },
    ],
    hooks: {
      preExecution: [
        (ctx) => {
          pipelineStartTime = Date.now();
          // Capture document size from context if available
          const document = (ctx as unknown as { document?: { content?: string } }).document;
          if (document && document.content) {
            documentSize = document.content.length;
          }
          emitter.emitPipelineStart();
          return ctx;
        },
      ],
      onStageStart: [
        (stageName) => {
          stageStartTimes.set(stageName, Date.now());
          emitter.emitStageStart(stageName as import('./types.js').PipelineStageName);
        },
      ],
      onStageComplete: [
        (stageName, context) => {
          const startTime = stageStartTimes.get(stageName) ?? Date.now();
          const duration = Date.now() - startTime;

          // Emit stage completion
          emitter.emitStageComplete(stageName as import('./types.js').PipelineStageName);

          // Collect and emit stage-specific metrics
          const metrics: import('./types.js').StageMetrics = {
            processingTimeMs: duration,
          };

          // Add stage-specific metrics based on stage name
          if (stageName === 'ingest') {
            metrics.fileSizeBytes = documentSize;
          } else if (stageName === 'parse') {
            const chunks = (context as unknown as { getChunks?: () => TextChunk[] })?.getChunks?.();
            if (chunks) {
              metrics.tokensExtracted = estimateTotalTokens(chunks);
              metrics.pagesExtracted = chunks.reduce((sum, c) =>
                sum + (c.pageNumber !== undefined ? 1 : 0), 0);
            }
          } else if (stageName === 'embed') {
            const embeddings = (context as unknown as { getEmbeddings?: () => EmbeddingResult[] })?.getEmbeddings?.();
            if (embeddings && embeddings.length > 0) {
              const firstEmbedding = embeddings[0];
              if (firstEmbedding && firstEmbedding.vector) {
                metrics.embeddingDimension = firstEmbedding.vector.length;
              }
            }
          } else if (stageName === 'index') {
            const chunks = (context as unknown as { getChunks?: () => TextChunk[] })?.getChunks?.();
            if (chunks) {
              metrics.chunksCreated = chunks.length;
              metrics.throughput = chunks.length / (duration / 1000); // chunks per second
            }
          }

          emitter.emitStageMetrics(stageName as import('./types.js').PipelineStageName, metrics);
        },
      ],
      postExecution: [
        async (result) => {
          if (result.status === 'success') {
            const ctx = result.context as unknown as {
              getChunks?: () => TextChunk[];
              getEmbeddings?: () => EmbeddingResult[];
              get?: (key: string) => unknown;
            };
            const chunks = ctx?.getChunks?.();
            const embeddings = ctx?.getEmbeddings?.();
            const totalDuration = Date.now() - pipelineStartTime;

            // Store chunks in hierarchical store and emit chunk events
            if (chunks && embeddings) {
              await storeInHierarchical(chunks, embeddings, documentId, hierarchicalStore, emitter);
            }

            // ✨ Store images in ImageStore
            if (imageStore) {
              const parsedContent = ctx?.get?.('parsedContent') as ParsedContent | undefined;
              if (parsedContent) {
                await storeImagesInImageStore(parsedContent, documentId, imageStore);
              }
            }

            // Record in stats service if available
            // (this will be handled by the statsService listening to events)

            emitter.emitPipelineComplete({
              chunksCreated: chunks?.length ?? 0,
              tokensProcessed: estimateTotalTokens(chunks),
            });
          }
        },
      ],
      onError: [
        (error) => {
          emitter.emitError(error.message, error.stack);
        },
      ],
    },
  }, registry);

  return pipeline;
}

/**
 * Convert pipeline chunks to hierarchical chunks and store
 * Emits chunk:created events in batches (every 10 chunks)
 */
async function storeInHierarchical(
  chunks: TextChunk[],
  embeddings: EmbeddingResult[],
  documentId: string,
  store: HierarchicalStore,
  emitter: PipelineEmitter
): Promise<void> {
  // Create quality filter with default config
  const qualityFilter = createChunkQualityFilter();

  // Collect all chunk embeddings before creating hierarchical chunks
  const allEmbeddings: number[][] = [];
  for (const chunk of chunks) {
    if (!chunk) continue;
    const matchingEmbedding = embeddings.find(e => e.chunkId === chunk.id);
    if (matchingEmbedding?.vector && matchingEmbedding.vector.length > 0) {
      allEmbeddings.push(matchingEmbedding.vector);
    }
  }

  // Aggregate embeddings to compute document embedding
  const docEmbedding = aggregateEmbeddings(allEmbeddings);

  // Log document embedding computation
  console.log(`[QualityFilter] Document ${documentId}: computed embedding (dimension: ${docEmbedding.length})`);

  // Set document embedding for relevance calculation
  qualityFilter.setDocumentEmbedding(documentId, docEmbedding);

  const hierarchicalChunks: import('../chunking/types.js').HierarchicalChunk[] = [];
  const BATCH_SIZE = 10;

  // Quality statistics tracking
  let totalComposite = 0;
  let totalInfoDensity = 0;
  let totalRepRatio = 0;
  let totalSemantic = 0;
  let totalRelevance = 0;
  let evaluatedCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;

    const matchingEmbedding = embeddings.find(e => e.chunkId === chunk.id);
    const embeddingVector = matchingEmbedding?.vector ?? [];

    // Create a small hierarchical chunk with placeholder score
    const hierarchicalChunk = createHierarchicalChunk(
      chunk.text,
      embeddingVector,
      'small',
      { start: chunk.position, end: chunk.position + chunk.text.length },
      documentId,
      createDefaultQualityScore(),
      {
        contentType: chunk.metadata.contentType,
        boundaryConfidence: 0.8,
      }
    );

    // Add pageNumber if available
    if (chunk.pageNumber !== undefined) {
      hierarchicalChunk.metadata.pageNumber = chunk.pageNumber;
    }

    // Evaluate quality score with the quality filter
    const evaluatedScore = qualityFilter.evaluate(hierarchicalChunk);
    hierarchicalChunk.qualityScore = evaluatedScore;

    // Track statistics
    totalComposite += evaluatedScore.composite;
    totalInfoDensity += evaluatedScore.dimensions.informationDensity;
    totalRepRatio += evaluatedScore.dimensions.repetitionRatio;
    totalSemantic += evaluatedScore.dimensions.semanticCompleteness;
    totalRelevance += evaluatedScore.dimensions.documentRelevance;
    evaluatedCount++;

    hierarchicalChunks.push(hierarchicalChunk);
    store.addChunk(hierarchicalChunk);

    // Emit chunk:created event every BATCH_SIZE chunks
    if ((i + 1) % BATCH_SIZE === 0 || i === chunks.length - 1) {
      const chunkData: ChunkCreatedData = {
        id: hierarchicalChunk.id,
        level: 'small',
        contentPreview: chunk.text.slice(0, 100),
        tokenCount: Math.ceil(chunk.text.length / 4),
        qualityScore: hierarchicalChunk.qualityScore.composite,
        position: hierarchicalChunk.position,
        metadata: hierarchicalChunk.metadata as unknown as Record<string, unknown>,
      };
      emitter.emitChunkCreated(chunkData, i + 1);
    }
  }

  // Log quality evaluation results
  if (evaluatedCount > 0) {
    const avgComposite = totalComposite / evaluatedCount;
    const avgInfoDensity = totalInfoDensity / evaluatedCount;
    const avgRepRatio = totalRepRatio / evaluatedCount;
    const avgSemantic = totalSemantic / evaluatedCount;
    const avgRelevance = totalRelevance / evaluatedCount;
    console.log(`[QualityFilter] Document ${documentId}: evaluated ${evaluatedCount} chunks`);
    console.log(`[QualityFilter]   avg composite: ${avgComposite.toFixed(3)}`);
    console.log(`[QualityFilter]   avg infoDensity: ${avgInfoDensity.toFixed(3)}`);
    console.log(`[QualityFilter]   avg repRatio: ${avgRepRatio.toFixed(3)}`);
    console.log(`[QualityFilter]   avg semantic: ${avgSemantic.toFixed(3)}`);
    console.log(`[QualityFilter]   avg relevance: ${avgRelevance.toFixed(3)}`);
  }

  // Build hierarchy from small chunks
  if (hierarchicalChunks.length > 0) {
    await store.buildHierarchy(hierarchicalChunks, documentId);
  }
}

/**
 * Store vectors in Qdrant using Hybrid mode
 * - Small chunks: Dense (1024) + Sparse vectors
 * - Parent chunks: Sparse only vectors
 * - Image chunks: Dense (512) only
 */
async function storeVectorsInQdrant(
  chunks: TextChunk[],
  documentId: string,
  vectorStore: QdrantVectorStoreAdapter,
  hybridEmbedding: HybridEmbeddingService,
  hierarchicalStore: HierarchicalStore,
  imageStore?: ImageStore,
  imageEmbeddingService?: ImageEmbeddingService
): Promise<void> {
  console.log(`[HybridStorage] Storing vectors in Qdrant for document ${documentId}`);

  // Get all small and parent chunks from HierarchicalStore
  const smallChunks = hierarchicalStore.getChunksByDocument(documentId).small;
  const parentChunks = hierarchicalStore.getChunksByDocument(documentId).parent;

  // Process small chunks: Dense + Sparse
  const smallPoints: VectorPoint[] = [];
  for (const smallChunk of smallChunks) {
    if (!smallChunk) continue;

    try {
      // Generate hybrid embedding (Dense + Sparse)
      const hybridResult = await hybridEmbedding.embedHybrid(smallChunk.content);

      smallPoints.push({
        id: smallChunk.id,
        vector: hybridResult.dense,
        sparseVector: hybridResult.sparse,
        payload: {
          documentId,
          chunkId: smallChunk.id,
          parentId: smallChunk.parentId ?? undefined,
          level: 'small',
          modality: 'text',
          qualityScore: smallChunk.qualityScore.composite,
          pageNumber: smallChunk.metadata.pageNumber,
          contentType: smallChunk.metadata.contentType,
          position: smallChunk.position,
        },
      });
    } catch (error) {
      console.warn(`[HybridStorage] Failed to embed small chunk ${smallChunk.id}:`, error);
    }
  }

  // Upsert small chunks to Qdrant
  if (smallPoints.length > 0) {
    await vectorStore.upsertSmall(smallPoints);
    console.log(`[HybridStorage] Upserted ${smallPoints.length} small chunks (Dense+Sparse)`);
  }

  // Process parent chunks: Sparse only
  const parentPoints: VectorPoint[] = [];
  for (const parentChunk of parentChunks) {
    if (!parentChunk) continue;

    try {
      // Generate sparse-only embedding for parent
      const sparseResult = await hybridEmbedding.embedSparseOnly(parentChunk.content);

      parentPoints.push({
        id: parentChunk.id,
        sparseVector: sparseResult.sparse,
        payload: {
          documentId,
          chunkId: parentChunk.id,
          level: 'parent',
          modality: 'text',
          qualityScore: parentChunk.qualityScore.composite,
          pageNumber: parentChunk.metadata.pageNumber,
          contentType: 'text',
          position: parentChunk.position,
          childIds: parentChunk.childIds,
        },
      });
    } catch (error) {
      console.warn(`[HybridStorage] Failed to embed parent chunk ${parentChunk.id}:`, error);
    }
  }

  // Upsert parent chunks to Qdrant (sparse only)
  if (parentPoints.length > 0) {
    await vectorStore.upsertParent(parentPoints);
    console.log(`[HybridStorage] Upserted ${parentPoints.length} parent chunks (Sparse only)`);
  }

  // Process image chunks: Dense only (CLIP 512 dimensions)
  if (imageStore && imageEmbeddingService) {
    const imageRecords = imageStore.getImagesByDocument(documentId);
    const imagePoints: VectorPoint[] = [];

    for (const imageRecord of imageRecords) {
      if (!imageRecord || !imageRecord.imageBuffer) continue;

      try {
        // Generate Dense embedding using CLIP
        const denseVector = await imageEmbeddingService.embedImageBuffer(imageRecord.imageBuffer);

        imagePoints.push({
          id: imageRecord.id,
          vector: denseVector,
          payload: {
            documentId,
            chunkId: imageRecord.id,
            level: 'image',
            modality: 'image',
            blockType: imageRecord.blockType,
            pageNumber: imageRecord.pageNumber,
            vlmText: imageRecord.ocrText,
          },
        });
      } catch (error) {
        console.warn(`[HybridStorage] Failed to embed image ${imageRecord.id}:`, error);
      }
    }

    // Upsert image chunks to Qdrant (Dense only)
    if (imagePoints.length > 0) {
      await vectorStore.upsertImage(imagePoints);
      console.log(`[HybridStorage] Upserted ${imagePoints.length} image chunks (Dense only, 512d)`);
    }
  }

  console.log(`[HybridStorage] Vector storage complete for document ${documentId}`);
}

/**
 * Store images from parsedContent in ImageStore
 */
async function storeImagesInImageStore(
  parsedContent: ParsedContent,
  documentId: string,
  imageStore: ImageStore
): Promise<void> {
  let imageCount = 0;

  for (const page of parsedContent.pages) {
    for (const image of page.images) {
      // Check if image has Buffer content
      if (image.content instanceof Buffer && image.content.length > 0) {
        const record: ImageBlockRecord = {
          id: uuidv4(),
          documentId,
          pageNumber: page.pageNumber,
          imageBuffer: image.content,
          format: (image.metadata.format as 'png' | 'jpeg') ?? 'png',
          width: image.metadata.width ?? 0,
          height: image.metadata.height ?? 0,
          blockType: (image.metadata.blockType as ImageBlockType) ?? 'image',
          confidence: image.metadata.confidence ?? 0.8,
          position: image.position,
          bboxPx: [0, 0, image.metadata.width ?? 0, image.metadata.height ?? 0],  // Fallback bbox
          scale: 1,
          createdAt: new Date(),
        };

        // Only add ocrText if it exists
        if (image.metadata.vlmText) {
          record.ocrText = image.metadata.vlmText;
        }

        imageStore.addImage(record);
        imageCount++;
      }
    }

    // Also extract image buffers from tables and formulas
    for (const table of page.tables) {
      if (table.metadata.imageBuffer instanceof Buffer && table.metadata.imageBuffer.length > 0) {
        const record: ImageBlockRecord = {
          id: uuidv4(),
          documentId,
          pageNumber: page.pageNumber,
          imageBuffer: table.metadata.imageBuffer,
          format: 'png',
          width: table.position.width,
          height: table.position.height,
          blockType: 'table',
          ocrText: table.content,  // VLM result stored as content
          confidence: table.metadata.confidence ?? 0.85,
          position: table.position,
          bboxPx: [0, 0, table.position.width, table.position.height],
          scale: 1,
          createdAt: new Date(),
        };

        imageStore.addImage(record);
        imageCount++;
      }
    }

    for (const formula of page.formulas) {
      if (formula.metadata.imageBuffer instanceof Buffer && formula.metadata.imageBuffer.length > 0) {
        const record: ImageBlockRecord = {
          id: uuidv4(),
          documentId,
          pageNumber: page.pageNumber,
          imageBuffer: formula.metadata.imageBuffer,
          format: 'png',
          width: formula.position.width,
          height: formula.position.height,
          blockType: 'formula',
          ocrText: formula.content,  // VLM result stored as content
          confidence: formula.metadata.confidence ?? 0.85,
          position: formula.position,
          bboxPx: [0, 0, formula.position.width, formula.position.height],
          scale: 1,
          createdAt: new Date(),
        };

        imageStore.addImage(record);
        imageCount++;
      }
    }
  }

  console.log(`[ImageStore] Stored ${imageCount} images for document ${documentId}`);
}

/**
 * Estimate total tokens from chunks
 */
function estimateTotalTokens(chunks: TextChunk[] | undefined): number {
  if (!chunks) return 0;
  return chunks.reduce((sum, c) => sum + Math.ceil(c.text.length / 4), 0);
}

/**
 * Process document asynchronously
 *
 * This function triggers the RAG pipeline after document upload.
 * It runs asynchronously without blocking the HTTP response.
 */
export async function processDocumentAsync(options: ProcessOptions): Promise<void> {
  const { documentId, filePath, fastify, storagePath } = options;
  const wsHandler = fastify.wsHandler;
  const hierarchicalStore = fastify.hierarchicalStore;
  const imageStore = fastify.imageStore as ImageStore | undefined;

  // Get hybrid mode components (if available)
  const vectorStoreAdapter = (fastify as any).vectorStoreAdapter as QdrantVectorStoreAdapter | undefined;
  const hybridEmbeddingService = (fastify as any).hybridEmbeddingService as HybridEmbeddingService | undefined;
  const imageEmbeddingService = (fastify as any).imageEmbeddingService as ImageEmbeddingService | undefined;

  if (!wsHandler || !hierarchicalStore) {
    fastify.log.error({ documentId }, 'Missing wsHandler or hierarchicalStore');
    throw new Error('Server not properly initialized');
  }

  // Update status to processing
  await updateMetadata(storagePath, documentId, { status: 'processing' });

  try {
    // Read file content
    const fileBuffer = await fs.readFile(filePath);
    const mimeType = detectMimeType(filePath);

    // Create Document object
    const document = createDocumentFromFile(filePath, fileBuffer, mimeType);

    // Override the generated ID with our documentId
    document.id = documentId;

    // Build and execute pipeline
    const pipeline = buildPipeline(documentId, wsHandler, hierarchicalStore, imageStore);
    const result = await pipeline.run(document);

    // Update status based on result
    if (result.status === 'success') {
      // Store vectors in Qdrant if hybrid mode is enabled
      if (vectorStoreAdapter && hybridEmbeddingService) {
        try {
          // Get chunks from result context
          const ctx = result.context as unknown as {
            getChunks?: () => TextChunk[];
            getEmbeddings?: () => EmbeddingResult[];
          };
          const chunks = ctx?.getChunks?.() ?? [];

          await storeVectorsInQdrant(
            chunks,
            documentId,
            vectorStoreAdapter,
            hybridEmbeddingService,
            hierarchicalStore,
            imageStore,
            imageEmbeddingService
          );
          fastify.log.info({ documentId }, 'Vectors stored in Qdrant');
        } catch (vectorError) {
          fastify.log.warn({ documentId, error: vectorError }, 'Failed to store vectors in Qdrant, document indexed without vector storage');
        }
      }

      await updateMetadata(storagePath, documentId, { status: 'indexed' });
      fastify.log.info({ documentId }, 'Document processed successfully');
    } else {
      const errorMsg = result.errors.map(e => e.message).join('; ');
      await updateMetadata(storagePath, documentId, {
        status: 'error',
        errorMessage: errorMsg,
      });
      fastify.log.error({ documentId, errors: result.errors }, 'Document processing failed');
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateMetadata(storagePath, documentId, {
      status: 'error',
      errorMessage,
    });

    // Broadcast error via WebSocket
    const errorEvent: PipelineEvent = {
      type: 'error',
      documentId,
      error: { message: errorMessage },
      timestamp: Date.now(),
    };
    wsHandler.broadcast(errorEvent);

    fastify.log.error({ documentId, error }, 'Document processing error');
    throw error;
  }
}

/**
 * Create a document processor function bound to a Fastify instance
 */
export function createDocumentProcessor(
  fastify: FastifyInstance,
  storagePath: string
): (documentId: string, filePath: string) => Promise<void> {
  return (documentId: string, filePath: string) =>
    processDocumentAsync({
      documentId,
      filePath,
      fastify,
      storagePath,
    });
}