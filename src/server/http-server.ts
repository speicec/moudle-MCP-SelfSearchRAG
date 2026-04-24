import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import staticPlugin from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'path';
import { fileURLToPath } from 'url';
import type { HttpServerConfig, PipelineEvent } from './types.js';
import { DEFAULT_HTTP_SERVER_CONFIG } from './types.js';
import { documentRoutes } from './routes/documents.js';
import { chatRoutes } from './routes/chat.js';
import { statsRoutes } from './routes/stats.js';
import { alertRoutes } from './routes/alerts.js';
import { reviewRoutes } from './routes/review.js';
import { queueRoutes } from './routes/queue.js';
import { scalerRoutes } from './routes/scaler.js';
import { WebSocketHandler } from './websocket-handler.js';
import { HierarchicalStore } from '../chunking/hierarchical-store.js';
import { ImageStore, createImageStore } from '../chunking/image-store.js';
import { getEmbeddingFactory, getEmbeddingMode, type PreloadProgress } from '../embedding/embedding-factory.js';
import { TextEmbeddingService } from '../embedding/embedding-service.js';
import { createStatsAggregationService } from './stats-aggregation-service.js';
import { getVectorStoreFactory } from '../retrieval/vector-store-factory.js';
import { createHybridSmallToBigRetriever } from '../retrieval/hybrid-small-to-big-retriever.js';
import { SmallToBigRetriever } from '../chunking/small-to-big-retriever.js';
import { createImageEmbeddingService } from '../embedding/image-embedding-service.js';
import { llmGenerationService } from './services/LLMGenerationService.js';
import type { LLMCaller } from '../config/llm-config.js';
import { syncStores } from './storage-sync.js';
import { createTraceStorage } from '../tracing/TraceStorage.js';

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
  let sharedRetriever: any = null;

  if (mode === 'hybrid') {
    try {
      fastify.log.info('=== Hybrid Mode Initialization ===');

      // Step 1: VectorStore
      const vectorStoreFactory = getVectorStoreFactory();
      vectorStoreAdapter = await vectorStoreFactory.createAdapter();
      fastify.log.info(`  [1/4] VectorStore: ${vectorStoreFactory.getType()}`);

      // Step 2: HybridEmbeddingService
      const hybridEmbeddingService = embeddingFactory.getHybridEmbeddingService();
      if (!hybridEmbeddingService) {
        fastify.log.error('  [FAIL] HybridEmbeddingService not available!');
        throw new Error('Hybrid mode requires HybridEmbeddingService');
      }
      fastify.log.info('  [2/4] HybridEmbeddingService available');

      // Step 3: Create HybridRetriever
      hybridRetriever = createHybridSmallToBigRetriever(
        vectorStoreAdapter,
        hierarchicalStore,
        hybridEmbeddingService
      );
      fastify.log.info('  [3/4] HybridRetriever created');

      // Step 4: Create Shared Retriever and configure Hybrid
      sharedRetriever = new SmallToBigRetriever(hierarchicalStore);
      sharedRetriever.setHybridRetriever(hybridRetriever);
      fastify.log.info('  [4/4] SharedRetriever configured with Hybrid');

      fastify.log.info('=== Hybrid Mode Ready ===');

      // Run storage sync check asynchronously (non-blocking)
      syncStores(hierarchicalStore, vectorStoreAdapter)
        .then(syncStatus => {
          if (!syncStatus.consistent) {
            fastify.log.warn(`Storage sync: ${syncStatus.qdrantSmallCount - syncStatus.storeSmallCount} small chunks, ${syncStatus.qdrantParentCount - syncStatus.storeParentCount} parent chunks missing in HierarchicalStore`);
            fastify.log.info('Recovery mechanism will handle missing chunks during retrieval');
          } else {
            fastify.log.info('Storage sync: All data consistent');
          }
        })
        .catch(error => {
          const errorMsg = error instanceof Error ? error.message : String(error);
          fastify.log.warn('Storage sync check failed: ' + errorMsg);
        });

    } catch (error) {
      fastify.log.warn('Failed to initialize Hybrid mode, falling back to in-memory: ' + (error instanceof Error ? error.message : String(error)));
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

  // Create LLMCaller adapter for Agent use
  // Wraps LLMGenerationService.generateOnce() to match LLMCaller signature
  const llmCaller: LLMCaller = async (prompt: string): Promise<string> => {
    if (!llmGenerationService.isEnabled()) {
      console.warn('[LLMCaller] LLM generation not configured - returning empty response');
      return '';
    }

    const result = await llmGenerationService.generateOnce({
      query: prompt,
      context: '',
      sources: [],
    });

    // Return answer, optionally prepend thinking if needed
    return result.answer;
  };
  fastify.decorate('llmCaller', llmCaller);
  fastify.log.info(`LLMCaller adapter created (enabled: ${llmGenerationService.isEnabled()})`);

  // Decorate with Hybrid components (if available)
  if (mode === 'hybrid' && vectorStoreAdapter && hybridRetriever && sharedRetriever) {
    fastify.decorate('vectorStoreAdapter', vectorStoreAdapter);
    fastify.decorate('hybridRetriever', hybridRetriever);
    fastify.decorate('sharedRetriever', sharedRetriever);

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

  // Initialize TraceStorage for alert and review queue functionality
  const traceStorage = await createTraceStorage('./data/traces.db');
  fastify.decorate('traceStorage', traceStorage);
  fastify.log.info('TraceStorage initialized for alerts and review queue');

  // Register alert routes
  await fastify.register(alertRoutes, { prefix: '/api/alerts' });

  // Register review routes
  await fastify.register(reviewRoutes, { prefix: '/api/review' });

  // Register queue routes (for queue health monitoring)
  await fastify.register(queueRoutes, { prefix: '/api/queue' });

  // Register scaler routes (for autoscaler status and control)
  await fastify.register(scalerRoutes, { prefix: '/api/scaler' });

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

  return { fastify, wsHandler, hierarchicalStore, imageStore, statsService, vectorStoreAdapter, traceStorage };
}

/**
 * Start HTTP server
 */
export async function startHttpServer(config: Partial<HttpServerConfig> = {}): Promise<void> {
  const { fastify, wsHandler, hierarchicalStore, imageStore, statsService, vectorStoreAdapter, traceStorage } = await createHttpServer(config);
  const finalConfig = { ...DEFAULT_HTTP_SERVER_CONFIG, ...config };

  // Store wsHandler, hierarchicalStore, and imageStore globally for pipeline emitter access
  (globalThis as unknown as {
    wsHandler: WebSocketHandler;
    hierarchicalStore: HierarchicalStore;
    imageStore: ImageStore;
    traceStorage: typeof traceStorage;
  }).wsHandler = wsHandler;
  (globalThis as unknown as {
    wsHandler: WebSocketHandler;
    hierarchicalStore: HierarchicalStore;
    imageStore: ImageStore;
    traceStorage: typeof traceStorage;
  }).hierarchicalStore = hierarchicalStore;
  (globalThis as unknown as {
    wsHandler: WebSocketHandler;
    hierarchicalStore: HierarchicalStore;
    imageStore: ImageStore;
    traceStorage: typeof traceStorage;
  }).imageStore = imageStore;
  (globalThis as unknown as {
    wsHandler: WebSocketHandler;
    hierarchicalStore: HierarchicalStore;
    imageStore: ImageStore;
    traceStorage: typeof traceStorage;
  }).traceStorage = traceStorage;

  try {
    await fastify.listen({ port: finalConfig.port, host: finalConfig.host });
    fastify.log.info(`Server listening on http://${finalConfig.host}:${finalConfig.port}`);
    fastify.log.info(`WebSocket endpoint: ws://${finalConfig.host}:${finalConfig.port}/ws`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Preload embedding models after server starts
  // This avoids blocking the HTTP startup while models load
  const mode = getEmbeddingMode();
  if (mode === 'hybrid' || mode === 'local') {
    fastify.log.info('Preloading embedding models (this may take a moment on first run)...');

    // Broadcast startup progress via WebSocket
    const broadcastProgress = (progress: PreloadProgress) => {
      const event: PipelineEvent = {
        type: 'startup:progress',
        startupStage: progress.stage,
        progress: progress.progress,
        message: progress.message,
        timestamp: Date.now(),
      };
      if (progress.model) {
        event.model = progress.model;
      }
      wsHandler.broadcast(event);
    };

    try {
      const embeddingFactory = getEmbeddingFactory();
      await embeddingFactory.preloadModels(broadcastProgress);
      fastify.log.info('Embedding models preloaded successfully');

      // Broadcast ready status
      wsHandler.broadcast({
        type: 'startup:ready',
        message: 'Server ready for document processing',
        timestamp: Date.now(),
      });
    } catch (error) {
      fastify.log.error(`Failed to preload models: ${error instanceof Error ? error.message : String(error)}`);
      wsHandler.broadcast({
        type: 'startup:error',
        message: `Model preload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      });
    }
  } else {
    // API mode - no preloading needed
    wsHandler.broadcast({
      type: 'startup:ready',
      message: 'Server ready (API embedding mode)',
      timestamp: Date.now(),
    });
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