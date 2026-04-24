/**
 * Alert Routes - 告警 API 端点
 *
 * 提供告警查询、确认、解决等 REST API
 */

import express from 'express';
import type { TraceStorage } from '../../tracing/TraceStorage.js';
import type { AlertEvent, AlertStatus } from '../../alert/types.js';

export function createAlertRoutes(storage: TraceStorage): express.Router {
  const router = express.Router();

  /**
   * GET /api/alerts - 查询告警列表
   */
  router.get('/', (req, res) => {
    const status = req.query.status as AlertStatus | undefined;
    const type = req.query.type as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const options: { status?: AlertStatus; type?: string; limit?: number; offset?: number } = { limit, offset };
    if (status !== undefined) options.status = status;
    if (type !== undefined) options.type = type;

    const alerts = storage.getAlerts(options);

    res.json({
      alerts,
      total: alerts.length,
      limit,
      offset,
    });
  });

  /**
   * GET /api/alerts/:id - 查询单个告警详情
   */
  router.get('/:id', (req, res) => {
    const alertId = req.params.id;
    const alert = storage.getAlert(alertId);

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    res.json(alert);
  });

  /**
   * POST /api/alerts/:id/acknowledge - 确认告警
   */
  router.post('/:id/acknowledge', async (req, res) => {
    const alertId = req.params.id;
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const alert = storage.getAlert(alertId);
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    await storage.acknowledgeAlert(alertId, userId);

    const updatedAlert = storage.getAlert(alertId);
    res.json(updatedAlert);
  });

  /**
   * POST /api/alerts/:id/resolve - 解决告警
   */
  router.post('/:id/resolve', async (req, res) => {
    const alertId = req.params.id;

    const alert = storage.getAlert(alertId);
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    await storage.resolveAlert(alertId);

    const updatedAlert = storage.getAlert(alertId);
    res.json(updatedAlert);
  });

  return router;
}