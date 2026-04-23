import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { StatsUpdateData } from '../types.js';
import { syncStores, type SyncStatus } from '../storage-sync.js';
import { COLLECTION_NAMES } from '../../retrieval/vector-store-adapter.js';

/**
 * Stats routes as Fastify plugin
 */
export async function statsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET / - Get global statistics
   */
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const statsService = fastify.statsService;
    const hierarchicalStore = fastify.hierarchicalStore;

    if (!hierarchicalStore) {
      return reply.status(503).send({ error: 'Document store not initialized' });
    }

    // Get stats from service (or compute directly if service not available)
    const stats: StatsUpdateData = statsService?.getStats() ?? {
      pipelineStats: {
        totalDocumentsProcessed: 0,
        averageProcessingTimeMs: 0,
        totalChunksCreated: 0,
        averageChunksPerDocument: 0,
      },
      retrievalStats: {
        totalQueries: 0,
        averageRetrievalTimeMs: 0,
        averageResultsPerQuery: 0,
        successRate: 1,
      },
      chunkStats: {
        totalSmallChunks: hierarchicalStore.getChunkCount().small,
        totalParentChunks: hierarchicalStore.getChunkCount().parent,
        averageQualityScore: 0,
        qualityDistribution: { high: 0, medium: 0, low: 0 },
      },
      stageTimeDistribution: {
        ingest: 0,
        parse: 0,
        embed: 0,
        index: 0,
      },
    };

    return reply.status(200).send(stats);
  });

  /**
   * GET /chunks - Get chunk statistics
   */
  fastify.get('/chunks', async (_request: FastifyRequest, reply: FastifyReply) => {
    const hierarchicalStore = fastify.hierarchicalStore;

    if (!hierarchicalStore) {
      return reply.status(503).send({ error: 'Document store not initialized' });
    }

    const chunkCount = hierarchicalStore.getChunkCount();
    const smallChunks = hierarchicalStore.getAllSmallChunks();

    // Calculate quality distribution
    const high = smallChunks.filter(c => c.qualityScore.composite >= 0.8).length;
    const medium = smallChunks.filter(c => c.qualityScore.composite >= 0.5 && c.qualityScore.composite < 0.8).length;
    const low = smallChunks.filter(c => c.qualityScore.composite < 0.5).length;

    // Calculate average quality
    const avgQuality = smallChunks.length > 0
      ? smallChunks.reduce((sum, c) => sum + c.qualityScore.composite, 0) / smallChunks.length
      : 0;

    // Calculate average token count
    const avgTokens = smallChunks.length > 0
      ? smallChunks.reduce((sum, c) => sum + Math.ceil(c.content.length / 4), 0) / smallChunks.length
      : 0;

    return reply.status(200).send({
      totalSmallChunks: chunkCount.small,
      totalParentChunks: chunkCount.parent,
      averageQualityScore: avgQuality,
      averageTokenCount: avgTokens,
      qualityDistribution: { high, medium, low },
    });
  });

  /**
   * GET /retrieval - Get retrieval statistics
   */
  fastify.get('/retrieval', async (_request: FastifyRequest, reply: FastifyReply) => {
    const statsService = fastify.statsService;

    if (!statsService) {
      return reply.status(200).send({
        totalQueries: 0,
        averageRetrievalTimeMs: 0,
        averageResultsPerQuery: 0,
        successRate: 1,
      });
    }

    const stats = statsService.getStats();
    return reply.status(200).send(stats.retrievalStats);
  });

  /**
   * GET /pipeline - Get pipeline statistics
   */
  fastify.get('/pipeline', async (_request: FastifyRequest, reply: FastifyReply) => {
    const statsService = fastify.statsService;

    if (!statsService) {
      return reply.status(200).send({
        totalDocumentsProcessed: 0,
        averageProcessingTimeMs: 0,
        totalChunksCreated: 0,
        averageChunksPerDocument: 0,
        stageTimeDistribution: { ingest: 0, parse: 0, embed: 0, index: 0 },
      });
    }

    const stats = statsService.getStats();
    return reply.status(200).send({
      ...stats.pipelineStats,
      stageTimeDistribution: stats.stageTimeDistribution,
    });
  });

  /**
   * POST /reset - Reset all statistics counters
   */
  fastify.post('/reset', async (_request: FastifyRequest, reply: FastifyReply) => {
    const statsService = fastify.statsService;

    if (!statsService) {
      return reply.status(503).send({ error: 'Stats service not initialized' });
    }

    statsService.reset();
    return reply.status(200).send({ success: true, message: 'Statistics reset' });
  });

  /**
   * GET /health/storage - Get storage health status
   * Returns chunk counts from HierarchicalStore and Qdrant, plus sync status
   */
  fastify.get('/health/storage', async (_request: FastifyRequest, reply: FastifyReply) => {
    const hierarchicalStore = fastify.hierarchicalStore;
    const vectorStoreAdapter = (fastify as any).vectorStoreAdapter;

    if (!hierarchicalStore) {
      return reply.status(503).send({ error: 'HierarchicalStore not initialized' });
    }

    const storeCount = hierarchicalStore.getChunkCount();

    // Build health response
    const healthResponse: StorageHealthResponse = {
      hierarchicalStore: {
        smallChunks: storeCount.small,
        parentChunks: storeCount.parent,
        persisted: true, // Persistence enabled in http-server.ts
      },
      qdrant: {
        textChunks: 0,
        parentChunks: 0,
        healthy: false,
      },
      syncStatus: {
        consistent: true,
        missingInStore: [],
        missingInQdrant: [],
      },
    };

    // Check Qdrant if available
    if (vectorStoreAdapter) {
      try {
        const smallStats = await vectorStoreAdapter.getStats(COLLECTION_NAMES.TEXT_CHUNKS);
        const parentStats = await vectorStoreAdapter.getStats(COLLECTION_NAMES.PARENT_CHUNKS);

        healthResponse.qdrant = {
          textChunks: smallStats.vectorCount,
          parentChunks: parentStats.vectorCount,
          healthy: smallStats.indexStatus === 'green' && parentStats.indexStatus === 'green',
        };

        // Check sync status
        const missingSmall = smallStats.vectorCount - storeCount.small;
        const missingParent = parentStats.vectorCount - storeCount.parent;

        healthResponse.syncStatus = {
          consistent: missingSmall <= 0 && missingParent <= 0,
          missingInStore: missingSmall > 0 ? [`~${missingSmall} small chunks`, `~${missingParent} parent chunks`] : [],
          missingInQdrant: [],
        };
      } catch (error) {
        healthResponse.qdrant.healthy = false;
        healthResponse.syncStatus.consistent = false;
      }
    } else {
      // No Qdrant - sync status is unknown
      healthResponse.syncStatus.consistent = false;
      healthResponse.qdrant.healthy = false;
    }

    return reply.status(200).send(healthResponse);
  });

  /**
   * POST /health/storage/sync - Trigger manual sync check
   * Runs syncStores() to compare and optionally recover data
   */
  fastify.post('/health/storage/sync', async (_request: FastifyRequest, reply: FastifyReply) => {
    const hierarchicalStore = fastify.hierarchicalStore;
    const vectorStoreAdapter = (fastify as any).vectorStoreAdapter;

    if (!hierarchicalStore) {
      return reply.status(503).send({ error: 'HierarchicalStore not initialized' });
    }

    if (!vectorStoreAdapter) {
      return reply.status(503).send({ error: 'VectorStore not initialized (Hybrid mode required)' });
    }

    try {
      const syncStatus = await syncStores(hierarchicalStore, vectorStoreAdapter);

      return reply.status(200).send({
        success: true,
        syncStatus,
        message: syncStatus.consistent
          ? 'Storage is consistent'
          : 'Storage inconsistency detected. Recovery mechanism will handle missing chunks during retrieval.',
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Sync check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

/**
 * Storage health response structure
 */
interface StorageHealthResponse {
  hierarchicalStore: {
    smallChunks: number;
    parentChunks: number;
    persisted: boolean;
  };
  qdrant: {
    textChunks: number;
    parentChunks: number;
    healthy: boolean;
  };
  syncStatus: {
    consistent: boolean;
    missingInStore: string[];
    missingInQdrant: string[];
  };
}