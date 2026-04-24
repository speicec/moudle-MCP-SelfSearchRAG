/**
 * HumanReviewQueue - 人工审核队列
 *
 * 管理需要人工审核的评估结果，支持分配、批准、拒绝流程
 */

import type { TraceStorage } from '../tracing/TraceStorage.js';
import type { AlertEvent } from '../alert/types.js';
import type {
  ReviewItem,
  ReviewItemInput,
  ReviewStatus,
  ReviewPriority,
  ReviewResult,
} from './types.js';
import {
  generateReviewId,
  createReviewDetailsFromAlert,
  determineReviewPriority,
} from './types.js';

/**
 * HumanReviewQueue - 人工审核队列管理器
 *
 * 功能：
 * - 从告警创建审核项
 * - 管理审核项状态流转
 * - 支持分配审核人员
 * - 支持批准/拒绝审核
 * - SLA 监控支持
 */
export class HumanReviewQueue {
  private storage: TraceStorage;

  constructor(storage: TraceStorage) {
    this.storage = storage;
  }

  /**
   * 添加审核项
   *
   * 任务 3.1.3: 实现 add() 方法添加审核项
   */
  async add(input: ReviewItemInput): Promise<ReviewItem> {
    const reviewId = generateReviewId(input.traceId);
    const priority = input.priority ?? 'medium';

    const item: ReviewItem = {
      reviewId,
      traceId: input.traceId,
      evaluationId: input.evaluationId,
      ...(input.alertId && { alertId: input.alertId }),
      status: 'pending',
      priority,
      createdAt: new Date().toISOString(),
      details: input.details,
    };

    await this.storage.saveReviewItem(item);
    return item;
  }

  /**
   * 从告警创建审核项
   *
   * 用于 Alert-Review 联动 (任务 3.4.2)
   */
  async addFromAlert(
    alert: AlertEvent,
    query: string,
    answer: string
  ): Promise<ReviewItem> {
    const details = createReviewDetailsFromAlert(alert, query, answer);
    const priority = determineReviewPriority(alert);

    return this.add({
      traceId: alert.traceId ?? '',
      evaluationId: alert.evaluationId ?? '',
      alertId: alert.alertId,
      priority,
      details,
    });
  }

  /**
   * 获取待审核列表
   *
   * 任务 3.1.4: 实现 getPending() 方法获取待审核列表
   */
  getPending(options?: {
    priority?: ReviewPriority;
    limit?: number;
    offset?: number;
  }): ReviewItem[] {
    return this.storage.getReviewItems({
      status: 'pending',
      ...options,
    });
  }

  /**
   * 获取所有审核项（支持状态过滤）
   */
  getAll(options?: {
    status?: ReviewStatus;
    priority?: ReviewPriority;
    limit?: number;
    offset?: number;
  }): ReviewItem[] {
    return this.storage.getReviewItems(options);
  }

  /**
   * 获取单个审核项
   */
  get(reviewId: string): ReviewItem | null {
    const items = this.storage.getReviewItems({ limit: 1000 });
    return items.find(item => item.reviewId === reviewId) ?? null;
  }

  /**
   * 分配审核人员
   *
   * 任务 3.1.5: 实现 assign() 方法分配审核人员
   */
  async assign(reviewId: string, assignedTo: string): Promise<ReviewItem | null> {
    const item = this.get(reviewId);
    if (!item) {
      return null;
    }

    if (item.status !== 'pending') {
      throw new Error(`Cannot assign review item with status: ${item.status}`);
    }

    await this.storage.updateReviewItem(reviewId, {
      status: 'assigned',
      assignedTo,
    });

    return this.get(reviewId);
  }

  /**
   * 批准审核
   *
   * 任务 3.1.6: 实现 approve() 方法批准审核
   */
  async approve(
    reviewId: string,
    reviewer: string,
    notes?: string
  ): Promise<ReviewItem | null> {
    const item = this.get(reviewId);
    if (!item) {
      return null;
    }

    if (item.status !== 'assigned' && item.status !== 'pending') {
      throw new Error(`Cannot approve review item with status: ${item.status}`);
    }

    const now = new Date().toISOString();

    await this.storage.updateReviewItem(reviewId, {
      status: 'reviewed',
      assignedTo: reviewer,
      reviewedAt: now,
      ...(notes && { reviewNotes: notes }),
      result: 'approved',
    });

    return this.get(reviewId);
  }

  /**
   * 拒绝审核
   *
   * 任务 3.1.7: 实现 reject() 方法拒绝审核
   */
  async reject(
    reviewId: string,
    reviewer: string,
    notes?: string
  ): Promise<ReviewItem | null> {
    const item = this.get(reviewId);
    if (!item) {
      return null;
    }

    if (item.status !== 'assigned' && item.status !== 'pending') {
      throw new Error(`Cannot reject review item with status: ${item.status}`);
    }

    const now = new Date().toISOString();

    await this.storage.updateReviewItem(reviewId, {
      status: 'reviewed',
      assignedTo: reviewer,
      reviewedAt: now,
      ...(notes && { reviewNotes: notes }),
      result: 'rejected',
    });

    return this.get(reviewId);
  }

  /**
   * 解决审核项（标记为已处理）
   */
  async resolve(reviewId: string): Promise<ReviewItem | null> {
    const item = this.get(reviewId);
    if (!item) {
      return null;
    }

    if (item.status !== 'reviewed') {
      throw new Error(`Cannot resolve review item with status: ${item.status}`);
    }

    const now = new Date().toISOString();

    await this.storage.updateReviewItem(reviewId, {
      status: 'resolved',
      resolvedAt: now,
    });

    return this.get(reviewId);
  }

  /**
   * 获取计数
   *
   * 任务 3.1.8: 实现 getCount() 方法获取计数
   */
  getCount(status?: ReviewStatus): number {
    return this.storage.getReviewCount(status);
  }

  /**
   * 获取统计数据
   */
  getStats(): {
    total: number;
    pending: number;
    assigned: number;
    reviewed: number;
    resolved: number;
    byPriority: Record<ReviewPriority, number>;
  } {
    return {
      total: this.getCount(),
      pending: this.getCount('pending'),
      assigned: this.getCount('assigned'),
      reviewed: this.getCount('reviewed'),
      resolved: this.getCount('resolved'),
      byPriority: {
        critical: this.getByPriorityCount('critical'),
        high: this.getByPriorityCount('high'),
        medium: this.getByPriorityCount('medium'),
        low: this.getByPriorityCount('low'),
      },
    };
  }

  /**
   * 获取特定优先级的计数
   */
  private getByPriorityCount(priority: ReviewPriority): number {
    const items = this.storage.getReviewItems({ priority, limit: 10000 });
    return items.length;
  }

  /**
   * 检查 SLA 违规（pending > 24h 或 critical > 4h）
   *
   * 任务 3.5.1: 实现 SLA 检查逻辑
   */
  checkSLABreaches(): {
    breaches: ReviewItem[];
    criticalBreaches: ReviewItem[];
  } {
    const pendingItems = this.getPending();
    const now = Date.now();
    const normalSlaMs = 24 * 60 * 60 * 1000; // 24 hours
    const criticalSlaMs = 4 * 60 * 60 * 1000; // 4 hours

    const breaches: ReviewItem[] = [];
    const criticalBreaches: ReviewItem[] = [];

    for (const item of pendingItems) {
      const createdAt = new Date(item.createdAt).getTime();
      const duration = now - createdAt;

      if (item.priority === 'critical' && duration > criticalSlaMs) {
        criticalBreaches.push(item);
      } else if (duration > normalSlaMs) {
        breaches.push(item);
      }
    }

    return { breaches, criticalBreaches };
  }
}

/**
 * 创建 HumanReviewQueue
 */
export function createHumanReviewQueue(storage: TraceStorage): HumanReviewQueue {
  return new HumanReviewQueue(storage);
}