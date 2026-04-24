/**
 * Alert Routes - 告警 API 端点 (Fastify 版本)
 *
 * 提供告警查询、确认、解决等 REST API
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TraceStorage } from '../../tracing/TraceStorage.js';
import type { AlertStatus } from '../../alert/types.js';

/**
 * Create alert routes as Fastify plugin
 *
 * Requires TraceStorage to be decorated on the Fastify instance
 */
export async function alertRoutes(fastify: FastifyInstance): Promise<void> {
  // Get TraceStorage from decorated fastify instance
  // Note: TraceStorage needs to be added during server initialization
  const getStorage = (): TraceStorage | null => {
    return (fastify as unknown as { traceStorage?: TraceStorage }).traceStorage ?? null;
  };

  /**
   * GET /api/alerts - 查询告警列表
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const storage = getStorage();
    if (!storage) {
      return reply.status(503).send({ error: 'TraceStorage not initialized' });
    }

    const query = request.query as {
      status?: AlertStatus;
      type?: string;
      limit?: string;
      offset?: string;
    };

    const status = query.status;
    const type = query.type;
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const options: { status?: AlertStatus; type?: string; limit?: number; offset?: number } = { limit, offset };
    if (status !== undefined) options.status = status;
    if (type !== undefined) options.type = type;

    const alerts = storage.getAlerts(options);

    return reply.status(200).send({
      alerts,
      total: alerts.length,
      limit,
      offset,
    });
  });

  /**
   * GET /api/alerts/:id - 查询单个告警详情
   */
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const storage = getStorage();
    if (!storage) {
      return reply.status(503).send({ error: 'TraceStorage not initialized' });
    }

    const params = request.params as { id: string };
    const alertId = params.id;
    const alert = storage.getAlert(alertId);

    if (!alert) {
      return reply.status(404).send({ error: 'Alert not found' });
    }

    return reply.status(200).send(alert);
  });

  /**
   * POST /api/alerts/:id/acknowledge - 确认告警
   */
  fastify.post('/:id/acknowledge', async (request: FastifyRequest, reply: FastifyReply) => {
    const storage = getStorage();
    if (!storage) {
      return reply.status(503).send({ error: 'TraceStorage not initialized' });
    }

    const params = request.params as { id: string };
    const body = request.body as { userId?: string };

    const alertId = params.id;
    const userId = body.userId;

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    const alert = storage.getAlert(alertId);
    if (!alert) {
      return reply.status(404).send({ error: 'Alert not found' });
    }

    await storage.acknowledgeAlert(alertId, userId);

    const updatedAlert = storage.getAlert(alertId);
    return reply.status(200).send(updatedAlert);
  });

  /**
   * POST /api/alerts/:id/resolve - 解决告警
   */
  fastify.post('/:id/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    const storage = getStorage();
    if (!storage) {
      return reply.status(503).send({ error: 'TraceStorage not initialized' });
    }

    const params = request.params as { id: string };
    const alertId = params.id;

    const alert = storage.getAlert(alertId);
    if (!alert) {
      return reply.status(404).send({ error: 'Alert not found' });
    }

    await storage.resolveAlert(alertId);

    const updatedAlert = storage.getAlert(alertId);
    return reply.status(200).send(updatedAlert);
  });
}