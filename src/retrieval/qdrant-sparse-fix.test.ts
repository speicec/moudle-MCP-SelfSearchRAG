/**
 * Tests for Sparse Vector Field Name Fix
 *
 * Covers:
 * - Sparse vector upsert with correct field name (sparse_vector)
 * - Sparse vector retrieval from Qdrant
 * - Content payload storage and retrieval
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QdrantVectorStoreAdapter } from './qdrant-client.js';
import type { VectorPoint, SparseVector } from './vector-store-adapter.js';
import { COLLECTION_NAMES } from './vector-store-adapter.js';
import { v4 as uuidv4 } from 'uuid';

describe('Sparse Vector Field Fix (qdrant-sparse-vector-field-fix)', () => {
  let adapter: QdrantVectorStoreAdapter;

  beforeEach(async () => {
    adapter = new QdrantVectorStoreAdapter({ url: 'http://localhost:6333' });
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.shutdown();
  });

  describe('Sparse Vector Upsert and Retrieval', () => {
    it('should store sparse vector with correct field name (sparse_vector)', async () => {
      const testId = uuidv4();
      const sparseVector: SparseVector = {
        indices: [1, 5, 10, 20],
        values: [0.8, 0.5, 0.3, 0.1],
      };

      const point: VectorPoint = {
        id: testId,
        vector: Array(1024).fill(0.01), // Dummy dense vector
        sparseVector,
        payload: {
          documentId: 'test-doc',
          chunkId: testId,
          level: 'small',
          modality: 'text',
          content: 'Test content for sparse vector verification',
        },
      };

      // Upsert the point
      await adapter.upsert(COLLECTION_NAMES.TEXT_CHUNKS, [point]);

      // Retrieve and verify sparse vector was stored
      const retrieved = await adapter.getPoint(COLLECTION_NAMES.TEXT_CHUNKS, testId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.sparseVector).toBeDefined();
      expect(retrieved?.sparseVector?.indices).toEqual(sparseVector.indices);
      expect(retrieved?.sparseVector?.values).toEqual(sparseVector.values);

      // Cleanup
      await adapter.delete(COLLECTION_NAMES.TEXT_CHUNKS, [testId]);
    });

    it('should retrieve content from payload when stored', async () => {
      const testId = uuidv4();
      const testContent = 'This is test content that should be stored in payload';

      const point: VectorPoint = {
        id: testId,
        vector: Array(1024).fill(0.01),
        payload: {
          documentId: 'test-doc',
          chunkId: testId,
          level: 'small',
          modality: 'text',
          content: testContent,
        },
      };

      await adapter.upsert(COLLECTION_NAMES.TEXT_CHUNKS, [point]);

      const retrieved = await adapter.getPoint(COLLECTION_NAMES.TEXT_CHUNKS, testId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.payload?.content).toBe(testContent);

      // Cleanup
      await adapter.delete(COLLECTION_NAMES.TEXT_CHUNKS, [testId]);
    });

    it('should perform sparse search and return results', async () => {
      const testId = uuidv4();
      const sparseVector: SparseVector = {
        indices: [1, 5, 10],
        values: [0.9, 0.7, 0.5],
      };

      const point: VectorPoint = {
        id: testId,
        vector: Array(1024).fill(0.01),
        sparseVector,
        payload: {
          documentId: 'test-doc',
          chunkId: testId,
          level: 'small',
          modality: 'text',
          content: 'Test for sparse search',
        },
      };

      await adapter.upsert(COLLECTION_NAMES.TEXT_CHUNKS, [point]);

      // Wait a moment for indexing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Search using similar sparse vector
      const querySparse: SparseVector = {
        indices: [1, 5],
        values: [0.8, 0.6],
      };

      const results = await adapter.searchSparse(COLLECTION_NAMES.TEXT_CHUNKS, {
        sparseVector: querySparse,
        topK: 10,
      });

      // Should return at least one result (our test point)
      expect(results.length).toBeGreaterThan(0);

      // Cleanup
      await adapter.delete(COLLECTION_NAMES.TEXT_CHUNKS, [testId]);
    });
  });

  describe('Parent Chunk Sparse Vectors', () => {
    it('should store parent chunk with sparse vector', async () => {
      const testId = uuidv4();
      const sparseVector: SparseVector = {
        indices: [100, 200, 300],
        values: [0.5, 0.3, 0.2],
      };

      const point: VectorPoint = {
        id: testId,
        sparseVector,
        payload: {
          documentId: 'test-doc',
          chunkId: testId,
          level: 'parent',
          modality: 'text',
          childIds: ['child-1', 'child-2'],
          content: 'Parent chunk content',
        },
      };

      await adapter.upsert(COLLECTION_NAMES.PARENT_CHUNKS, [point]);

      const retrieved = await adapter.getPoint(COLLECTION_NAMES.PARENT_CHUNKS, testId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.sparseVector).toBeDefined();
      expect(retrieved?.payload?.childIds).toEqual(['child-1', 'child-2']);

      // Cleanup
      await adapter.delete(COLLECTION_NAMES.PARENT_CHUNKS, [testId]);
    });
  });
});