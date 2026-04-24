/**
 * Scaler Routes - 扩缩容 API 端点
 *
 * 提供扩缩容状态查询、手动触发、启用/禁用等 REST API
 */

import express from 'express';
import type { TraceStorage } from '../../tracing/TraceStorage.js';

export interface ScalerStatus {
  enabled: boolean;
  currentReplicas: number;
  minReplicas: number;
  maxReplicas: number;
  lastScaleEvent?: {
    timestamp: string;
    type: string;
    fromReplicas: number;
    toReplicas: number;
  };
}

export function createScalerRoutes(
  storage: TraceStorage,
  getScalerStatus: () => ScalerStatus,
  manualScale: (target: number) => Promise<{ success: boolean; error?: string }>,
  enableScaler: () => void,
  disableScaler: () => void,
): express.Router {
  const router = express.Router();

  /**
   * GET /api/scaler/status - 获取扩缩容状态
   */
  router.get('/status', (req, res) => {
    const status = getScalerStatus();
    res.json(status);
  });

  /**
   * GET /api/scaler/config - 获取扩缩容配置
   */
  router.get('/config', (req, res) => {
    res.json({
      minReplicas: 1,
      maxReplicas: 10,
      scaleUpThreshold: 50,
      scaleDownThreshold: 5,
      cooldownPeriod: 300000,
      checkInterval: 60000,
    });
  });

  /**
   * POST /api/scaler/scale - 手动扩缩容
   */
  router.post('/scale', async (req, res) => {
    const { targetReplicas } = req.body;

    if (!targetReplicas || typeof targetReplicas !== 'number') {
      res.status(400).json({ error: 'targetReplicas (number) is required' });
      return;
    }

    if (targetReplicas < 1 || targetReplicas > 10) {
      res.status(400).json({
        error: 'targetReplicas must be between 1 and 10'
      });
      return;
    }

    const result = await manualScale(targetReplicas);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      currentReplicas: targetReplicas,
    });
  });

  /**
   * POST /api/scaler/disable - 禁用自动扩缩容
   */
  router.post('/disable', (req, res) => {
    disableScaler();
    res.json({ enabled: false });
  });

  /**
   * POST /api/scaler/enable - 启用自动扩缩容
   */
  router.post('/enable', (req, res) => {
    enableScaler();
    res.json({ enabled: true });
  });

  /**
   * GET /api/scaler/history - 获取扩缩容历史
   */
  router.get('/history', (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const events = storage.getScaleEvents(limit);

    res.json({
      events,
      total: events.length,
    });
  });

  return router;
}