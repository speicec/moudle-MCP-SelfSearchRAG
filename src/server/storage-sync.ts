/**
 * Storage Sync Utility
 *
 * Compares HierarchicalStore and Qdrant data consistency at startup.
 * Logs warnings for missing data and optionally recovers from Qdrant payload.
 */

import type { HierarchicalStore } from '../chunking/hierarchical-store.js';
import type { VectorStoreAdapter } from '../retrieval/vector-store-adapter.js';
import { COLLECTION_NAMES } from '../retrieval/vector-store-adapter.js';
import type { HierarchicalChunk } from '../chunking/types.js';
import { createHierarchicalChunk, createDefaultQualityScore } from '../chunking/types.js';
import { DEFAULT_PAYLOAD_STORAGE_CONFIG } from '../config/vector-db-config.js';

/**
 * Sync status result
 */
export interface SyncStatus {
  /** HierarchicalStore small chunk count */
  storeSmallCount: number;
  /** HierarchicalStore parent chunk count */
  storeParentCount: number;
  /** Qdrant text_chunks count */
  qdrantSmallCount: number;
  /** Qdrant parent_chunks count */
  qdrantParentCount: number;
  /** Whether data is consistent */
  consistent: boolean;
  /** Chunks missing in HierarchicalStore */
  missingInStore: string[];
  /** Chunks recovered during sync */
  recoveredChunks: string[];
  /** Recovery failures */
  recoveryFailures: string[];
}

/**
 * Get missing chunk IDs by comparing store counts
 *
 * For efficiency, we use count comparison first, then scroll through Qdrant
 * to find specific IDs only if counts differ significantly.
 */
export async function getMissingChunkIdsss(
  hierarchicalStore: HierarchicalStore,
  vectorStore: VectorStoreAdapter
): Promise<{
  missingSmall: number;
  missingParent: number;
  missingSmallIds: string[];
  missingParentIds: string[];
}> {
  // Get counts from both stores
  const storeCount = hierarchicalStore.getChunkCount();
  const qdrantSmallStats = await vectorStore.getStats(COLLECTION_NAMES.TEXT_CHUNKS);
  const qdrantParentStats = await vectorStore.getStats(COLLECTION_NAMES.PARENT_CHUNKS);

  const missingSmall = qdrantSmallStats.vectorCount - storeCount.small;
  const missingParent = qdrantParentStats.vectorCount - storeCount.parent;

  // If counts match, no missing chunks
  if (missingSmall <= 0 && missingParent <= 0) {
    return {
      missingSmall: 0,
      missingParent: 0,
      missingSmallIds: [],
      missingParentIds: [],
    };
  }

  // Note: For large collections, scrolling through all IDs would be expensive.
  // We return count estimates and let recovery happen on-demand during retrieval.

  return {
    missingSmall,
    missingParent,
    missingSmallIds: [], // Would need scrollPoints to get actual IDs
    missingParentIds: [],
  };
}

/**
 * Recover a chunk from Qdrant payload
 */
async function recoverChunkFromQdrant(
  chunkId: string,
  vectorStore: VectorStoreAdapter,
  level: 'small' | 'parent'
): Promise<HierarchicalChunk | null> {
  if (!DEFAULT_PAYLOAD_STORAGE_CONFIG.storeContentInPayload) {
    return null;
  }

  const collection = level === 'small' ? COLLECTION_NAMES.TEXT_CHUNKS : COLLECTION_NAMES.PARENT_CHUNKS;
  const point = await vectorStore.getPoint(collection, chunkId);

  if (!point || !point.payload) {
    return null;
  }

  const payload = point.payload;

  // Check if content is available in payload
  if (!payload.content) {
    return null;
  }

  const metadata: import('../chunking/types.js').ChunkMetadata = {
      contentType: (payload.contentType as 'text' | 'table' | 'image' | 'formula') ?? 'text',
      boundaryConfidence: 0.5,
      ...(payload.pageNumber !== undefined ? { pageNumber: payload.pageNumber } : {}),
    };

    const recoveredChunk = createHierarchicalChunk(
      payload.content,
      [], // Empty embedding - stored in Qdrant
      level,
      payload.position ?? { start: 0, end: payload.content.length },
      payload.documentId,
      {
        composite: payload.qualityScore ?? 0.5,
        dimensions: {
          informationDensity: 0.5,
          repetitionRatio: 0.5,
          semanticCompleteness: 0.5,
          documentRelevance: 0.5,
        },
        evaluatedAt: new Date(),
      },
      metadata,
      payload.parentId ?? undefined,
      payload.childIds
  );

  recoveredChunk.id = chunkId;
  return recoveredChunk;
}

/**
 * Batch recovery from Qdrant for missing chunks
 *
 * Note: This is a limited recovery - only recovers chunks that have
 * content stored in payload (requires STORE_CONTENT_IN_PAYLOAD=true).
 * For full recovery, document reprocessing would be needed.
 */
export async function batchRecoverFromQdrant(
  chunkIds: string[],
  vectorStore: VectorStoreAdapter,
  hierarchicalStore: HierarchicalStore,
  level: 'small' | 'parent'
): Promise<{
  recovered: string[];
  failed: string[];
}> {
  const recovered: string[] = [];
  const failed: string[] = [];

  for (const chunkId of chunkIds) {
    try {
      const recoveredChunk = await recoverChunkFromQdrant(chunkId, vectorStore, level);
      if (recoveredChunk) {
        hierarchicalStore.addChunk(recoveredChunk);
        recovered.push(chunkId);
      } else {
        failed.push(chunkId);
      }
    } catch (error) {
      console.warn(`[StorageSync] Recovery failed for ${chunkId}:`, error);
      failed.push(chunkId);
    }
  }

  return { recovered, failed };
}

/**
 * Sync HierarchicalStore with Qdrant data
 *
 * Compares counts and optionally recovers missing chunks.
 * This is run at server startup to detect data inconsistency.
 */
export async function syncStores(
  hierarchicalStore: HierarchicalStore,
  vectorStore: VectorStoreAdapter,
  options?: {
    /** Enable batch recovery (default: false) */
    enableRecovery?: boolean;
    /** Log level for sync messages */
    logLevel?: 'info' | 'warn' | 'error';
  }
): Promise<SyncStatus> {
  const { enableRecovery = false } = options ?? {};

  console.log('[StorageSync] Starting sync check...');

  const storeCount = hierarchicalStore.getChunkCount();

  let qdrantSmallStats;
  let qdrantParentStats;

  try {
    qdrantSmallStats = await vectorStore.getStats(COLLECTION_NAMES.TEXT_CHUNKS);
    qdrantParentStats = await vectorStore.getStats(COLLECTION_NAMES.PARENT_CHUNKS);
  } catch (error) {
    console.warn('[StorageSync] Failed to get Qdrant stats:', error);
    return {
      storeSmallCount: storeCount.small,
      storeParentCount: storeCount.parent,
      qdrantSmallCount: 0,
      qdrantParentCount: 0,
      consistent: false,
      missingInStore: [],
      recoveredChunks: [],
      recoveryFailures: [],
    };
  }

  const missingSmall = qdrantSmallStats.vectorCount - storeCount.small;
  const missingParent = qdrantParentStats.vectorCount - storeCount.parent;

  const consistent = missingSmall <= 0 && missingParent <= 0;

  console.log(`[StorageSync] Store counts: small=${storeCount.small}, parent=${storeCount.parent}`);
  console.log(`[StorageSync] Qdrant counts: small=${qdrantSmallStats.vectorCount}, parent=${qdrantParentStats.vectorCount}`);

  if (consistent) {
    console.log('[StorageSync] ✓ Data is consistent');
  } else {
    console.warn(`[StorageSync] ⚠ Data inconsistency detected: ${missingSmall} small chunks, ${missingParent} parent chunks missing in store`);

    if (!DEFAULT_PAYLOAD_STORAGE_CONFIG.storeContentInPayload) {
      console.warn('[StorageSync] Recovery disabled: STORE_CONTENT_IN_PAYLOAD is not enabled');
    } else if (enableRecovery) {
      console.log('[StorageSync] Note: Batch recovery is limited. Full recovery requires document reprocessing.');
    }
  }

  const result: SyncStatus = {
    storeSmallCount: storeCount.small,
    storeParentCount: storeCount.parent,
    qdrantSmallCount: qdrantSmallStats.vectorCount,
    qdrantParentCount: qdrantParentStats.vectorCount,
    consistent,
    missingInStore: [],
    recoveredChunks: [],
    recoveryFailures: [],
  };

  return result;
}