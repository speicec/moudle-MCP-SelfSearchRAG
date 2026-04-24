/**
 * Scaler Routes - 扩缩容 API 端点 (Fastify 版本)
 *
 * 提供扩缩容状态查询、手动触发、启用/禁用等 REST API
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TraceStorage } from '../../tracing/TraceStorage.js';

/**
 * ScalerStatus - 扩缩容状态
 */
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

/**
 * ScalerConfig - 扩缩容配置
 */
export interface ScalerConfig {
  minReplicas: number;
  maxReplicas: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number;
  checkInterval: number;
}

/**
 * Scaler interface - 扩缩容器接口
 */
interface Scaler {
  isEnabled(): boolean;
  getCurrentReplicas(): number;
  getConfig(): ScalerConfig;
  scaleTo(target: number): Promise<{ success: boolean; error?: string }>;
  enable(): void;
  disable(): void;
}

/**
 * Create scaler routes as Fastify plugin
 *
 * 任务 7.5.1-7.5.7: 扩缩容 REST API
 */
export async function scalerRoutes(fastify: FastifyInstance): Promise<void> {
  // Get TraceStorage and Scaler from decorated fastify instance
  const getStorage = (): TraceStorage | null => {
    return (fastify as unknown as { traceStorage?: TraceStorage }).traceStorage ?? null;
  };

  const getScaler = (): Scaler | null => {
    return (fastify as unknown as { evaluationAutoscaler?: Scaler }).evaluationAutoscaler ?? null;
  };

  // Default config when scaler is not available
  const DEFAULT_CONFIG: ScalerConfig = {
    minReplicas: 1,
    maxReplicas: 10,
    scaleUpThreshold: 50,
    scaleDownThreshold: 5,
    cooldownPeriod: 300000,
    checkInterval: 60000,
  };

  /**
   * GET /api/scaler/status - 获取扩缩容状态
   *
   * 任务 7.5.1: 实现 GET /api/scaler/status 端点
   */
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const scaler = getScaler();
    const storage = getStorage();

    if (!scaler) {
      // Return default status when scaler not initialized
      return reply.status(200).send({
        enabled: false,
        currentReplicas: 2,
        minReplicas: DEFAULT_CONFIG.minReplicas,
        maxReplicas: DEFAULT_CONFIG.maxReplicas,
      });
    }

    const config = scaler.getConfig();
    const events = storage ? storage.getScaleEvents(1) : [];
    const lastEvent = events[0];

    const status: ScalerStatus = {
      enabled: scaler.isEnabled(),
      currentReplicas: scaler.getCurrentReplicas(),
      minReplicas: config.minReplicas,
      maxReplicas: config.maxReplicas,
      ...(lastEvent && {
        lastScaleEvent: {
          timestamp: lastEvent.timestamp,
          type: lastEvent.type,
          fromReplicas: lastEvent.fromReplicas,
          toReplicas: lastEvent.toReplicas,
        },
      }),
    };

    return reply.status(200).send(status);
  });

  /**
   * GET /api/scaler/config - 获取扩缩容配置
   *
   * 任务 7.5.2: 实现 GET /api/scaler/config 端点
   */
  fastify.get('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    const scaler = getScaler();

    if (!scaler) {
      return reply.status(200).send(DEFAULT_CONFIG);
    }

    return reply.status(200).send(scaler.getConfig());
  });

  /**
   * POST /api/scaler/scale - 手动扩缩容
   *
   * 任务 7.5.3: 实现 POST /api/scaler/scale 端点（手动）
   */
  fastify.post('/scale', async (request: FastifyRequest, reply: FastifyReply) => {
    const scaler = getScaler();

    if (!scaler) {
      return reply.status(503).send({ error: 'Autoscaler not initialized' });
    }

    const body = request.body as { targetReplicas?: number };
    const targetReplicas = body.targetReplicas;

    if (!targetReplicas || typeof targetReplicas !== 'number') {
      return reply.status(400).send({ error: 'targetReplicas (number) is required' });
    }

    const config = scaler.getConfig();
    if (targetReplicas < config.minReplicas || targetReplicas > config.maxReplicas) {
      return reply.status(400).send({
        error: `targetReplicas must be between ${config.minReplicas} and ${config.maxReplicas}`,
      });
    }

    const result = await scaler.scaleTo(targetReplicas);

    if (!result.success) {
      return reply.status(500).send({ error: result.error ?? 'Scale operation failed' });
    }

    return reply.status(200).send({
      success: true,
      currentReplicas: targetReplicas,
    });
  });

  /**
   * POST /api/scaler/disable - 禁用自动扩缩容
   *
   * 任务 7.5.4: 实现 POST /api/scaler/disable 端点
   */
  fastify.post('/disable', async (request: FastifyRequest, reply: FastifyReply) => {
    const scaler = getScaler();

    if (!scaler) {
      return reply.status(503).send({ error: 'Autoscaler not initialized' });
    }

    scaler.disable();

    return reply.status(200).send({ enabled: false });
  });

  /**
   * POST /api/scaler/enable - 启用自动扩缩容
   *
   * 任务 7.5.5: 实现 POST /api/scaler/enable 端点
   */
  fastify.post('/enable', async (request: FastifyRequest, reply: FastifyReply) => {
    const scaler = getScaler();

    if (!scaler) {
      return reply.status(503).send({ error: 'Autoscaler not initialized' });
    }

    scaler.enable();

    return reply.status(200).send({ enabled: true });
  });

  /**
   * GET /api/scaler/history - 获取扩缩容历史
   *
   * 任务 7.5.6: 实现 GET /api/scaler/history 端点
   */
  fastify.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const storage = getStorage();

    if (!storage) {
      return reply.status(503).send({ error: 'TraceStorage not initialized' });
    }

    const query = request.query as { limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;

    const events = storage.getScaleEvents(limit);

    return reply.status(200).send({
      events,
      total: events.length,
    });
  });
}