/**
 * QueueHealthMonitor - 队列健康监控器
 *
 * 监控 Redis Queue 状态，检测积压、失败率、Worker 活跃度等问题
 */

import type { QueueStats, QueueHealthReport, QueueIssue, QueueHealthStatus, WorkerMetrics, HealthThresholds } from './types.js';
import { DEFAULT_HEALTH_THRESHOLDS } from './types.js';

/**
 * Queue interface - 队列接口（兼容 Bull Queue）
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
 * Stats buffer entry
 */
interface StatsBufferEntry {
  timestamp: number;
  stats: QueueStats;
}

/**
 * QueueHealthMonitor - 队列健康监控器
 *
 * 任务 6.1.1: 创建 src/monitor/QueueHealthMonitor.ts
 */
export class QueueHealthMonitor {
  private queue: Queue;
  private thresholds: HealthThresholds;
  private checkInterval: number;
  private intervalHandle?: ReturnType<typeof setInterval> | undefined;
  private statsBuffer: StatsBufferEntry[] = [];
  private bufferSize: number = 60; // Keep last 60 samples

  constructor(queue: Queue, options?: {
    thresholds?: Partial<HealthThresholds>;
    checkInterval?: number;
  }) {
    this.queue = queue;
    this.thresholds = { ...DEFAULT_HEALTH_THRESHOLDS, ...options?.thresholds };
    this.checkInterval = options?.checkInterval ?? 60000; // 1 minute default
  }

  /**
   * 启动监控循环
   *
   * 任务 6.1.3: 实现 start() 方法启动监控循环
   */
  start(): void {
    if (this.intervalHandle) {
      console.warn('[QueueHealthMonitor] Already running');
      return;
    }

    this.intervalHandle = setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        console.error('[QueueHealthMonitor] Health check failed:', error);
      }
    }, this.checkInterval);

    console.log(`[QueueHealthMonitor] Started with interval ${this.checkInterval}ms`);
  }

  /**
   * 停止监控
   *
   * 任务 6.1.4: 实现 stop() 方法停止监控
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null as unknown as undefined;
      console.log('[QueueHealthMonitor] Stopped');
    }
  }

  /**
   * 执行健康检查
   *
   * 任务 6.1.2: 实现 checkHealth() 方法
   */
  async checkHealth(): Promise<QueueHealthReport> {
    const stats = await this.getQueueStats();
    const metrics = this.calculateWorkerMetrics(stats);

    // Store stats in buffer for trend analysis
    this.addToBuffer(stats);

    // Detect issues
    const issues = this.detectIssues(stats, metrics);

    // Determine overall status
    const status = this.determineStatus(issues);

    return {
      status,
      stats,
      metrics,
      issues,
      timestamp: Date.now(),
    };
  }

  /**
   * 获取队列统计
   *
   * 任务 6.2.1: 实现 queue.getQueueStats() 定期调用
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
   * 计算 Worker 指标
   *
   * 任务 6.1.5: 实现 getWorkerMetrics() 方法
   */
  calculateWorkerMetrics(stats: QueueStats): WorkerMetrics {
    // Estimate active workers based on active jobs
    // Assuming each worker can handle multiple concurrent jobs
    const estimatedWorkers = Math.ceil(stats.active / 4);

    // Calculate throughput from completed jobs in buffer
    const throughput = this.calculateThroughput();

    // Calculate average processing time from recent stats
    const avgProcessingTimeMs = this.calculateAvgProcessingTime();

    return {
      activeWorkers: estimatedWorkers,
      expectedReplicas: 2, // Default from docker-compose config
      avgProcessingTimeMs,
      throughput,
    };
  }

  /**
   * 检测问题
   *
   * 任务 6.3.1-6.3.5: 实现各种检测逻辑
   */
  private detectIssues(stats: QueueStats, metrics: WorkerMetrics): QueueIssue[] {
    const issues: QueueIssue[] = [];

    // 任务 6.3.1: 队列积压检测
    if (stats.waiting >= this.thresholds.backlogCritical) {
      issues.push({
        type: 'backlog',
        severity: 'critical',
        message: `队列严重积压: ${stats.waiting} 任务等待处理`,
        details: { waiting: stats.waiting, threshold: this.thresholds.backlogCritical },
        suggestedActions: ['立即扩容 Worker', '检查处理瓶颈', '暂停新任务入队'],
      });
    } else if (stats.waiting >= this.thresholds.backlogWarning) {
      issues.push({
        type: 'backlog',
        severity: 'warning',
        message: `队列积压警告: ${stats.waiting} 任务等待处理`,
        details: { waiting: stats.waiting, threshold: this.thresholds.backlogWarning },
        suggestedActions: ['考虑扩容 Worker', '监控趋势'],
      });
    }

    // 任务 6.3.2: 失败率检测
    const totalProcessed = stats.completed + stats.failed;
    if (totalProcessed > 0) {
      const failureRate = stats.failed / totalProcessed;
      if (failureRate >= this.thresholds.failureRateCritical) {
        issues.push({
          type: 'high_failure_rate',
          severity: 'critical',
          message: `失败率过高: ${(failureRate * 100).toFixed(1)}%`,
          details: { failureRate, failed: stats.failed, completed: stats.completed },
          suggestedActions: ['暂停队列', '检查错误日志', '验证 LLM API 状态'],
        });
      } else if (failureRate >= this.thresholds.failureRateWarning) {
        issues.push({
          type: 'high_failure_rate',
          severity: 'warning',
          message: `失败率警告: ${(failureRate * 100).toFixed(1)}%`,
          details: { failureRate, failed: stats.failed, completed: stats.completed },
          suggestedActions: ['检查失败原因', '监控趋势'],
        });
      }
    }

    // 任务 6.3.3: Worker 活跃度检测
    if (this.thresholds.noWorkersCritical && metrics.activeWorkers === 0 && stats.waiting > 0) {
      issues.push({
        type: 'no_workers',
        severity: 'critical',
        message: '无活跃 Worker，任务积压无法处理',
        details: { activeWorkers: 0, waiting: stats.waiting },
        suggestedActions: ['检查 Worker 进程状态', '重启 Worker 服务', '手动扩容'],
      });
    }

    // 任务 6.3.4: 处理时间检测
    if (metrics.avgProcessingTimeMs >= this.thresholds.processingTimeWarningMs) {
      issues.push({
        type: 'slow_processing',
        severity: 'warning',
        message: `平均处理时间过长: ${(metrics.avgProcessingTimeMs / 1000).toFixed(1)}秒`,
        details: { avgProcessingTimeMs: metrics.avgProcessingTimeMs },
        suggestedActions: ['检查 LLM API 延迟', '优化 Prompt 长度', '考虑增加超时时间'],
      });
    }

    // Failure spike detection (compare recent failures to baseline)
    const recentFailures = this.detectFailureSpike(stats);
    if (recentFailures) {
      issues.push(recentFailures);
    }

    return issues;
  }

  /**
   * 检测失败突增
   */
  private detectFailureSpike(currentStats: QueueStats): QueueIssue | null {
    if (this.statsBuffer.length < 5) return null;

    const recentBuffer = this.statsBuffer.slice(-5);
    const baselineFailures = recentBuffer[0]?.stats.failed ?? 0;
    const currentFailures = currentStats.failed;
    const spikeThreshold = 10; // More than 10 new failures in last 5 checks

    if (currentFailures - baselineFailures > spikeThreshold) {
      return {
        type: 'failure_spike',
        severity: 'warning',
        message: `短时间内失败突增: ${currentFailures - baselineFailures} 个新失败`,
        details: { recentFailures: currentFailures - baselineFailures, baselineFailures, currentFailures },
        suggestedActions: ['查看最新失败详情', '检查系统稳定性'],
      };
    }

    return null;
  }

  /**
   * 确定整体健康状态
   *
   * 任务 6.3.5: 实现 health status 聚合逻辑
   */
  private determineStatus(issues: QueueIssue[]): QueueHealthStatus {
    if (issues.some(i => i.severity === 'critical')) {
      return 'critical';
    }
    if (issues.some(i => i.severity === 'warning')) {
      return 'warning';
    }
    return 'healthy';
  }

  /**
   * 添加统计到缓冲区
   *
   * 任务 6.2.2: 实现 stats 存储（内存 buffer）
   */
  private addToBuffer(stats: QueueStats): void {
    this.statsBuffer.push({
      timestamp: Date.now(),
      stats,
    });

    // Keep buffer size limited
    if (this.statsBuffer.length > this.bufferSize) {
      this.statsBuffer.shift();
    }
  }

  /**
   * 计算吞吐量
   */
  private calculateThroughput(): number {
    if (this.statsBuffer.length < 2) return 0;

    const oldest = this.statsBuffer[0];
    const newest = this.statsBuffer[this.statsBuffer.length - 1];

    // TypeScript can't infer that these are defined after length check
    if (!oldest || !newest) return 0;

    const completedDiff = newest.stats.completed - oldest.stats.completed;
    const timeDiffMs = newest.timestamp - oldest.timestamp;
    const timeDiffMinutes = timeDiffMs / 60000;

    if (timeDiffMinutes <= 0) return 0;
    return completedDiff / timeDiffMinutes;
  }

  /**
   * 计算平均处理时间
   */
  private calculateAvgProcessingTime(): number {
    // Estimate based on throughput and active jobs
    const throughput = this.calculateThroughput();
    if (throughput <= 0) return 0;

    const recentStats = this.statsBuffer[this.statsBuffer.length - 1]?.stats;
    if (!recentStats) return 0;

    // Rough estimate: active jobs / throughput gives average processing time
    return (recentStats.active / throughput) * 60000;
  }

  /**
   * 获取趋势分析
   *
   * 任务 6.2.3: 实现 stats 趋势分析
   */
  getTrendAnalysis(): {
    waitingTrend: 'increasing' | 'stable' | 'decreasing';
    failureTrend: 'increasing' | 'stable' | 'decreasing';
    throughputTrend: 'increasing' | 'stable' | 'decreasing';
  } {
    if (this.statsBuffer.length < 5) {
      return {
        waitingTrend: 'stable',
        failureTrend: 'stable',
        throughputTrend: 'stable',
      };
    }

    const recent = this.statsBuffer.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];
    if (!first || !last) return { waitingTrend: 'stable', failureTrend: 'stable', throughputTrend: 'stable' };

    // Determine waiting trend
    const waitingChange = last.stats.waiting - first.stats.waiting;
    let waitingTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (waitingChange > 10) waitingTrend = 'increasing';
    else if (waitingChange < -10) waitingTrend = 'decreasing';

    // Determine failure trend
    const failureChange = last.stats.failed - first.stats.failed;
    let failureTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (failureChange > 5) failureTrend = 'increasing';

    // Determine throughput trend
    const throughputFirst = (recent[1]?.stats.completed ?? 0) - (recent[0]?.stats.completed ?? 0);
    const throughputLast = (last.stats.completed ?? 0) - (recent[recent.length - 2]?.stats.completed ?? 0);
    let throughputTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (throughputLast > throughputFirst * 1.2) throughputTrend = 'increasing';
    else if (throughputLast < throughputFirst * 0.8) throughputTrend = 'decreasing';

    return { waitingTrend, failureTrend, throughputTrend };
  }

  /**
   * 获取统计历史
   */
  getStatsHistory(): StatsBufferEntry[] {
    return [...this.statsBuffer];
  }
}

/**
 * 创建队列健康监控器
 */
export function createQueueHealthMonitor(queue: Queue, options?: {
  thresholds?: Partial<HealthThresholds>;
  checkInterval?: number;
}): QueueHealthMonitor {
  return new QueueHealthMonitor(queue, options);
}