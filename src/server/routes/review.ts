/**
 * Review Routes - 人工审核 API 端点
 *
 * 提供审核项查询、分配、批准、拒绝等 REST API
 */

import express from 'express';
import type { TraceStorage } from '../../tracing/TraceStorage.js';
import type { ReviewItem, ReviewStatus, ReviewPriority } from '../../alert/types.js';
import { v4 as uuidv4 } from 'uuid';

export function createReviewRoutes(storage: TraceStorage): express.Router {
  const router = express.Router();

  /**
   * GET /api/review/pending - 获取待审核列表
   */
  router.get('/pending', (req, res) => {
    const priority = req.query.priority as ReviewPriority | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const options: { status?: ReviewStatus; priority?: string; limit?: number; offset?: number } = { status: 'pending', limit, offset };
    if (priority !== undefined) options.priority = priority;

    const items = storage.getReviewItems(options);

    res.json({
      items,
      total: items.length,
      limit,
      offset,
    });
  });

  /**
   * GET /api/review/count - 获取审核项计数
   */
  router.get('/count', (req, res) => {
    const status = req.query.status as ReviewStatus | undefined;

    const count = storage.getReviewCount(status);

    res.json({ count });
  });

  /**
   * GET /api/review/:id - 获取审核项详情
   */
  router.get('/:id', (req, res) => {
    const reviewId = req.params.id;
    const items = storage.getReviewItems({ limit: 1000 });

    const item = items.find(i => i.reviewId === reviewId);

    if (!item) {
      res.status(404).json({ error: 'Review item not found' });
      return;
    }

    res.json(item);
  });

  /**
   * POST /api/review - 手动创建审核项
   */
  router.post('/', async (req, res) => {
    const { traceId, evaluationId, alertId, priority, details } = req.body;

    if (!traceId || !evaluationId || !details) {
      res.status(400).json({
        error: 'traceId, evaluationId, and details are required'
      });
      return;
    }

    const item: ReviewItem = {
      reviewId: uuidv4(),
      traceId,
      evaluationId,
      alertId,
      status: 'pending',
      priority: priority || 'medium',
      createdAt: new Date().toISOString(),
      details,
    };

    await storage.saveReviewItem(item);

    res.status(201).json(item);
  });

  /**
   * POST /api/review/:id/assign - 分配审核人员
   */
  router.post('/:id/assign', async (req, res) => {
    const reviewId = req.params.id;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      res.status(400).json({ error: 'assignedTo is required' });
      return;
    }

    await storage.updateReviewItem(reviewId, {
      status: 'assigned',
      assignedTo,
    });

    const items = storage.getReviewItems({ limit: 1000 });
    const updatedItem = items.find(i => i.reviewId === reviewId);

    res.json(updatedItem);
  });

  /**
   * POST /api/review/:id/approve - 批准审核
   */
  router.post('/:id/approve', async (req, res) => {
    const reviewId = req.params.id;
    const { reviewNotes } = req.body;

    await storage.updateReviewItem(reviewId, {
      status: 'resolved',
      result: 'approved',
      resolvedAt: new Date().toISOString(),
      reviewNotes,
    });

    const items = storage.getReviewItems({ limit: 1000 });
    const updatedItem = items.find(i => i.reviewId === reviewId);

    res.json(updatedItem);
  });

  /**
   * POST /api/review/:id/reject - 拒绝审核
   */
  router.post('/:id/reject', async (req, res) => {
    const reviewId = req.params.id;
    const { reviewNotes } = req.body;

    await storage.updateReviewItem(reviewId, {
      status: 'resolved',
      result: 'rejected',
      resolvedAt: new Date().toISOString(),
      reviewNotes,
    });

    const items = storage.getReviewItems({ limit: 1000 });
    const updatedItem = items.find(i => i.reviewId === reviewId);

    res.json(updatedItem);
  });

  /**
   * POST /api/review/:id/notes - 添加审核备注
   */
  router.post('/:id/notes', async (req, res) => {
    const reviewId = req.params.id;
    const { reviewNotes } = req.body;

    if (!reviewNotes) {
      res.status(400).json({ error: 'reviewNotes is required' });
      return;
    }

    await storage.updateReviewItem(reviewId, {
      status: 'reviewed',
      reviewedAt: new Date().toISOString(),
      reviewNotes,
    });

    const items = storage.getReviewItems({ limit: 1000 });
    const updatedItem = items.find(i => i.reviewId === reviewId);

    res.json(updatedItem);
  });

  return router;
}