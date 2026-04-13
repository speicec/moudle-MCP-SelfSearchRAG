import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { StatsUpdateData } from '../types.js';

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
    const parentChunks = hierarchicalStore.getAllParentChunks();

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
}