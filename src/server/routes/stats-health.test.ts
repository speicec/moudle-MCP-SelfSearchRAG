/**
 * Tests for Health API endpoints (Task 5.5)
 *
 * Covers:
 * - GET /api/health/storage endpoint
 * - POST /api/health/storage/sync endpoint
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { statsRoutes } from './stats.js';
import { HierarchicalStore } from '../../chunking/hierarchical-store.js';
import { createHierarchicalChunk, createDefaultQualityScore } from '../../chunking/types.js';

// Mock vector store adapter
const mockVectorStoreAdapter = {
  async getStats(collection: string) {
    return {
      vectorCount: 5,
      indexStatus: 'green',
    };
  },
};

describe('Health API Endpoint (Task 5.5)', () => {
  let app: Fastify.FastifyInstance;
  let hierarchicalStore: HierarchicalStore;

  beforeEach(async () => {
    hierarchicalStore = new HierarchicalStore();

    // Add some test chunks
    const chunk = createHierarchicalChunk(
      'test content',
      [],
      'small',
      { start: 0, end: 12 },
      'doc-1',
      createDefaultQualityScore(),
      { contentType: 'text' }
    );
    hierarchicalStore.addChunk(chunk);

    // Build minimal fastify app with stats routes
    app = Fastify({
      logger: false,
    });

    // Register routes and decorate with mock services
    await app.register(statsRoutes, { prefix: '/api/stats' });
    app.decorate('hierarchicalStore', hierarchicalStore);
    app.decorate('statsService', null);
    app.decorate('vectorStoreAdapter', mockVectorStoreAdapter);
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('should return storage health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/stats/health/storage',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toHaveProperty('hierarchicalStore');
    expect(body).toHaveProperty('qdrant');
    expect(body).toHaveProperty('syncStatus');

    expect(body.hierarchicalStore.smallChunks).toBe(1);
    expect(body.hierarchicalStore.parentChunks).toBe(0);
    expect(body.hierarchicalStore.persisted).toBe(true);

    expect(body.qdrant.healthy).toBe(true);
    expect(body.qdrant.textChunks).toBe(5);
  });

  it('should report sync status when counts differ', async () => {
    // HierarchicalStore has 1 chunk, Qdrant has 5
    const response = await app.inject({
      method: 'GET',
      url: '/api/stats/health/storage',
    });

    const body = response.json();

    expect(body.syncStatus.consistent).toBe(false);
    expect(body.syncStatus.missingInStore).toContain('~4 small chunks');
  });

  it('should return 503 when HierarchicalStore not initialized', async () => {
    // Create app without hierarchicalStore
    const appNoStore = Fastify({ logger: false });
    await appNoStore.register(statsRoutes, { prefix: '/api/stats' });
    appNoStore.decorate('hierarchicalStore', null);

    const response = await appNoStore.inject({
      method: 'GET',
      url: '/api/stats/health/storage',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toHaveProperty('error');

    await appNoStore.close();
  });

  it('should handle sync trigger endpoint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/stats/health/storage/sync',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body).toHaveProperty('success');
    expect(body).toHaveProperty('syncStatus');
    expect(body).toHaveProperty('message');
  });

  it('should return 503 for sync when VectorStore not initialized', async () => {
    // Create app without vectorStoreAdapter
    const appNoVector = Fastify({ logger: false });
    await appNoVector.register(statsRoutes, { prefix: '/api/stats' });
    appNoVector.decorate('hierarchicalStore', hierarchicalStore);
    appNoVector.decorate('vectorStoreAdapter', null);

    const response = await appNoVector.inject({
      method: 'POST',
      url: '/api/stats/health/storage/sync',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toHaveProperty('error');

    await appNoVector.close();
  });
});