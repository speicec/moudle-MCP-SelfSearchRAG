import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import staticPlugin from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'path';
import { fileURLToPath } from 'url';
import type { HttpServerConfig } from './types.js';
import { DEFAULT_HTTP_SERVER_CONFIG } from './types.js';
import { documentRoutes } from './routes/documents.js';
import { chatRoutes } from './routes/chat.js';
import { statsRoutes } from './routes/stats.js';
import { WebSocketHandler } from './websocket-handler.js';
import { HierarchicalStore } from '../chunking/hierarchical-store.js';
import { ImageStore, createImageStore } from '../chunking/image-store.js';
import { getEmbeddingFactory, getEmbeddingMode } from '../embedding/embedding-factory.js';
import { TextEmbeddingService } from '../embedding/embedding-service.js';
import { StatsAggregationService, createStatsAggregationService } from './stats-aggregation-service.js';
import { getVectorStoreFactory, type VectorStoreType } from '../retrieval/vector-store-factory.js';
import { createHybridSmallToBigRetriever } from '../retrieval/hybrid-small-to-big-retriever.js';
import { createImageEmbeddingService } from '../embedding/image-embedding-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create Fastify HTTP server with WebSocket support
 */
export async function createHttpServer(config: Partial<HttpServerConfig> = {}) {
  const finalConfig: HttpServerConfig = { ...DEFAULT_HTTP_SERVER_CONFIG, ...config };

  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      },
    },
  });

  // Register WebSocket plugin
  await fastify.register(websocket);

  // Register multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit
    },
  });

  // Create WebSocket handler
  const wsHandler = new WebSocketHandler();
  wsHandler.registerWebSocketRoute(fastify);

  // Create HierarchicalStore singleton for RAG
  const hierarchicalStore = new HierarchicalStore();

  // Enable persistence for the store
  const storeDataPath = path.resolve(__dirname, '../../data/store');
  await hierarchicalStore.enablePersistence(storeDataPath, true);

  // Create ImageStore for storing image blocks from VLM processing
  const imageStore = createImageStore();
  await imageStore.enablePersistence(storeDataPath, true);
  fastify.log.info('ImageStore initialized with persistence');

  // Create embedding service using factory
  const embeddingFactory = getEmbeddingFactory();
  const embeddingService = embeddingFactory.createTextEmbeddingService();

  // Log embedding service configuration status
  const mode = getEmbeddingMode();
  if (mode === 'hybrid') {
    fastify.log.info('Embedding service: Using HYBRID embedding (bge-m3, Dense 1024d + Sparse)');
    fastify.log.info('Vector Store: Qdrant (HNSW + Sparse Index)');
  } else if (mode === 'local') {
    fastify.log.info('Embedding service: Using LOCAL embedding (transformers.js, multilingual support)');
  } else {
    const hasApiKey = !!process.env.EMBEDDING_API_KEY || !!process.env.OPENAI_API_KEY;
    fastify.log.info(`Embedding service: Using API embedding (${hasApiKey ? 'configured' : 'MOCK - no API key'})`);
  }

  // Initialize VectorStore if hybrid mode is enabled
  let vectorStoreAdapter: any = null;
  let hybridRetriever: any = null;

  if (mode === 'hybrid') {
    try {
      const vectorStoreFactory = getVectorStoreFactory();
      vectorStoreAdapter = await vectorStoreFactory.createAdapter();
      fastify.log.info(`VectorStore initialized: ${vectorStoreFactory.getType()}`);

      // Create HybridRetriever
      const hybridEmbeddingService = embeddingFactory.getHybridEmbeddingService();
      if (hybridEmbeddingService && vectorStoreAdapter) {
        hybridRetriever = createHybridSmallToBigRetriever(
          vectorStoreAdapter,
          hierarchicalStore,
          hybridEmbeddingService
        );
        fastify.log.info('HybridSmallToBigRetriever initialized');
      }
    } catch (error) {
      fastify.log.warn('Failed to initialize VectorStore, falling back to in-memory mode: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  // Register API routes
  await fastify.register(documentRoutes, { prefix: '/api/documents' });
  fastify.decorate('documentStoragePath', finalConfig.documentStoragePath);
  fastify.decorate('wsHandler', wsHandler);
  fastify.decorate('hierarchicalStore', hierarchicalStore);
  fastify.decorate('imageStore', imageStore);
  // Store embeddingService as any to avoid type issues with Fastify's decorate
  fastify.decorate('embeddingService', embeddingService as unknown as TextEmbeddingService);

  // Decorate with VectorStore and HybridEmbeddingService for hybrid mode
  if (mode === 'hybrid' && vectorStoreAdapter) {
    fastify.decorate('vectorStoreAdapter', vectorStoreAdapter);
    const hybridEmbeddingService = embeddingFactory.getHybridEmbeddingService();
    if (hybridEmbeddingService) {
      fastify.decorate('hybridEmbeddingService', hybridEmbeddingService);
    }
  }

  // Create and decorate ImageEmbeddingService for image vector storage
  const imageEmbeddingService = createImageEmbeddingService();
  fastify.decorate('imageEmbeddingService', imageEmbeddingService);

  await fastify.register(chatRoutes, { prefix: '/api/chat' });
  await fastify.register(statsRoutes, { prefix: '/api/stats' });

  // Create stats aggregation service and start periodic emission
  const statsService = createStatsAggregationService(fastify, hierarchicalStore, 5000);
  statsService.start();
  fastify.decorate('statsService', statsService);

  // Serve frontend static files (for production)
  const frontendDistPath = path.resolve(__dirname, '../frontend');
  try {
    await fastify.register(staticPlugin, {
      root: frontendDistPath,
      prefix: '/',
      // decorateReply: false, //防止默认配置注入报错
    });

    // Serve index.html for root route
    fastify.get('/', async (_request, reply) => {
      return reply.sendFile('index.html');
    });
  } catch {
    // Frontend not built yet, skip static serving
    fastify.log.info('Frontend bundle not found, skipping static file serving');
  }

  // Health check endpoint
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // WebSocket status endpoint
  fastify.get('/api/ws-status', async () => {
    return {
      connectedClients: wsHandler.getClientCount(),
      timestamp: Date.now(),
    };
  });

  return { fastify, wsHandler, hierarchicalStore, imageStore, statsService, vectorStoreAdapter };
}

/**
 * Start HTTP server
 */
export async function startHttpServer(config: Partial<HttpServerConfig> = {}): Promise<void> {
  const { fastify, wsHandler, hierarchicalStore, imageStore, statsService, vectorStoreAdapter } = await createHttpServer(config);
  const finalConfig = { ...DEFAULT_HTTP_SERVER_CONFIG, ...config };

  // Store wsHandler, hierarchicalStore, and imageStore globally for pipeline emitter access
  (globalThis as unknown as {
    wsHandler: WebSocketHandler;
    hierarchicalStore: HierarchicalStore;
    imageStore: ImageStore;
  }).wsHandler = wsHandler;
  (globalThis as unknown as {
    wsHandler: WebSocketHandler;
    hierarchicalStore: HierarchicalStore;
    imageStore: ImageStore;
  }).hierarchicalStore = hierarchicalStore;
  (globalThis as unknown as {
    wsHandler: WebSocketHandler;
    hierarchicalStore: HierarchicalStore;
    imageStore: ImageStore;
  }).imageStore = imageStore;

  try {
    await fastify.listen({ port: finalConfig.port, host: finalConfig.host });
    fastify.log.info(`Server listening on http://${finalConfig.host}:${finalConfig.port}`);
    fastify.log.info(`WebSocket endpoint: ws://${finalConfig.host}:${finalConfig.port}/ws`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    fastify.log.info('Shutting down server...');
    statsService?.stop();

    // Close VectorStore connection if initialized
    if (vectorStoreAdapter) {
      try {
        await vectorStoreAdapter.shutdown();
        fastify.log.info('VectorStore connection closed');
      } catch (error) {
        fastify.log.warn('Error closing VectorStore: ' + (error instanceof Error ? error.message : String(error)));
      }
    }

    wsHandler.broadcast({
      type: 'error',
      message: 'Server shutting down',
      timestamp: Date.now(),
    });
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}