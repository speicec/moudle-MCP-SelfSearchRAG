/**
 * SessionConfigStore - 会话配置存储
 *
 * 存储 Adjustment 信号，支持 Redis 或内存存储
 */

import type { Adjustment, SessionConfig } from './types.js';

/**
 * SessionConfigStoreStrategy - 存储策略
 */
export type SessionConfigStoreStrategy = 'redis' | 'memory';

/**
 * SessionConfigStore - 会话配置存储
 *
 * 任务 8.5.1: 实现 SessionConfigStore 类（Redis 或内存）
 */
export class SessionConfigStore {
  private strategy: SessionConfigStoreStrategy;
  private store: Map<string, SessionConfig> = new Map();
  private cleanupInterval?: ReturnType<typeof setInterval> | undefined;
  private ttl: number = 3600000; // 1 hour default TTL

  constructor(options?: {
    strategy?: SessionConfigStoreStrategy;
    ttl?: number;
  }) {
    this.strategy = options?.strategy ?? 'memory';
    this.ttl = options?.ttl ?? 3600000;

    // 任务 8.5.4: 实现过期清理逻辑
    this.startCleanupTimer();
  }

  /**
   * 存储 Adjustment
   *
   * 任务 8.5.2: 实现 storeAdjustment() 方法
   */
  storeAdjustment(sessionId: string, adjustment: Adjustment): void {
    const config = this.store.get(sessionId);

    if (config) {
      // Add adjustment to existing config
      config.adjustments.push(adjustment);
      config.updatedAt = Date.now();
    } else {
      // Create new config
      const newConfig: SessionConfig = {
        sessionId,
        adjustments: [adjustment],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.store.set(sessionId, newConfig);
    }
  }

  /**
   * 批量存储 Adjustments
   */
  storeAdjustments(sessionId: string, adjustments: Adjustment[]): void {
    for (const adjustment of adjustments) {
      this.storeAdjustment(sessionId, adjustment);
    }
  }

  /**
   * 获取 Adjustments
   *
   * 任务 8.5.3: 实现 getAdjustments() 方法
   */
  getAdjustments(sessionId: string): Adjustment[] {
    const config = this.store.get(sessionId);

    if (!config) {
      return [];
    }

    // Filter out expired adjustments
    const now = Date.now();
    const validAdjustments = config.adjustments.filter(
      adj => adj.expiresAt > now
    );

    // Update config with filtered adjustments
    if (validAdjustments.length !== config.adjustments.length) {
      config.adjustments = validAdjustments;
      config.updatedAt = now;
    }

    return validAdjustments;
  }

  /**
   * 获取完整会话配置
   */
  getSessionConfig(sessionId: string): SessionConfig | null {
    const config = this.store.get(sessionId);

    if (!config) {
      return null;
    }

    // Filter expired adjustments
    const now = Date.now();
    const validAdjustments = config.adjustments.filter(
      adj => adj.expiresAt > now
    );

    if (validAdjustments.length === 0) {
      // All adjustments expired, remove config
      this.store.delete(sessionId);
      return null;
    }

    return {
      ...config,
      adjustments: validAdjustments,
    };
  }

  /**
   * 清除会话配置
   */
  clearSession(sessionId: string): void {
    this.store.delete(sessionId);
  }

  /**
   * 获取特定目标的 Adjustments
   */
  getAdjustmentsByTarget(sessionId: string, target: Adjustment['target']): Adjustment[] {
    const adjustments = this.getAdjustments(sessionId);
    return adjustments.filter(adj => adj.target === target);
  }

  /**
   * 应用 Adjustments 到配置
   */
  applyAdjustments(sessionId: string, baseConfig: Record<string, unknown>): Record<string, unknown> {
    const adjustments = this.getAdjustments(sessionId);

    if (adjustments.length === 0) {
      return baseConfig;
    }

    const mergedConfig = { ...baseConfig };

    for (const adjustment of adjustments) {
      // Merge adjustment changes into config
      for (const [key, value] of Object.entries(adjustment.change)) {
        mergedConfig[key] = value;
      }
    }

    return mergedConfig;
  }

  /**
   * 启动过期清理定时器
   *
   * 任务 8.5.4: 实现过期清理逻辑
   */
  private startCleanupTimer(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 300000);
  }

  /**
   * 清理过期配置
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, config] of this.store) {
      // Check if session itself is too old
      if (now - config.createdAt > this.ttl) {
        expiredSessions.push(sessionId);
        continue;
      }

      // Filter expired adjustments
      const validAdjustments = config.adjustments.filter(
        adj => adj.expiresAt > now
      );

      if (validAdjustments.length === 0) {
        expiredSessions.push(sessionId);
      } else if (validAdjustments.length !== config.adjustments.length) {
        config.adjustments = validAdjustments;
        config.updatedAt = now;
      }
    }

    // Remove expired sessions
    for (const sessionId of expiredSessions) {
      this.store.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      console.log(`[SessionConfigStore] Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * 停止清理定时器
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * 获取存储统计
   */
  getStats(): {
    totalSessions: number;
    totalAdjustments: number;
    strategy: SessionConfigStoreStrategy;
  } {
    let totalAdjustments = 0;
    for (const config of this.store.values()) {
      totalAdjustments += config.adjustments.length;
    }

    return {
      totalSessions: this.store.size,
      totalAdjustments,
      strategy: this.strategy,
    };
  }
}

/**
 * 创建 SessionConfigStore
 */
export function createSessionConfigStore(options?: {
  strategy?: SessionConfigStoreStrategy;
  ttl?: number;
}): SessionConfigStore {
  return new SessionConfigStore(options);
}