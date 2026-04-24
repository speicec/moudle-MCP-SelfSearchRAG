/**
 * Queue Routes - 队列健康 API 端点 (Fastify 版本)
 *
 * 提供队列状态、健康检查、指标等 REST API
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { QueueHealthMonitor } from '../../monitor/QueueHealthMonitor.js';
import type { QueueHealthReport, QueueStats, WorkerMetrics } from '../../monitor/types.js';

/**
 * Create queue routes as Fastify plugin
 *
 * Requires QueueHealthMonitor to be decorated on the Fastify instance
 */
export async function queueRoutes(fastify: FastifyInstance): Promise<void> {
  // Get QueueHealthMonitor from decorated fastify instance
  const getMonitor = (): QueueHealthMonitor | null => {
    return (fastify as unknown as { queueHealthMonitor?: QueueHealthMonitor }).queueHealthMonitor ?? null;
  };

  /**
   * GET /api/queue/health - 获取队列健康报告
   *
   * 任务 6.5.1: 实现 GET /api/queue/health 端点
   */
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    const monitor = getMonitor();
    if (!monitor) {
      return reply.status(503).send({ error: 'QueueHealthMonitor not initialized' });
    }

    try {
      const report = await monitor.checkHealth();
      return reply.status(200).send(report);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to check queue health',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/queue/stats - 获取队列统计数据
   *
   * 任务 6.5.2: 实现 GET /api/queue/stats 端点
   */
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const monitor = getMonitor();
    if (!monitor) {
      return reply.status(503).send({ error: 'QueueHealthMonitor not initialized' });
    }

    try {
      const stats = await monitor.getQueueStats();
      return reply.status(200).send(stats);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get queue stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/queue/metrics - 获取 Worker 指标
   *
   * 任务 6.5.3: 实现 GET /api/queue/metrics 端点
   */
  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const monitor = getMonitor();
    if (!monitor) {
      return reply.status(503).send({ error: 'QueueHealthMonitor not initialized' });
    }

    try {
      const stats = await monitor.getQueueStats();
      const metrics = monitor.calculateWorkerMetrics(stats);
      const trend = monitor.getTrendAnalysis();

      return reply.status(200).send({
        ...metrics,
        trend,
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get queue metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/queue/history - 获取统计历史
   */
  fastify.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const monitor = getMonitor();
    if (!monitor) {
      return reply.status(503).send({ error: 'QueueHealthMonitor not initialized' });
    }

    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 60;

    const history = monitor.getStatsHistory().slice(-limit);

    return reply.status(200).send({
      history,
      total: history.length,
    });
  });
}