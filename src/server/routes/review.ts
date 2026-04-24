/**
 * Review Routes - 人工审核 API 端点 (Fastify 版本)
 *
 * 提供审核项查询、分配、批准、拒绝等 REST API
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TraceStorage } from '../../tracing/TraceStorage.js';
import type { ReviewStatus, ReviewPriority, ReviewItem } from '../../feedback/types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create review routes as Fastify plugin
 *
 * Requires TraceStorage to be decorated on the Fastify instance
 */
export async function reviewRoutes(fastify: FastifyInstance): Promise<void> {
  // Get TraceStorage from decorated fastify instance
  const getStorage = (): TraceStorage | null => {
    return (fastify as unknown as { traceStorage?: TraceStorage }).traceStorage ?? null;
  };

  // Helper to find review item by ID
  const findReviewItem = (reviewId: string): ReviewItem | null => {
    const storage = getStorage();
    if (!storage) return null;
    const items = storage.getReviewItems({ limit: 10000 });
    return items.find(item => item.reviewId === reviewId) ?? null;
  };

  /**
   * GET /api/review/pending - 获取待审核列表
   *
   * 任务 3.3.1: 实现 GET /api/review/pending 端点
   */
  fastify.get('/pending', async (request: FastifyRequest, reply: FastifyReply) => {
    const storage = getStorage();
    if (!storage) {
      return reply.status(503).send({ error: 'TraceStorage not initialized' });
    }

    const query = request.query as {
      priority?: ReviewPriority;
      limit?: string;
      offset?: string;
    };

    const priority = query.priority;
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const options: { status?: ReviewStatus; priority?: string; limit?: number; offset?: number } = {
      status: 'pending',
      limit,
      offset
    };
    if (priority !== undefined) options.priority = priority;

    const items = storage.getReviewItems(options);

    return reply.status(200).send({
      items,
      total: items.length,
      limit,
      offset,
    });
  });

  /**
   * GET /api/review/count - 获取审核项计数
   *
   * 任务 3.3.2: 实现 GET /api/review/count 端点
   */
  fastify.get('/count', async (request: FastifyRequest, reply: FastifyReply) => {
    const storage = getStorage();
    if (!storage) {
      return reply.status(503).send({ error: 'TraceStorage not initialized' });
    }

    const query = request.query as { status?: ReviewStatus };
    const status = query.status;

    const count = storage.getReviewCount(status);

    return reply.status(200).send({ count });
  });

  /**
   * GET /api/review/:id - 获取审核项详情
   *
   * 任务 3.3.3: 实现 GET /api/review/:id 端点
   */
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const reviewId = params.id;

    const item = findReviewItem(reviewId);

    if (!item) {
      return reply.status(404).send({ error: 'Review item not found' });
    }

    return reply.status(200).send(item);
  });

  /**
   * POST /api/review - 手动创建审核项
   *
   * 任务 3.3.4: 实现 POST /api/review 端点（手动创建）
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const storage = getStorage();
    if (!storage) {
      return reply.status(503).send({ error: 'TraceStorage not initialized' });
    }

    const body = request.body as {
      traceId?: string;
      evaluationId?: string;
      alertId?: string;
      priority?: ReviewPriority;
      details?: Record<string, unknown>;
    };

    const { traceId, evaluationId, alertId, priority, details } = body;

    if (!traceId || !evaluationId || !details) {
      return reply.status(400).send({
        error: 'traceId, evaluationId, and details are required'
      });
    }

    const item: ReviewItem = {
      reviewId: uuidv4(),
      traceId,
      evaluationId,
      status: 'pending',
      priority: priority ?? 'medium',
      createdAt: new Date().toISOString(),
      details: details as unknown as ReviewItem['details'],
    };

    // Only add alertId if it's defined (exactOptionalPropertyTypes requires this)
    if (alertId) {
      (item as { alertId?: string }).alertId = alertId;
    }

    await storage.saveReviewItem(item);

    return reply.status(201).send(item);
  });

  /**
   * POST /api/review/:id/assign - 分配审核人员
   *
   * 任务 3.3.5: 实现 POST /api/review/:id/assign 端点
   */
  fastify.post('/:id/assign', async (request: FastifyRequest, reply: FastifyReply) => {
    const storage = getStorage();
    if (!storage) {
      return reply.status(503).send({ error: 'TraceStorage not initialized' });
    }

    const params = request.params as { id: string };
    const body = request.body as { assignedTo?: string };

    const reviewId = params.id;
    const assignedTo = body.assignedTo;

    if (!assignedTo) {
      return reply.status(400).send({ error: 'assignedTo is required' });
    }

    await storage.updateReviewItem(reviewId, {
      status: 'assigned',
      assignedTo,
    });

    const updatedItem = findReviewItem(reviewId);
    return reply.status(200).send(updatedItem);
  });

  /**
   * POST /api/review/:id/approve - 批准审核
   *
   * 任务 3.3.6: 实现 POST /api/review/:id/approve 端点
   */
  fastify.post('/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const storage = getStorage();
    if (!storage) {
      return reply.status(503).send({ error: 'TraceStorage not initialized' });
    }

    const params = request.params as { id: string };
    const body = request.body as { reviewNotes?: string };

    const reviewId = params.id;

    const updateData: { status: 'resolved'; result: 'approved'; resolvedAt: string; reviewNotes?: string } = {
      status: 'resolved',
      result: 'approved',
      resolvedAt: new Date().toISOString(),
    };

    if (body.reviewNotes) {
      updateData.reviewNotes = body.reviewNotes;
    }

    await storage.updateReviewItem(reviewId, updateData);

    const updatedItem = findReviewItem(reviewId);
    return reply.status(200).send(updatedItem);
  });

  /**
   * POST /api/review/:id/reject - 拒绝审核
   *
   * 任务 3.3.7: 实现 POST /api/review/:id/reject 端点
   */
  fastify.post('/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const storage = getStorage();
    if (!storage) {
      return reply.status(503).send({ error: 'TraceStorage not initialized' });
    }

    const params = request.params as { id: string };
    const body = request.body as { reviewNotes?: string };

    const reviewId = params.id;

    const updateData: { status: 'resolved'; result: 'rejected'; resolvedAt: string; reviewNotes?: string } = {
      status: 'resolved',
      result: 'rejected',
      resolvedAt: new Date().toISOString(),
    };

    if (body.reviewNotes) {
      updateData.reviewNotes = body.reviewNotes;
    }

    await storage.updateReviewItem(reviewId, updateData);

    const updatedItem = findReviewItem(reviewId);
    return reply.status(200).send(updatedItem);
  });

  /**
   * POST /api/review/:id/notes - 添加审核备注
   *
   * 任务 3.3.8: 实现 POST /api/review/:id/notes 端点
   */
  fastify.post('/:id/notes', async (request: FastifyRequest, reply: FastifyReply) => {
    const storage = getStorage();
    if (!storage) {
      return reply.status(503).send({ error: 'TraceStorage not initialized' });
    }

    const params = request.params as { id: string };
    const body = request.body as { reviewNotes?: string };

    const reviewId = params.id;
    const reviewNotes = body.reviewNotes;

    if (!reviewNotes) {
      return reply.status(400).send({ error: 'reviewNotes is required' });
    }

    await storage.updateReviewItem(reviewId, {
      status: 'reviewed',
      reviewedAt: new Date().toISOString(),
      reviewNotes,
    });

    const updatedItem = findReviewItem(reviewId);
    return reply.status(200).send(updatedItem);
  });
}