import fs from 'fs/promises';
import path from 'path';
import type { FastifyInstance } from 'fastify';
import type { DocumentMetadata, PipelineEvent } from './types.js';
import { createDocumentFromFile, detectMimeType } from '../core/document.js';
import { createPipeline } from '../core/pipeline.js';
import { createIngestStage } from '../core/ingest-stage.js';
import { createParseStage } from '../parsers/parse-stage.js';
import { createEmbeddingStage } from '../embedding/embedding-stage.js';
import { createIndexStage } from '../retrieval/index-stage.js';
import { PipelineEmitter } from './pipeline-emitter.js';
import { WebSocketHandler } from './websocket-handler.js';
import { HierarchicalStore } from '../chunking/hierarchical-store.js';
import { createHierarchicalChunk, createDefaultQualityScore } from '../chunking/types.js';
import type { Harness } from '../core/harness.js';
import { PluginRegistry } from '../core/plugin.js';
import type { TextChunk, EmbeddingResult } from '../core/context.js';

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
 */
function buildPipeline(
  documentId: string,
  wsHandler: WebSocketHandler,
  hierarchicalStore: HierarchicalStore
): Harness {
  const registry = new PluginRegistry();
  const emitter = new PipelineEmitter(documentId, wsHandler);

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
          emitter.emitPipelineStart();
          return ctx;
        },
      ],
      onStageStart: [
        (stageName) => {
          emitter.emitStageStart(stageName as import('./types.js').PipelineStageName);
        },
      ],
      onStageComplete: [
        (stageName) => {
          emitter.emitStageComplete(stageName as import('./types.js').PipelineStageName);
        },
      ],
      postExecution: [
        async (result) => {
          if (result.status === 'success') {
            const chunks = result.context.getChunks();
            const embeddings = result.context.getEmbeddings();

            // Store chunks in hierarchical store
            if (chunks && embeddings) {
              await storeInHierarchical(chunks, embeddings, documentId, hierarchicalStore);
            }

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
 */
async function storeInHierarchical(
  chunks: TextChunk[],
  embeddings: EmbeddingResult[],
  documentId: string,
  store: HierarchicalStore
): Promise<void> {
  const hierarchicalChunks: import('../chunking/types.js').HierarchicalChunk[] = [];

  for (const chunk of chunks) {
    const matchingEmbedding = embeddings.find(e => e.chunkId === chunk.id);
    const embeddingVector = matchingEmbedding?.vector ?? [];

    // Create a small hierarchical chunk
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

    hierarchicalChunks.push(hierarchicalChunk);
    store.addChunk(hierarchicalChunk);
  }

  // Build hierarchy from small chunks
  if (hierarchicalChunks.length > 0) {
    await store.buildHierarchy(hierarchicalChunks, documentId);
  }
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
    const pipeline = buildPipeline(documentId, wsHandler, hierarchicalStore);
    const result = await pipeline.run(document);

    // Update status based on result
    if (result.status === 'success') {
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