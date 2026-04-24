/**
 * EvaluationAutoscaler - 评估 Worker 自动扩缩容
 *
 * 根据队列负载自动调整 evaluation-worker replicas
 */

import type { TraceStorage } from '../tracing/TraceStorage.js';
import type { QueueStats } from '../monitor/types.js';
import type { ScaleEvent } from '../alert/types.js';
import type { AutoscalerConfig, ScaleDecision, ScaleState } from './types.js';
import { DEFAULT_AUTOSCALER_CONFIG } from './types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Queue interface for getting stats
 */
interface Queue {
  getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }>;
}

/**
 * Docker interface for scaling
 */
interface DockerAdapter {
  getCurrentReplicas(serviceName: string): Promise<number>;
  scaleTo(serviceName: string, targetReplicas: number): Promise<{ success: boolean; error?: string }>;
}

/**
 * EvaluationAutoscaler - 自动扩缩容器
 *
 * 任务 7.1.2: 实现 src/scaler/EvaluationAutoscaler.ts
 */
export class EvaluationAutoscaler {
  private queue: Queue;
  private storage: TraceStorage;
  private config: AutoscalerConfig;
  private dockerAdapter: DockerAdapter;
  private state: ScaleState;
  private intervalHandle?: ReturnType<typeof setInterval> | undefined;
  private broadcastFn?: (event: { type: string; data: unknown }) => void;

  constructor(
    queue: Queue,
    storage: TraceStorage,
    dockerAdapter: DockerAdapter,
    options?: Partial<AutoscalerConfig>
  ) {
    this.queue = queue;
    this.storage = storage;
    this.dockerAdapter = dockerAdapter;
    this.config = { ...DEFAULT_AUTOSCALER_CONFIG, ...options };

    this.state = {
      enabled: true,
      currentReplicas: this.config.minReplicas,
      lastScaleTime: 0,
      lastScaleAction: null,
    };
  }

  /**
   * 启动扩缩容循环
   *
   * 任务 7.1.3: 实现 start() 方法启动扩缩容循环
   */
  async start(): Promise<void> {
    if (this.intervalHandle) {
      console.warn('[EvaluationAutoscaler] Already running');
      return;
    }

    // Initialize current replicas from Docker
    try {
      const current = await this.dockerAdapter.getCurrentReplicas(this.config.serviceName);
      this.state.currentReplicas = current;
    } catch (error) {
      console.warn('[EvaluationAutoscaler] Failed to get current replicas:', error);
    }

    this.intervalHandle = setInterval(async () => {
      if (!this.state.enabled) return;

      try {
        await this.checkAndScale();
      } catch (error) {
        console.error('[EvaluationAutoscaler] Check and scale failed:', error);
      }
    }, this.config.checkInterval);

    console.log(`[EvaluationAutoscaler] Started with interval ${this.config.checkInterval}ms`);
  }

  /**
   * 停止扩缩容
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
      console.log('[EvaluationAutoscaler] Stopped');
    }
  }

  /**
   * 执行检查和扩缩容
   *
   * 任务 7.1.4: 实现 checkAndScale() 方法
   */
  async checkAndScale(): Promise<void> {
    const stats = await this.getQueueStats();
    const decision = this.makeScaleDecision(stats);

    if (decision.action === 'none') {
      return;
    }

    // Check cooldown period
    if (!this.checkCooldown()) {
      console.log(`[EvaluationAutoscaler] In cooldown period, skipping ${decision.action}`);
      return;
    }

    // Execute scale operation
    await this.executeScale(decision);
  }

  /**
   * 获取队列统计
   */
  async getQueueStats(): Promise<QueueStats> {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
      paused: counts.paused,
    };
  }

  /**
   * 制定扩缩容决策
   *
   * 任务 7.2.1-7.2.5: 扩缩容决策逻辑
   */
  private makeScaleDecision(stats: QueueStats): ScaleDecision {
    const { waiting, active } = stats;
    const current = this.state.currentReplicas;

    // 任务 7.2.1: 扩容阈值判断
    if (waiting >= this.config.scaleUpThreshold) {
      // 任务 7.2.2: 扩容计算 (ceil(waiting / 20))
      const targetReplicas = Math.min(
        this.config.maxReplicas,
        Math.ceil(waiting / 20)
      );

      if (targetReplicas > current) {
        return {
          action: 'scale_up',
          targetReplicas,
          reason: `队列积压 ${waiting} 任务，需要扩容至 ${targetReplicas} replicas`,
          metrics: { waiting, active, currentReplicas: current },
        };
      }
    }

    // 任务 7.2.3: 缩容阈值判断
    if (waiting < this.config.scaleDownThreshold && active < 2) {
      // 任务 7.2.5: min replicas 限制
      const targetReplicas = this.config.minReplicas;

      if (targetReplicas < current) {
        return {
          action: 'scale_down',
          targetReplicas,
          reason: `队列空闲 (waiting=${waiting}, active=${active})，缩容至 ${targetReplicas} replicas`,
          metrics: { waiting, active, currentReplicas: current },
        };
      }
    }

    return {
      action: 'none',
      targetReplicas: current,
      reason: '无扩缩容需求',
      metrics: { waiting, active, currentReplicas: current },
    };
  }

  /**
   * 检查冷却期
   *
   * 任务 7.2.4: 实现冷却期检查
   */
  private checkCooldown(): boolean {
    const now = Date.now();
    const elapsed = now - this.state.lastScaleTime;

    return elapsed >= this.config.cooldownPeriod;
  }

  /**
   * 执行扩缩容
   *
   * 任务 7.1.5-7.1.6: scaleUp/scaleDown 逻辑
   */
  private async executeScale(decision: ScaleDecision): Promise<void> {
    const eventId = uuidv4();
    const timestamp = new Date().toISOString();

    console.log(`[EvaluationAutoscaler] Executing ${decision.action}: ${this.state.currentReplicas} → ${decision.targetReplicas}`);

    try {
      // 任务 7.3.1: 调用 Docker Compose
      const result = await this.dockerAdapter.scaleTo(
        this.config.serviceName,
        decision.targetReplicas
      );

      // 任务 7.4.1: 记录扩缩容事件
      const event: ScaleEvent = {
        eventId,
        timestamp,
        type: decision.action === 'scale_up' ? 'scale_up' : 'scale_down',
        fromReplicas: this.state.currentReplicas,
        toReplicas: decision.targetReplicas,
        reason: decision.reason,
        triggeredBy: 'autoscaler',
        success: result.success,
        ...(result.error && { error: result.error }),
      };

      await this.storage.saveScaleEvent(event);

      if (result.success) {
        this.state.currentReplicas = decision.targetReplicas;
        this.state.lastScaleTime = Date.now();
        // Only set lastScaleAction for actual scale operations (not 'none')
        if (decision.action !== 'none') {
          this.state.lastScaleAction = decision.action;
        }

        // Broadcast status update
        if (this.broadcastFn) {
          this.broadcastFn({
            type: 'scaler:status',
            data: {
              action: decision.action,
              fromReplicas: event.fromReplicas,
              toReplicas: event.toReplicas,
              reason: decision.reason,
            },
          });
        }

        console.log(`[EvaluationAutoscaler] Scale successful: ${decision.targetReplicas} replicas`);
      } else {
        console.error(`[EvaluationAutoscaler] Scale failed:`, result.error);
      }
    } catch (error) {
      // 任务 7.3.4: 处理 Docker 命令失败
      console.error(`[EvaluationAutoscaler] Docker operation failed:`, error);

      // Record failed event
      const event: ScaleEvent = {
        eventId,
        timestamp,
        type: 'failed',
        fromReplicas: this.state.currentReplicas,
        toReplicas: decision.targetReplicas,
        reason: decision.reason,
        triggeredBy: 'autoscaler',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      await this.storage.saveScaleEvent(event);
    }
  }

  /**
   * 手动扩缩容
   *
   * 任务 7.3.1: 实现 scaleTo() 方法调用 Docker Compose
   */
  async scaleTo(targetReplicas: number): Promise<{ success: boolean; error?: string }> {
    // 任务 7.2.5: min/max replicas 限制
    if (targetReplicas < this.config.minReplicas || targetReplicas > this.config.maxReplicas) {
      return {
        success: false,
        error: `Target replicas must be between ${this.config.minReplicas} and ${this.config.maxReplicas}`,
      };
    }

    const decision: ScaleDecision = {
      action: 'manual_scale',
      targetReplicas,
      reason: '手动扩缩容',
      metrics: { waiting: 0, active: 0, currentReplicas: this.state.currentReplicas },
    };

    await this.executeScale(decision);

    return { success: true };
  }

  /**
   * 获取当前 replicas 数量
   *
   * 任务 7.3.2: 实现 getCurrentReplicas() 查询当前数量
   */
  async getCurrentReplicas(): Promise<number> {
    try {
      const current = await this.dockerAdapter.getCurrentReplicas(this.config.serviceName);
      this.state.currentReplicas = current;
      return current;
    } catch (error) {
      console.warn('[EvaluationAutoscaler] Failed to get current replicas:', error);
      return this.state.currentReplicas;
    }
  }

  /**
   * 启用自动扩缩容
   */
  enable(): void {
    this.state.enabled = true;
    console.log('[EvaluationAutoscaler] Enabled');
  }

  /**
   * 禁用自动扩缩容
   */
  disable(): void {
    this.state.enabled = false;
    console.log('[EvaluationAutoscaler] Disabled');
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.state.enabled;
  }

  /**
   * 获取配置
   */
  getConfig(): AutoscalerConfig {
    return { ...this.config };
  }

  /**
   * 获取状态
   */
  getState(): ScaleState {
    return { ...this.state };
  }

  /**
   * 设置广播函数
   */
  setBroadcast(fn: (event: { type: string; data: unknown }) => void): void {
    this.broadcastFn = fn;
  }
}

/**
 * Mock Docker Adapter for testing
 */
export class MockDockerAdapter implements DockerAdapter {
  private currentReplicas: number = 2;

  async getCurrentReplicas(serviceName: string): Promise<number> {
    return this.currentReplicas;
  }

  async scaleTo(serviceName: string, targetReplicas: number): Promise<{ success: boolean; error?: string }> {
    this.currentReplicas = targetReplicas;
    return { success: true };
  }
}

/**
 * 创建 EvaluationAutoscaler
 */
export function createEvaluationAutoscaler(
  queue: Queue,
  storage: TraceStorage,
  dockerAdapter?: DockerAdapter,
  options?: Partial<AutoscalerConfig>
): EvaluationAutoscaler {
  const adapter = dockerAdapter ?? new MockDockerAdapter();
  return new EvaluationAutoscaler(queue, storage, adapter, options);
}