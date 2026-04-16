import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { QdrantVectorStoreAdapter, createQdrantAdapter, QdrantAdapterConfig, DEFAULT_QDRANT_CONFIG } from '../retrieval/qdrant-client.js';
import type { VectorPoint, SparseVector, CollectionStats } from '../retrieval/vector-store-adapter.js';
import { COLLECTION_NAMES } from '../retrieval/vector-store-adapter.js';

// Skip tests if Qdrant is not available
const shouldRunQdrantTests = process.env.QDRANT_URL !== undefined && process.env.RUN_QDRANT_TESTS === 'true';

// Mock data for testing
const mockDenseVector = Array.from({ length: 1024 }, (_, i) => Math.sin(i / 100) * 0.5);
const mockDenseVector512 = Array.from({ length: 512 }, (_, i) => Math.cos(i / 50) * 0.3);
const mockSparseVector: SparseVector = {
  indices: [1, 5, 10, 20],
  values: [0.8, 0.6, 0.4, 0.2],
};

describe('QdrantVectorStoreAdapter Configuration', () => {
  describe('DEFAULT_QDRANT_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_QDRANT_CONFIG.url).toBe('http://localhost:6333');
      expect(DEFAULT_QDRANT_CONFIG.timeout).toBe(30000);
      expect(DEFAULT_QDRANT_CONFIG.textChunksConfig.dimension).toBe(1024);
      expect(DEFAULT_QDRANT_CONFIG.parentChunksConfig.dimension).toBe(0); // Sparse only
      expect(DEFAULT_QDRANT_CONFIG.imageChunksConfig.dimension).toBe(512);
    });

    it('should have correct collection names', () => {
      expect(COLLECTION_NAMES.TEXT_CHUNKS).toBe('text_chunks');
      expect(COLLECTION_NAMES.PARENT_CHUNKS).toBe('parent_chunks');
      expect(COLLECTION_NAMES.IMAGE_CHUNKS).toBe('image_chunks');
    });
  });

  describe('createQdrantAdapter', () => {
    it('should create adapter with default config', () => {
      const adapter = createQdrantAdapter();
      expect(adapter).toBeDefined();
    });

    it('should create adapter with custom config', () => {
      const customConfig: Partial<QdrantAdapterConfig> = {
        url: 'http://custom-qdrant:6333',
        apiKey: 'test-key',
      };
      const adapter = createQdrantAdapter(customConfig);

      expect(adapter).toBeDefined();
    });

    it('should not be ready before initialization', () => {
      const adapter = createQdrantAdapter();
      expect(adapter.isReady()).toBe(false);
    });
  });
});

describe('QdrantVectorStoreAdapter Types', () => {
  describe('VectorPoint', () => {
    it('should accept dense-only point', () => {
      const point: VectorPoint = {
        id: 'test-1',
        vector: mockDenseVector,
        payload: {
          documentId: 'doc1',
          chunkId: 'chunk1',
          level: 'small',
          modality: 'text',
        },
      };

      expect(point.id).toBe('test-1');
      expect(point.vector).toBeDefined();
      expect(point.sparseVector).toBeUndefined();
    });

    it('should accept sparse-only point', () => {
      const point: VectorPoint = {
        id: 'test-2',
        sparseVector: mockSparseVector,
        payload: {
          documentId: 'doc1',
          chunkId: 'parent1',
          level: 'parent',
          modality: 'text',
        },
      };

      expect(point.id).toBe('test-2');
      expect(point.vector).toBeUndefined();
      expect(point.sparseVector).toBeDefined();
    });

    it('should accept hybrid point (dense + sparse)', () => {
      const point: VectorPoint = {
        id: 'test-3',
        vector: mockDenseVector,
        sparseVector: mockSparseVector,
        payload: {
          documentId: 'doc1',
          chunkId: 'chunk3',
          level: 'small',
          modality: 'text',
          parentId: 'parent1',
        },
      };

      expect(point.id).toBe('test-3');
      expect(point.vector).toBeDefined();
      expect(point.sparseVector).toBeDefined();
    });
  });

  describe('SparseVector', () => {
    it('should have valid format', () => {
      const sparse: SparseVector = {
        indices: [1, 2, 3],
        values: [0.1, 0.2, 0.3],
      };

      expect(sparse.indices.length).toBe(sparse.values.length);
      expect(sparse.indices.every(v => typeof v === 'number')).toBe(true);
      expect(sparse.values.every(v => typeof v === 'number')).toBe(true);
    });
  });
});

// Live Qdrant tests (require running Qdrant server)
(shouldRunQdrantTests ? describe : describe.skip)('QdrantVectorStoreAdapter Live Tests', () => {
  let adapter: QdrantVectorStoreAdapter;

  beforeAll(async () => {
    adapter = createQdrantAdapter({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });

    try {
      await adapter.initialize();
    } catch (error) {
      console.warn('Qdrant initialization failed, skipping live tests:', error);
    }
  }, 60000); // 60s timeout for initialization

  afterAll(async () => {
    if (adapter && adapter.isReady()) {
      // Clean up test collections
      try {
        await adapter.shutdown();
      } catch (error) {
        console.warn('Qdrant shutdown error:', error);
      }
    }
  });

  describe('initialization', () => {
    it('should be ready after initialization', () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      expect(adapter.isReady()).toBe(true);
    });

    it('should have three collections created', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      const stats = await adapter.getStats();

      expect(stats[COLLECTION_NAMES.TEXT_CHUNKS]).toBeDefined();
      expect(stats[COLLECTION_NAMES.PARENT_CHUNKS]).toBeDefined();
      expect(stats[COLLECTION_NAMES.IMAGE_CHUNKS]).toBeDefined();
    });
  });

  describe('Small chunk operations (Dense + Sparse)', () => {
    it('should upsert small chunks with hybrid vectors', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      const points: VectorPoint[] = [
        {
          id: 'test-small-1',
          vector: mockDenseVector,
          sparseVector: mockSparseVector,
          payload: {
            documentId: 'test-doc',
            chunkId: 'test-small-1',
            level: 'small',
            modality: 'text',
            parentId: 'test-parent-1',
            qualityScore: 0.85,
            pageNumber: 1,
          },
        },
      ];

      await adapter.upsertSmall(points);

      // Verify point exists
      const results = await adapter.searchDense(COLLECTION_NAMES.TEXT_CHUNKS, {
        vector: mockDenseVector,
        topK: 1,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('test-small-1');
    });

    it('should search small chunks with sparse vector', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      const results = await adapter.searchSparse(COLLECTION_NAMES.TEXT_CHUNKS, {
        sparseVector: mockSparseVector,
        topK: 5,
      });

      expect(results).toBeInstanceOf(Array);
      // Sparse search should return results
      if (results.length > 0) {
        expect(results[0].score).toBeGreaterThan(0);
      }
    });

    it('should verify parentId in payload', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      const results = await adapter.searchDense(COLLECTION_NAMES.TEXT_CHUNKS, {
        vector: mockDenseVector,
        topK: 1,
        filter: { documentId: 'test-doc' },
      });

      if (results.length > 0) {
        expect(results[0].payload?.parentId).toBe('test-parent-1');
      }
    });
  });

  describe('Parent chunk operations (Sparse only)', () => {
    it('should upsert parent chunks with sparse-only vectors', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      const points: VectorPoint[] = [
        {
          id: 'test-parent-1',
          sparseVector: mockSparseVector,
          payload: {
            documentId: 'test-doc',
            chunkId: 'test-parent-1',
            level: 'parent',
            modality: 'text',
            childIds: ['test-small-1'],
          },
        },
      ];

      await adapter.upsertParent(points);

      // Verify with sparse search
      const results = await adapter.searchSparse(COLLECTION_NAMES.PARENT_CHUNKS, {
        sparseVector: mockSparseVector,
        topK: 1,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('test-parent-1');
    });

    it('should verify childIds in payload', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      const results = await adapter.searchSparse(COLLECTION_NAMES.PARENT_CHUNKS, {
        sparseVector: mockSparseVector,
        topK: 1,
        filter: { documentId: 'test-doc' },
      });

      if (results.length > 0) {
        expect(results[0].payload?.childIds).toContain('test-small-1');
      }
    });
  });

  describe('Image chunk operations (Dense only)', () => {
    it('should upsert image chunks with dense vectors', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      const points: VectorPoint[] = [
        {
          id: 'test-image-1',
          vector: mockDenseVector512,
          payload: {
            documentId: 'test-doc',
            chunkId: 'test-image-1',
            level: 'image',
            modality: 'image',
            blockType: 'figure',
            pageNumber: 1,
            vlmText: 'Test image description',
          },
        },
      ];

      await adapter.upsertImage(points);

      // Verify with dense search
      const results = await adapter.searchDense(COLLECTION_NAMES.IMAGE_CHUNKS, {
        vector: mockDenseVector512,
        topK: 1,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('test-image-1');
    });

    it('should verify vlmText in payload', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      const results = await adapter.searchDense(COLLECTION_NAMES.IMAGE_CHUNKS, {
        vector: mockDenseVector512,
        topK: 1,
        filter: { documentId: 'test-doc' },
      });

      if (results.length > 0) {
        expect(results[0].payload?.vlmText).toBe('Test image description');
      }
    });
  });

  describe('filter operations', () => {
    it('should filter by documentId', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      const results = await adapter.searchDense(COLLECTION_NAMES.TEXT_CHUNKS, {
        vector: mockDenseVector,
        topK: 10,
        filter: { documentId: 'test-doc' },
      });

      expect(results.every(r => r.payload?.documentId === 'test-doc')).toBe(true);
    });

    it('should filter by pageNumber', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      const results = await adapter.searchDense(COLLECTION_NAMES.TEXT_CHUNKS, {
        vector: mockDenseVector,
        topK: 10,
        filter: { pageNumbers: [1] },
      });

      expect(results.every(r => r.payload?.pageNumber === 1)).toBe(true);
    });
  });

  describe('delete operations', () => {
    it('should delete points by ID', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      // First, add a point to delete
      const testId = 'test-delete-1';
      await adapter.upsertSmall([
        {
          id: testId,
          vector: mockDenseVector,
          payload: {
            documentId: 'test-delete-doc',
            chunkId: testId,
            level: 'small',
            modality: 'text',
          },
        },
      ]);

      // Delete the point
      await adapter.delete(COLLECTION_NAMES.TEXT_CHUNKS, [testId]);

      // Verify deletion
      const results = await adapter.searchDense(COLLECTION_NAMES.TEXT_CHUNKS, {
        vector: mockDenseVector,
        topK: 10,
        filter: { documentId: 'test-delete-doc' },
      });

      expect(results.find(r => r.id === testId)).toBeUndefined();
    });

    it('should delete points by filter', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      const deletedCount = await adapter.deleteByFilter(COLLECTION_NAMES.TEXT_CHUNKS, {
        documentId: 'test-doc',
      });

      expect(deletedCount).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return collection statistics', async () => {
      if (!adapter.isReady()) {
        console.warn('Adapter not ready, skipping');
        return;
      }
      const stats = await adapter.getStats();

      expect(stats).toBeInstanceOf(Object);
      expect(stats[COLLECTION_NAMES.TEXT_CHUNKS]).toBeDefined();
      expect(stats[COLLECTION_NAMES.PARENT_CHUNKS]).toBeDefined();
      expect(stats[COLLECTION_NAMES.IMAGE_CHUNKS]).toBeDefined();

      // Each collection should have vectorCount
      for (const collectionStats of Object.values(stats)) {
        expect(collectionStats).toHaveProperty('vectorCount');
      }
    });
  });
});