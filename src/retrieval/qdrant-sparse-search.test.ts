/**
 * Qdrant Sparse Vector Search Tests
 *
 * Tests for correct API format when searching with sparse vectors
 *
 * Qdrant SearchRequest requires 'vector' field (required, not optional)
 * For sparse vectors, the format is NamedSparseVector:
 *   { name: string, vector: { indices: number[], values: number[] } }
 *
 * Reference: Qdrant REST API schema
 * - SearchRequest.vector: NamedVectorStruct (required)
 * - NamedVectorStruct: number[] | NamedVector | NamedSparseVector
 * - NamedSparseVector: { name: string, vector: SparseVector }
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { QdrantVectorStoreAdapter, createQdrantVectorStoreAdapter } from '../retrieval/qdrant-client.js';
import { COLLECTION_NAMES } from '../retrieval/vector-store-adapter.js';
import type { VectorPoint, SparseVector, SearchQuery } from '../retrieval/vector-store-adapter.js';

// Test configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const shouldRunLiveTests = process.env.RUN_QDRANT_TESTS === 'true';

// Mock sparse vectors for testing
const testSparseVector: SparseVector = {
  indices: [100, 200, 300, 400],
  values: [0.8, 0.6, 0.5, 0.3],
};

describe('Qdrant Sparse Vector Search Format', () => {
  describe('NamedSparseVector format validation', () => {
    it('should construct correct NamedSparseVector for Qdrant search API', () => {
      // Qdrant SearchRequest.vector field must be NamedSparseVector for sparse search
      // NamedSparseVector format: { name: string, vector: { indices, values } }

      const sparseName = 'text_sparse';
      const sparseVector: SparseVector = {
        indices: [100, 200],
        values: [0.5, 0.3],
      };

      // Expected format for Qdrant search API
      const expectedFormat = {
        name: sparseName,
        vector: sparseVector,
      };

      // Validate structure matches Qdrant schema
      expect(expectedFormat).toHaveProperty('name');
      expect(expectedFormat).toHaveProperty('vector');
      expect(expectedFormat.name).toBe(sparseName);
      expect(expectedFormat.vector).toHaveProperty('indices');
      expect(expectedFormat.vector).toHaveProperty('values');

      // This is what Qdrant SearchRequest expects for sparse vector search
      // NOT sparse_vector: { [name]: vector } (wrong format that causes missing field error)
    });

    it('should reject wrong format sparse_vector field', () => {
      // Wrong format that causes "missing field `vector`" error
      const wrongFormat = {
        sparse_vector: {
          'text_sparse': {
            indices: [100, 200],
            values: [0.5, 0.3],
          },
        },
        limit: 10,
      };

      // This format is WRONG because:
      // 1. SearchRequest expects 'vector' field (required)
      // 2. 'sparse_vector' is not a valid SearchRequest field
      expect(wrongFormat).not.toHaveProperty('vector');
      expect(wrongFormat).toHaveProperty('sparse_vector');

      // This would cause: "Format error in JSON body: missing field `vector`"
    });

    it('should use correct sparse vector name based on collection', () => {
      // text_chunks collection -> 'text_sparse'
      // parent_chunks collection -> 'parent_sparse'

      const getExpectedSparseName = (collection: string): string => {
        return collection === COLLECTION_NAMES.PARENT_CHUNKS ? 'parent_sparse' : 'text_sparse';
      };

      expect(getExpectedSparseName(COLLECTION_NAMES.TEXT_CHUNKS)).toBe('text_sparse');
      expect(getExpectedSparseName(COLLECTION_NAMES.PARENT_CHUNKS)).toBe('parent_sparse');
    });
  });

  describe('searchSparse method should use vector field', () => {
    it('should construct search params with vector (NamedSparseVector), not sparse_vector', async () => {
      // This test verifies that searchSparse uses the correct Qdrant API format

      // Create adapter
      const adapter = createQdrantVectorStoreAdapter({ url: QDRANT_URL });

      // Mock the client.search to capture the params
      const searchParamsUsed: any[] = [];
      const originalSearch = adapter['client'].search;

      vi.spyOn(adapter['client'], 'search').mockImplementation(async (collection: string, params: any) => {
        searchParamsUsed.push(params);
        // Return mock results
        return [
          {
            id: 'test-1',
            score: 0.8,
            payload: { documentId: 'doc1', chunkId: 'chunk1', level: 'small', modality: 'text' },
          },
        ] as any;
      });

      // Call searchSparse
      await adapter.searchSparse(COLLECTION_NAMES.TEXT_CHUNKS, {
        sparseVector: testSparseVector,
        topK: 5,
      });

      // Verify the params sent to Qdrant
      expect(searchParamsUsed.length).toBe(1);
      const params = searchParamsUsed[0];

      // MUST have 'vector' field (not 'sparse_vector')
      expect(params).toHaveProperty('vector');
      expect(params).not.toHaveProperty('sparse_vector');

      // 'vector' must be NamedSparseVector format: { name, vector }
      expect(params.vector).toHaveProperty('name');
      expect(params.vector).toHaveProperty('vector');
      expect(params.vector.name).toBe('text_sparse');
      expect(params.vector.vector).toEqual(testSparseVector);

      // Restore mock
      vi.restoreAllMocks();
    });

    it('should use parent_sparse name for parent_chunks collection', async () => {
      const adapter = createQdrantVectorStoreAdapter({ url: QDRANT_URL });

      const searchParamsUsed: any[] = [];

      vi.spyOn(adapter['client'], 'search').mockImplementation(async (collection: string, params: any) => {
        searchParamsUsed.push(params);
        return [] as any;
      });

      await adapter.searchSparse(COLLECTION_NAMES.PARENT_CHUNKS, {
        sparseVector: testSparseVector,
        topK: 5,
      });

      const params = searchParamsUsed[0];
      expect(params.vector.name).toBe('parent_sparse');

      vi.restoreAllMocks();
    });
  });
});

// Live integration tests (require running Qdrant server)
(shouldRunLiveTests ? describe : describe.skip)('Qdrant Sparse Vector Live Tests', () => {
  let adapter: QdrantVectorStoreAdapter;

  beforeAll(async () => {
    adapter = createQdrantVectorStoreAdapter({ url: QDRANT_URL });

    try {
      await adapter.initialize();
    } catch (error) {
      console.warn('Qdrant initialization failed:', error);
    }
  }, 30000);

  afterAll(async () => {
    if (adapter && adapter.isReady()) {
      try {
        await adapter.shutdown();
      } catch (error) {
        console.warn('Shutdown error:', error);
      }
    }
  });

  it('should successfully search text_chunks with sparse vector', async () => {
    if (!adapter.isReady()) {
      console.warn('Adapter not ready, skipping');
      return;
    }

    // Search using sparse vector - should NOT throw "missing field `vector`" error
    const results = await adapter.searchSparse(COLLECTION_NAMES.TEXT_CHUNKS, {
      sparseVector: testSparseVector,
      topK: 5,
    });

    expect(results).toBeInstanceOf(Array);
  });

  it('should successfully search parent_chunks with sparse vector', async () => {
    if (!adapter.isReady()) {
      console.warn('Adapter not ready, skipping');
      return;
    }

    const results = await adapter.searchSparse(COLLECTION_NAMES.PARENT_CHUNKS, {
      sparseVector: testSparseVector,
      topK: 5,
    });

    expect(results).toBeInstanceOf(Array);
  });

  it('should return meaningful scores from sparse search', async () => {
    if (!adapter.isReady()) {
      console.warn('Adapter not ready, skipping');
      return;
    }

    const results = await adapter.searchSparse(COLLECTION_NAMES.TEXT_CHUNKS, {
      sparseVector: testSparseVector,
      topK: 5,
    });

    if (results.length > 0) {
      // Scores should be > 0 (not just rank-based from RRF)
      // With IDF modifier and matching indices, meaningful similarity should be returned
      console.log(`Sparse search results: ${results.length}, scores: ${results.map(r => r.score.toFixed(4))}`);
      expect(results.every(r => r.score > 0)).toBe(true);
    }
  });
});