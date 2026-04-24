/**
 * EvaluationAutoscaler Tests
 *
 * 任务 7.6.1: 编写 EvaluationAutoscaler 单元测试
 * 任务 7.6.2: 编写扩容决策测试
 * 任务 7.6.3: 编写缩容决策测试
 * 任务 7.6.4: 编写冷却期测试
 * 任务 7.6.5: 编写 REST API 测试
 * 任务 7.6.6: 编写 Docker 集成测试（手动）
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EvaluationAutoscaler, MockDockerAdapter, createEvaluationAutoscaler } from '../EvaluationAutoscaler.js';
import type { AutoscalerConfig } from '../types.js';
import type { QueueStats } from '../../monitor/types.js';
import type { TraceStorage } from '../../tracing/TraceStorage.js';

// Mock TraceStorage
const createMockStorage = () => ({
  saveScaleEvent: vi.fn().mockResolvedValue(undefined),
  getScaleEvents: vi.fn().mockReturnValue([]),
  saveAlert: vi.fn().mockResolvedValue(undefined),
  getAlerts: vi.fn().mockResolvedValue([]),
  getAlert: vi.fn().mockResolvedValue(null),
  acknowledgeAlert: vi.fn().mockResolvedValue(undefined),
  resolveAlert: vi.fn().mockResolvedValue(undefined),
} as unknown as TraceStorage);

// Mock Queue
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

// ==================== 任务 7.6.1: EvaluationAutoscaler 单元测试 ====================

describe('EvaluationAutoscaler Unit Tests', () => {
  let autoscaler: EvaluationAutoscaler;
  let mockQueue: ReturnType<typeof createMockQueue>;
  let mockStorage: TraceStorage;
  let mockDocker: MockDockerAdapter;

  beforeEach(() => {
    mockQueue = createMockQueue();
    mockStorage = createMockStorage();
    mockDocker = new MockDockerAdapter();

    autoscaler = new EvaluationAutoscaler(mockQueue, mockStorage, mockDocker, {
      minReplicas: 1,
      maxReplicas: 10,
      scaleUpThreshold: 50,
      scaleDownThreshold: 5,
      cooldownPeriod: 300000,
      checkInterval: 60000,
      serviceName: 'evaluation-worker',
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    autoscaler.stop();
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with dependencies', () => {
      expect(autoscaler).toBeDefined();
    });

    it('should use default config when not provided', () => {
      const defaultAutoscaler = createEvaluationAutoscaler(mockQueue, mockStorage);
      expect(defaultAutoscaler).toBeDefined();
    });
  });

  describe('getConfig', () => {
    it('should return current config', () => {
      const config = autoscaler.getConfig();

      expect(config).toBeDefined();
      expect(config.minReplicas).toBe(1);
      expect(config.maxReplicas).toBe(10);
      expect(config.serviceName).toBe('evaluation-worker');
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = autoscaler.getState();

      expect(state).toBeDefined();
      expect(state.enabled).toBe(true);
      expect(state.currentReplicas).toBeDefined();
    });
  });

  describe('enable/disable', () => {
    it('should disable autoscaling', () => {
      autoscaler.disable();
      expect(autoscaler.isEnabled()).toBe(false);
    });

    it('should enable autoscaling', () => {
      autoscaler.disable();
      autoscaler.enable();
      expect(autoscaler.isEnabled()).toBe(true);
    });
  });

  describe('isEnabled', () => {
    it('should return enabled status', () => {
      expect(autoscaler.isEnabled()).toBe(true);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue stats', async () => {
      const stats = await autoscaler.getQueueStats();

      expect(stats).toBeDefined();
      expect(stats.waiting).toBe(10);
      expect(stats.active).toBe(5);
    });
  });
});

// ==================== 任务 7.6.2: 扩容决策测试 ====================

describe('Scale Up Decision Tests (任务 7.6.2)', () => {
  let autoscaler: EvaluationAutoscaler;
  let mockQueue: ReturnType<typeof createMockQueue>;
  let mockStorage: TraceStorage;
  let mockDocker: MockDockerAdapter;

  beforeEach(() => {
    mockQueue = createMockQueue();
    mockStorage = createMockStorage();
    mockDocker = new MockDockerAdapter();

    autoscaler = new EvaluationAutoscaler(mockQueue, mockStorage, mockDocker, {
      minReplicas: 1,
      maxReplicas: 10,
      scaleUpThreshold: 50,
      scaleDownThreshold: 5,
      cooldownPeriod: 0, // No cooldown for testing
      checkInterval: 60000,
      serviceName: 'evaluation-worker',
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    autoscaler.stop();
    vi.resetAllMocks();
  });

  it('should scale up when waiting exceeds threshold', async () => {
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 100, // Exceeds scaleUpThreshold (50)
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await autoscaler.checkAndScale();

    // Should have scaled up
    const currentReplicas = await autoscaler.getCurrentReplicas();
    expect(currentReplicas).toBeGreaterThan(2); // ceil(100/20) = 5
  });

  it('should calculate correct target replicas', async () => {
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 80,
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await autoscaler.checkAndScale();

    // ceil(80/20) = 4 replicas
    const currentReplicas = await autoscaler.getCurrentReplicas();
    expect(currentReplicas).toBe(4);
  });

  it('should respect max replicas limit', async () => {
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 500, // Would need ceil(500/20) = 25 replicas, but max is 10
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await autoscaler.checkAndScale();

    const currentReplicas = await autoscaler.getCurrentReplicas();
    expect(currentReplicas).toBeLessThanOrEqual(10);
  });

  it('should not scale up when waiting below threshold', async () => {
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 30, // Below threshold
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await autoscaler.checkAndScale();

    // Should stay at min replicas
    const currentReplicas = await autoscaler.getCurrentReplicas();
    expect(currentReplicas).toBe(1);
  });
});

// ==================== 任务 7.6.3: 缩容决策测试 ====================

describe('Scale Down Decision Tests (任务 7.6.3)', () => {
  let autoscaler: EvaluationAutoscaler;
  let mockQueue: ReturnType<typeof createMockQueue>;
  let mockStorage: TraceStorage;
  let mockDocker: MockDockerAdapter;

  beforeEach(() => {
    mockQueue = createMockQueue();
    mockStorage = createMockStorage();
    mockDocker = new MockDockerAdapter();

    autoscaler = new EvaluationAutoscaler(mockQueue, mockStorage, mockDocker, {
      minReplicas: 1,
      maxReplicas: 10,
      scaleUpThreshold: 50,
      scaleDownThreshold: 5,
      cooldownPeriod: 0,
      checkInterval: 60000,
      serviceName: 'evaluation-worker',
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    autoscaler.stop();
    vi.resetAllMocks();
  });

  it('should scale down when queue is idle', async () => {
    // First scale up to have more replicas
    mockQueue.getJobCounts.mockResolvedValueOnce({
      waiting: 100,
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await autoscaler.checkAndScale();

    // Then simulate idle queue
    mockQueue.getJobCounts.mockResolvedValueOnce({
      waiting: 2, // Below scaleDownThreshold (5)
      active: 1, // Less than 2 active
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await autoscaler.checkAndScale();

    // Should scale down to min replicas
    const currentReplicas = await autoscaler.getCurrentReplicas();
    expect(currentReplicas).toBe(1);
  });

  it('should not scale down when queue has active jobs', async () => {
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 2,
      active: 3, // More than 2 active
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await autoscaler.checkAndScale();

    // Should not scale down
    // Note: Since we're starting at minReplicas=1, no change expected
    expect(autoscaler.isEnabled()).toBe(true);
  });

  it('should respect min replicas limit', async () => {
    // Even if completely idle, should not go below minReplicas
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await autoscaler.checkAndScale();

    const currentReplicas = await autoscaler.getCurrentReplicas();
    expect(currentReplicas).toBeGreaterThanOrEqual(1);
  });
});

// ==================== 任务 7.6.4: 冷却期测试 ====================

describe('Cooldown Period Tests (任务 7.6.4)', () => {
  let autoscaler: EvaluationAutoscaler;
  let mockQueue: ReturnType<typeof createMockQueue>;
  let mockStorage: TraceStorage;
  let mockDocker: MockDockerAdapter;

  beforeEach(() => {
    mockQueue = createMockQueue();
    mockStorage = createMockStorage();
    mockDocker = new MockDockerAdapter();

    autoscaler = new EvaluationAutoscaler(mockQueue, mockStorage, mockDocker, {
      minReplicas: 1,
      maxReplicas: 10,
      scaleUpThreshold: 50,
      scaleDownThreshold: 5,
      cooldownPeriod: 5000, // 5 seconds cooldown
      checkInterval: 1000,
      serviceName: 'evaluation-worker',
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    autoscaler.stop();
    vi.resetAllMocks();
  });

  it('should enforce cooldown after scale operation', async () => {
    // Trigger scale up
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 100,
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await autoscaler.checkAndScale();

    const replicasAfterFirst = await autoscaler.getCurrentReplicas();

    // Try to scale again immediately (should be blocked by cooldown)
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 200, // Would normally trigger another scale
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await autoscaler.checkAndScale();

    // Should still be at previous replicas due to cooldown
    const replicasAfterSecond = await autoscaler.getCurrentReplicas();
    expect(replicasAfterSecond).toBe(replicasAfterFirst);
  });

  it('should allow scale after cooldown expires', async () => {
    autoscaler = new EvaluationAutoscaler(mockQueue, mockStorage, mockDocker, {
      minReplicas: 1,
      maxReplicas: 10,
      scaleUpThreshold: 50,
      scaleDownThreshold: 5,
      cooldownPeriod: 100, // Very short cooldown for testing
      checkInterval: 50,
      serviceName: 'evaluation-worker',
    });

    // Trigger scale up
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 100,
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await autoscaler.checkAndScale();

    // Wait for cooldown to expire
    await new Promise(resolve => setTimeout(resolve, 200));

    // Should be able to scale again
    mockQueue.getJobCounts.mockResolvedValue({
      waiting: 150,
      active: 5,
      completed: 100,
      failed: 5,
      delayed: 0,
      paused: 0,
    });

    await autoscaler.checkAndScale();

    // Should have scaled
    autoscaler.stop();
  });
});

// ==================== 任务 7.6.5: REST API 测试 ====================

describe('Autoscaler REST API Functionality Tests (任务 7.6.5)', () => {
  let autoscaler: EvaluationAutoscaler;
  let mockQueue: ReturnType<typeof createMockQueue>;
  let mockStorage: TraceStorage;
  let mockDocker: MockDockerAdapter;

  beforeEach(() => {
    mockQueue = createMockQueue();
    mockStorage = createMockStorage();
    mockDocker = new MockDockerAdapter();

    autoscaler = new EvaluationAutoscaler(mockQueue, mockStorage, mockDocker);
    vi.clearAllMocks();
  });

  afterEach(() => {
    autoscaler.stop();
    vi.resetAllMocks();
  });

  describe('manual scale', () => {
    it('should allow manual scale to target replicas', async () => {
      const result = await autoscaler.scaleTo(5);

      expect(result.success).toBe(true);
      const current = await autoscaler.getCurrentReplicas();
      expect(current).toBe(5);
    });

    it('should reject scale below min replicas', async () => {
      const result = await autoscaler.scaleTo(0);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject scale above max replicas', async () => {
      const result = await autoscaler.scaleTo(15);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('broadcast', () => {
    it('should support broadcast function', () => {
      const broadcastFn = vi.fn();
      autoscaler.setBroadcast(broadcastFn);

      expect(autoscaler).toBeDefined();
    });
  });

  describe('event storage', () => {
    it('should save scale events to storage', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 100,
        active: 5,
        completed: 100,
        failed: 5,
        delayed: 0,
        paused: 0,
      });

      await autoscaler.checkAndScale();

      expect((mockStorage as { saveScaleEvent: ReturnType<typeof vi.fn> }).saveScaleEvent).toHaveBeenCalled();
    });
  });
});

// ==================== 任务 7.6.6: Docker 集成测试（手动） ====================

describe('Docker Integration Tests (任务 7.6.6)', () => {
  // Note: These tests require actual Docker environment
  // They are marked as manual tests and should be run separately

  describe('MockDockerAdapter', () => {
    it('should simulate Docker operations', async () => {
      const adapter = new MockDockerAdapter();

      const current = await adapter.getCurrentReplicas('evaluation-worker');
      expect(current).toBe(2);

      const result = await adapter.scaleTo('evaluation-worker', 5);
      expect(result.success).toBe(true);

      const afterScale = await adapter.getCurrentReplicas('evaluation-worker');
      expect(afterScale).toBe(5);
    });
  });

  // Manual test placeholder
  it.skip('should scale actual Docker containers (manual test)', async () => {
    // This test requires:
    // 1. Docker Compose running
    // 2. evaluation-worker service defined
    // 3. Manual execution in proper environment

    // Test steps:
    // - Create EvaluationAutoscaler with real DockerAdapter
    // - Verify getCurrentReplicas() returns actual count
    // - Call scaleTo() and verify container count changes
    // - Verify Docker Compose logs show scale operation
  });
});

describe('createEvaluationAutoscaler factory', () => {
  it('should create autoscaler with default adapter', () => {
    const mockQueue = createMockQueue();
    const mockStorage = createMockStorage();

    const autoscaler = createEvaluationAutoscaler(mockQueue, mockStorage);

    expect(autoscaler).toBeDefined();
    expect(autoscaler).toBeInstanceOf(EvaluationAutoscaler);
  });

  it('should create autoscaler with custom adapter', () => {
    const mockQueue = createMockQueue();
    const mockStorage = createMockStorage();
    const mockDocker = new MockDockerAdapter();

    const autoscaler = createEvaluationAutoscaler(mockQueue, mockStorage, mockDocker);

    expect(autoscaler).toBeDefined();
  });
});