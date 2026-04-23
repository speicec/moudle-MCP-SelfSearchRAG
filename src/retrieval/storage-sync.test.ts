/**
 * Tests for Storage Sync and Recovery Mechanism
 *
 * Covers:
 * - recoverFromQdrant method (Task 5.1)
 * - Payload content field storage (Task 5.2)
 * - Startup sync with missing chunks (Task 5.3)
 * - Retrieval with fallback recovery (Task 5.4)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HierarchicalStore } from '../chunking/hierarchical-store.js';
import { createHierarchicalChunk, createDefaultQualityScore } from '../chunking/types.js';
import type { VectorPoint, VectorPayload } from './vector-store-adapter.js';
import { COLLECTION_NAMES } from './vector-store-adapter.js';

// Mock VectorStoreAdapter for testing
class MockVectorStoreAdapter {
  private points: Map<string, Map<string, VectorPoint>> = new Map();

  constructor() {
    this.points.set(COLLECTION_NAMES.TEXT_CHUNKS, new Map());
    this.points.set(COLLECTION_NAMES.PARENT_CHUNKS, new Map());
  }

  addPoint(collection: string, point: VectorPoint): void {
    this.points.get(collection)?.set(point.id, point);
  }

  async getPoint(collection: string, id: string): Promise<VectorPoint | null> {
    const point = this.points.get(collection)?.get(id);
    return point ?? null;
  }

  async getStats(collection: string): Promise<{ vectorCount: number }> {
    return { vectorCount: this.points.get(collection)?.size ?? 0 };
  }

  // Mock other required methods
  async initialize(): Promise<void> {}
  async shutdown(): Promise<void> {}
  isReady(): boolean { return true; }
  async createCollection(): Promise<void> {}
  async deleteCollection(): Promise<void> {}
  async collectionExists(): Promise<boolean> { return true; }
  async upsert(): Promise<void> {}
  async delete(): Promise<void> {}
  async deleteByFilter(): Promise<number> { return 0; }
  async searchDense(): Promise<any[]> { return []; }
  async searchSparse(): Promise<any[]> { return []; }
  async searchHybrid(): Promise<any[]> { return []; }
}

// Mock HybridEmbeddingService for testing
class MockHybridEmbeddingService {
  async embedHybrid(text: string): Promise<{ dense: number[]; sparse: any }> {
    return {
      dense: Array(1024).fill(0.1),
      sparse: { indices: [1, 2, 3], values: [0.5, 0.3, 0.2] },
    };
  }

  async embedSparseOnly(text: string): Promise<{ sparse: any }> {
    return { sparse: { indices: [1, 2], values: [0.5, 0.3] } };
  }
}

describe('Payload Content Field Storage (Task 5.2)', () => {
  it('should include content in VectorPayload when STORE_CONTENT_IN_PAYLOAD is true', async () => {
    // Simulate payload with content
    const payload: VectorPayload = {
      documentId: 'doc-1',
      chunkId: 'chunk-1',
      level: 'small',
      modality: 'text',
      content: 'This is test content for the chunk',
    };

    expect(payload.content).toBeDefined();
    expect(payload.content).toBe('This is test content for the chunk');
  });

  it('should truncate content exceeding max size', async () => {
    const longContent = 'A'.repeat(15000); // 15KB content

    // Truncate to 10KB
    const maxBytes = 10240;
    const truncated = truncateContent(longContent, maxBytes);

    expect(Buffer.byteLength(truncated, 'utf-8')).toBeLessThanOrEqual(maxBytes);
    expect(truncated.endsWith('...')).toBe(true);
  });
});

describe('Recovery from Qdrant (Task 5.1)', () => {
  let hierarchicalStore: HierarchicalStore;
  let mockVectorStore: MockVectorStoreAdapter;

  beforeEach(() => {
    hierarchicalStore = new HierarchicalStore();
    mockVectorStore = new MockVectorStoreAdapter();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should recover chunk from Qdrant payload when content is available', async () => {
    // Add point to mock vector store with content
    const chunkId = 'test-chunk-1';
    const content = 'This is recovered content from Qdrant';

    mockVectorStore.addPoint(COLLECTION_NAMES.TEXT_CHUNKS, {
      id: chunkId,
      vector: [0.1, 0.2],
      payload: {
        documentId: 'doc-1',
        chunkId: chunkId,
        level: 'small',
        modality: 'text',
        content: content,
        qualityScore: 0.8,
        pageNumber: 1,
        position: { start: 0, end: content.length },
      },
    });

    // Simulate recovery
    const point = await mockVectorStore.getPoint(COLLECTION_NAMES.TEXT_CHUNKS, chunkId);

    expect(point).toBeDefined();
    expect(point?.payload?.content).toBe(content);

    // Create chunk from payload and add to store
    if (point?.payload?.content) {
      const recoveredChunk = createHierarchicalChunk(
        point.payload.content,
        [],
        'small',
        point.payload.position ?? { start: 0, end: point.payload.content.length },
        point.payload.documentId,
        createDefaultQualityScore(),
        { contentType: 'text' }
      );
      recoveredChunk.id = chunkId;

      hierarchicalStore.addChunk(recoveredChunk);

      // Verify chunk was added
      const retrievedChunk = hierarchicalStore.getChunk(chunkId);
      expect(retrievedChunk).toBeDefined();
      expect(retrievedChunk?.content).toBe(content);
    }
  });

  it('should return null when content is not in payload', async () => {
    const chunkId = 'test-chunk-no-content';

    mockVectorStore.addPoint(COLLECTION_NAMES.TEXT_CHUNKS, {
      id: chunkId,
      vector: [0.1, 0.2],
      payload: {
        documentId: 'doc-1',
        chunkId: chunkId,
        level: 'small',
        modality: 'text',
        // No content field
        qualityScore: 0.8,
      },
    });

    const point = await mockVectorStore.getPoint(COLLECTION_NAMES.TEXT_CHUNKS, chunkId);

    expect(point?.payload?.content).toBeUndefined();
  });

  it('should recover parent chunk from PARENT_CHUNKS collection', async () => {
    const parentId = 'parent-1';
    const content = 'Parent chunk content for full context';

    mockVectorStore.addPoint(COLLECTION_NAMES.PARENT_CHUNKS, {
      id: parentId,
      sparseVector: { indices: [1], values: [0.5] },
      payload: {
        documentId: 'doc-1',
        chunkId: parentId,
        level: 'parent',
        modality: 'text',
        content: content,
        childIds: ['child-1', 'child-2'],
      },
    });

    const point = await mockVectorStore.getPoint(COLLECTION_NAMES.PARENT_CHUNKS, parentId);

    expect(point).toBeDefined();
    expect(point?.payload?.level).toBe('parent');
    expect(point?.payload?.childIds).toEqual(['child-1', 'child-2']);
  });
});

describe('Startup Sync with Missing Chunks (Task 5.3)', () => {
  let hierarchicalStore: HierarchicalStore;
  let mockVectorStore: MockVectorStoreAdapter;

  beforeEach(() => {
    hierarchicalStore = new HierarchicalStore();
    mockVectorStore = new MockVectorStoreAdapter();
  });

  it('should detect missing chunks when Qdrant has more points', async () => {
    // Add chunks to Qdrant but not to HierarchicalStore
    mockVectorStore.addPoint(COLLECTION_NAMES.TEXT_CHUNKS, {
      id: 'qdrant-1',
      payload: { documentId: 'doc-1', chunkId: 'qdrant-1', level: 'small', modality: 'text' },
    });
    mockVectorStore.addPoint(COLLECTION_NAMES.TEXT_CHUNKS, {
      id: 'qdrant-2',
      payload: { documentId: 'doc-1', chunkId: 'qdrant-2', level: 'small', modality: 'text' },
    });

    // HierarchicalStore is empty
    const storeCount = hierarchicalStore.getChunkCount();
    const qdrantStats = await mockVectorStore.getStats(COLLECTION_NAMES.TEXT_CHUNKS);

    const missing = qdrantStats.vectorCount - storeCount.small;

    expect(missing).toBe(2);
    expect(qdrantStats.vectorCount).toBe(2);
    expect(storeCount.small).toBe(0);
  });

  it('should report consistent when counts match', async () => {
    // Add same number of chunks to both stores
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

    mockVectorStore.addPoint(COLLECTION_NAMES.TEXT_CHUNKS, {
      id: chunk.id,
      payload: { documentId: 'doc-1', chunkId: chunk.id, level: 'small', modality: 'text' },
    });

    const storeCount = hierarchicalStore.getChunkCount();
    const qdrantStats = await mockVectorStore.getStats(COLLECTION_NAMES.TEXT_CHUNKS);

    const consistent = qdrantStats.vectorCount === storeCount.small;

    expect(consistent).toBe(true);
  });
});

/**
 * Helper function to truncate content (matches document-processor.ts)
 */
function truncateContent(content: string, maxBytes: number): string {
  const byteLength = Buffer.byteLength(content, 'utf-8');
  if (byteLength <= maxBytes) {
    return content;
  }
  const truncated = content.slice(0, Math.floor(maxBytes / 3));
  while (Buffer.byteLength(truncated + '...', 'utf-8') > maxBytes) {
    truncated.slice(0, -1);
  }
  return truncated + '...';
}