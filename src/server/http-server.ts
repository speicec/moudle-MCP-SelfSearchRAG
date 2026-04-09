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
import { WebSocketHandler } from './websocket-handler.js';

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

  // Register API routes
  await fastify.register(documentRoutes, { prefix: '/api/documents' });
  fastify.decorate('documentStoragePath', finalConfig.documentStoragePath);
  fastify.decorate('wsHandler', wsHandler);

  await fastify.register(chatRoutes, { prefix: '/api/chat' });

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

  return { fastify, wsHandler };
}

/**
 * Start HTTP server
 */
export async function startHttpServer(config: Partial<HttpServerConfig> = {}): Promise<void> {
  const { fastify, wsHandler } = await createHttpServer(config);
  const finalConfig = { ...DEFAULT_HTTP_SERVER_CONFIG, ...config };

  // Store wsHandler globally for pipeline emitter access
  (globalThis as unknown as { wsHandler: WebSocketHandler }).wsHandler = wsHandler;

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