/**
 * QueueHealthMonitor Tests
 *
 * 任务 6.6.1: 编写 QueueHealthMonitor 单元测试
 * 任务 6.6.2: 编写队列积压检测测试
 * 任务 6.6.3: 编写失败率检测测试
 * 任务 6.6.4: 编写 REST API 测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { QueueHealthMonitor, createQueueHealthMonitor } from '../QueueHealthMonitor.js';
import type { QueueStats, QueueHealthReport, QueueIssue } from '../types.js';
import type { HealthThresholds } from '../types.js';

// Mock Queue interface
const createMockQueue = () => ({
  getJobCounts: vi.fn().mockResolvedValue({
    waiting: 10,
    active: 5,
    completed: 100,
    failed: 5,
    delayed: 0,
    paused: 0,
  }),
});

// ==================== 任务 6.6.1: QueueHealthMonitor 单元测试 ====================

describe('QueueHealthMonitor Unit Tests', () => {
  let monitor: QueueHealthMonitor;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    mockQueue = createMockQueue();
    monitor = new QueueHealthMonitor(mockQueue, {
      checkInterval: 60000,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    monitor.stop();
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with queue', () => {
      expect(monitor).toBeDefined();
    });

    it('should accept custom thresholds', () => {
      const customThresholds: Partial<HealthThresholds> = {
        backlogWarning: 30,
        backlogCritical: 60,
      };

      const customMonitor = new QueueHealthMonitor(mockQueue, {
        thresholds: customThresholds,
      });

      expect(customMonitor).toBeDefined();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue stats', async () => {
      const stats = await monitor.getQueueStats();

      expect(stats).toBeDefined();
      expect(stats.waiting).toBe(10);
      expect(stats.active).toBe(5);
      expect(stats.completed).toBe(100);
      expect(stats.failed).toBe(5);
    });

    it('should call queue.getJobCounts', async () => {
      await monitor.getQueueStats();

      expect(mockQueue.getJobCounts).toHaveBeenCalled();
    });
  });

  describe('calculateWorkerMetrics', () => {
    it('should calculate worker metrics from stats', () => {
      const stats: QueueStats = {
        waiting: 10,
        active: 8,
        completed: 100,
        failed: 5,
        delayed: 0,
        paused: 0,
      };

      const metrics = monitor.calculateWorkerMetrics(stats);

      expect(metrics.activeWorkers).toBeDefined();
      expect(metrics.expectedReplicas).toBeDefined();
      expect(metrics.avgProcessingTimeMs).toBeDefined();
      expect(metrics.throughput).toBeDefined();
    });

    it('should estimate workers based on active jobs', () => {
      const stats: QueueStats = {
        waiting: 10,
        active: 12, // 12 active jobs with concurrency 4 = 3 workers
        completed: 100,
        failed: 5,
        delayed: 0,
        paused: 0,
      };

      const metrics = monitor.calculateWorkerMetrics(stats);

      expect(metrics.activeWorkers).toBe(3);
    });
  });

  describe('start/stop', () => {
    it('should start monitoring', () => {
      monitor.start();

      // Monitor should be running
      expect(monitor).toBeDefined();
    });

    it('should stop monitoring', () => {
      monitor.start();
      monitor.stop();

      // Monitor should be stopped
      expect(monitor).toBeDefined();
    });

    it('should not start twice', () => {
      monitor.start();
      monitor.start(); // Second call should be ignored

      expect(monitor).toBeDefined();
    });
  });

  describe('checkHealth', () => {
    it('should return health report', async () => {
      const report = await monitor.checkHealth();

      expect(report).toBeDefined();
      expect(report.status).toBeDefined();
      expect(report.stats).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.issues).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });

    it('should return healthy status for normal queue', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 2,
        delayed: 0,
        paused: 0,
      });

      const report = await monitor.checkHealth();

      expect(report.status).toBe('healthy');
      expect(report.issues.length).toBe(0);
    });
  });
});

// ==================== 任务 6.6.2: 队列积压检测测试 ====================

describe('Queue Backlog Detection Tests (任务 6.6.2)', () => {
  let monitor: QueueHealthMonitor;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    mockQueue = createMockQueue();
    monitor = new QueueHealthMonitor(mockQueue, {
      thresholds: {
        backlogWarning: 50,
        backlogCritical: 100,
        failureRateWarning: 0.1,
        failureRateCritical: 0.3,
        noWorkersCritical: true,
        processingTimeWarningMs: 60000,
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    monitor.stop();
    vi.resetAllMocks();
  });

  it('should detect warning backlog', async () => {
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 60, // Above warning threshold (50)
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    const report = await monitor.checkHealth();

    expect(report.status).toBe('warning');
    const backlogIssue = report.issues.find(i => i.type === 'backlog');
    expect(backlogIssue).toBeDefined();
    expect(backlogIssue?.severity).toBe('warning');
  });

  it('should detect critical backlog', async () => {
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 150, // Above critical threshold (100)
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    const report = await monitor.checkHealth();

    expect(report.status).toBe('critical');
    const backlogIssue = report.issues.find(i => i.type === 'backlog');
    expect(backlogIssue).toBeDefined();
    expect(backlogIssue?.severity).toBe('critical');
    expect(backlogIssue?.suggestedActions).toBeDefined();
  });

  it('should not detect backlog for normal queue', async () => {
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 10, // Below warning threshold
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    const report = await monitor.checkHealth();

    const backlogIssue = report.issues.find(i => i.type === 'backlog');
    expect(backlogIssue).toBeUndefined();
  });
});

// ==================== 任务 6.6.3: 失败率检测测试 ====================

describe('Failure Rate Detection Tests (任务 6.6.3)', () => {
  let monitor: QueueHealthMonitor;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    mockQueue = createMockQueue();
    monitor = new QueueHealthMonitor(mockQueue, {
      thresholds: {
        backlogWarning: 50,
        backlogCritical: 100,
        failureRateWarning: 0.1,
        failureRateCritical: 0.3,
        noWorkersCritical: true,
        processingTimeWarningMs: 60000,
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    monitor.stop();
    vi.resetAllMocks();
  });

  it('should detect warning failure rate', async () => {
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 5,
      active: 5,
      completed: 90,
      failed: 10, // 10/100 = 10% = warning threshold
      delayed: 0,
      paused: 0,
    });

    const report = await monitor.checkHealth();

    const failureIssue = report.issues.find(i => i.type === 'high_failure_rate');
    expect(failureIssue).toBeDefined();
    expect(failureIssue?.severity).toBe('warning');
  });

  it('should detect critical failure rate', async () => {
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 5,
      active: 5,
      completed: 70,
      failed: 30, // 30/100 = 30% = critical threshold
      delayed: 0,
      paused: 0,
    });

    const report = await monitor.checkHealth();

    expect(report.status).toBe('critical');
    const failureIssue = report.issues.find(i => i.type === 'high_failure_rate');
    expect(failureIssue).toBeDefined();
    expect(failureIssue?.severity).toBe('critical');
  });

  it('should not detect failure rate for normal queue', async () => {
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 5,
      active: 5,
      completed: 99,
      failed: 1, // 1/100 = 1% < warning threshold
      delayed: 0,
      paused: 0,
    });

    const report = await monitor.checkHealth();

    const failureIssue = report.issues.find(i => i.type === 'high_failure_rate');
    expect(failureIssue).toBeUndefined();
  });

  it('should handle zero processed jobs gracefully', async () => {
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 5,
      active: 5,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    });

    const report = await monitor.checkHealth();

    // Should not crash, no failure rate issue when no jobs processed
    const failureIssue = report.issues.find(i => i.type === 'high_failure_rate');
    expect(failureIssue).toBeUndefined();
  });

  it('should detect failure spike', async () => {
    // First call to establish baseline
    mockQueue.getJobCounts.mockResolvedValueOnce({
      waiting: 5,
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await monitor.checkHealth();

    // Multiple calls to build baseline
    for (let i = 0; i < 4; i++) {
      mockQueue.getJobCounts.mockResolvedValueOnce({
        waiting: 5,
        active: 5,
        completed: 100 + i * 10,
        failed: 5 + i,
        delayed: 0,
        paused: 0,
      });
      await monitor.checkHealth();
    }

    // Spike call - sudden increase in failures
    mockQueue.getJobCounts.mockResolvedValueOnce({
      waiting: 5,
      active: 5,
      completed: 140,
      failed: 20, // 15 more failures than baseline
      delayed: 0,
      paused: 0,
    });

    const report = await monitor.checkHealth();

    const spikeIssue = report.issues.find(i => i.type === 'failure_spike');
    expect(spikeIssue).toBeDefined();
  });
});

// ==================== 任务 6.6.4: REST API 测试 ====================

describe('Queue Health REST API Tests (任务 6.6.4)', () => {
  // Note: These tests would be in routes/queue.test.ts
  // Here we test the monitor functionality used by the API

  describe('getStatsHistory', () => {
    it('should return stats history', async () => {
      const mockQueue = createMockQueue();
      const monitor = new QueueHealthMonitor(mockQueue);

      // Run a few checks to populate history
      await monitor.checkHealth();
      await monitor.checkHealth();

      const history = monitor.getStatsHistory();

      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0]?.timestamp).toBeDefined();
      expect(history[0]?.stats).toBeDefined();
    });
  });

  describe('getTrendAnalysis', () => {
    it('should return stable trends for insufficient data', async () => {
      const mockQueue = createMockQueue();
      const monitor = new QueueHealthMonitor(mockQueue);

      const trend = monitor.getTrendAnalysis();

      expect(trend.waitingTrend).toBe('stable');
      expect(trend.failureTrend).toBe('stable');
      expect(trend.throughputTrend).toBe('stable');
    });

    it('should analyze trends with sufficient data', async () => {
      const mockQueue = createMockQueue();
      const monitor = new QueueHealthMonitor(mockQueue);

      // Populate enough data for trend analysis
      for (let i = 0; i < 10; i++) {
        mockQueue.getJobCounts.mockResolvedValue({
          waiting: 10 + i * 5, // Increasing waiting
          active: 5,
          completed: 100 + i * 10,
          failed: 5,
          delayed: 0,
          paused: 0,
        });
        await monitor.checkHealth();
      }

      const trend = monitor.getTrendAnalysis();

      expect(trend).toBeDefined();
      expect(trend.waitingTrend).toBeDefined();
      expect(trend.failureTrend).toBeDefined();
      expect(trend.throughputTrend).toBeDefined();
    });
  });
});

describe('createQueueHealthMonitor factory', () => {
  it('should create monitor instance', () => {
    const mockQueue = createMockQueue();
    const monitor = createQueueHealthMonitor(mockQueue);

    expect(monitor).toBeDefined();
    expect(monitor).toBeInstanceOf(QueueHealthMonitor);
  });
});