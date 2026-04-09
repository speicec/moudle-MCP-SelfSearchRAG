import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { documentRoutes } from '../server/routes/documents.js';
import { chatRoutes } from '../server/routes/chat.js';
import { WebSocketHandler } from '../server/websocket-handler.js';
import websocket from '@fastify/websocket';

describe('HTTP Server', () => {
  let fastify: FastifyInstance;
  let wsHandler: WebSocketHandler;

  beforeAll(async () => {
    fastify = Fastify({
      logger: false, // Disable logging for tests
    });

    // Register WebSocket plugin
    await fastify.register(websocket);

    // Register multipart for file uploads
    await fastify.register(multipart, {
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    });

    // Create WebSocket handler
    wsHandler = new WebSocketHandler();
    wsHandler.registerWebSocketRoute(fastify);

    // Register routes
    fastify.decorate('documentStoragePath', './test-data/documents');
    fastify.decorate('wsHandler', wsHandler);
    await fastify.register(documentRoutes, { prefix: '/api/documents' });
    await fastify.register(chatRoutes, { prefix: '/api/chat' });

    // Health check endpoint
    fastify.get('/api/health', async () => {
      return { status: 'ok', timestamp: Date.now() };
    });

    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/documents', () => {
    it('should return empty array when no documents', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/documents',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('POST /api/documents/upload', () => {
    it('should reject upload without file', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/documents/upload',
      });

      // Without proper multipart data, returns error status
      expect([400, 406, 500]).toContain(response.statusCode);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('should return 404 for non-existent document', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/documents/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/chat/query', () => {
    it('should reject empty query', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/chat/query',
        payload: { query: '' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should process valid query', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/chat/query',
        payload: { query: 'test query' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.query).toBe('test query');
      expect(body.results).toBeDefined();
    });
  });

  describe('GET /api/chat/history', () => {
    it('should return chat history', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/chat/history',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('DELETE /api/chat/history', () => {
    it('should clear chat history', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/chat/history',
      });

      expect(response.statusCode).toBe(200);
    });
  });
});