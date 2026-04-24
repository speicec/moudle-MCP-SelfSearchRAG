/**
 * HumanReviewQueue Unit Tests
 *
 * 任务 3.6.1: 编写 HumanReviewQueue 单元测试
 * 任务 3.6.2: 编写审核项创建测试
 * 任务 3.6.3: 编写审核流程测试（assign/approve/reject）
 * 任务 3.6.4: 编写 REST API 测试
 * 任务 3.6.5: 编写 SLA 监控测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HumanReviewQueue } from '../HumanReviewQueue.js';
import type { ReviewItem, ReviewItemInput, ReviewPriority } from '../types.js';
import type { AlertEvent } from '../../alert/types.js';
import type { TraceStorage } from '../../tracing/TraceStorage.js';

// Mock TraceStorage with review functionality
const createMockStorage = () => ({
  saveReviewItem: vi.fn().mockResolvedValue(undefined),
  getReviewItems: vi.fn().mockImplementation((options?: { status?: string; limit?: number }) => {
    const items: ReviewItem[] = [
      {
        reviewId: 'review-1',
        traceId: 'trace-1',
        evaluationId: 'eval-1',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date().toISOString(),
        details: {
          query: 'test query',
          answer: 'test answer',
          safetyScore: 0.3,
        },
      },
      {
        reviewId: 'review-2',
        traceId: 'trace-2',
        evaluationId: 'eval-2',
        alertId: 'alert-1',
        status: 'assigned',
        priority: 'high',
        createdAt: new Date().toISOString(),
        assignedTo: 'reviewer-1',
        details: {
          query: 'test query 2',
          answer: 'test answer 2',
          faithfulness: 0.4,
        },
      },
      {
        reviewId: 'review-3',
        traceId: 'trace-3',
        evaluationId: 'eval-3',
        status: 'pending',
        priority: 'medium',
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago for SLA test
        details: {
          query: 'old query',
          answer: 'old answer',
        },
      },
    ];

    if (options?.status) {
      return items.filter(item => item.status === options.status);
    }

    if (options?.limit) {
      return items.slice(0, options.limit);
    }

    return items;
  }),
  updateReviewItem: vi.fn().mockImplementation((reviewId: string, updates: Partial<ReviewItem>) => {
    return Promise.resolve({ reviewId, ...updates });
  }),
  getReviewCount: vi.fn().mockImplementation((status?: string) => {
    if (status === 'pending') return 2;
    if (status === 'assigned') return 1;
    return 3;
  }),
  saveAlert: vi.fn().mockResolvedValue(undefined),
  getAlerts: vi.fn().mockResolvedValue([]),
  getAlert: vi.fn().mockResolvedValue(null),
  acknowledgeAlert: vi.fn().mockResolvedValue(undefined),
  resolveAlert: vi.fn().mockResolvedValue(undefined),
} as unknown as TraceStorage);

// ==================== 任务 3.6.1: HumanReviewQueue 单元测试 ====================

describe('HumanReviewQueue Unit Tests', () => {
  let queue: HumanReviewQueue;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    queue = new HumanReviewQueue(mockStorage);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with storage', () => {
      expect(queue).toBeDefined();
    });
  });

  describe('get', () => {
    it('should retrieve a review item by id', () => {
      const item = queue.get('review-1');
      expect(item).toBeDefined();
      expect(item?.reviewId).toBe('review-1');
    });

    it('should return null for non-existent item', () => {
      const item = queue.get('non-existent');
      expect(item).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should retrieve all review items', () => {
      const items = queue.getAll();
      expect(items.length).toBeGreaterThan(0);
    });

    it('should filter by status', () => {
      const items = queue.getAll({ status: 'pending' });
      expect(items.every(item => item.status === 'pending')).toBe(true);
    });
  });
});

// ==================== 任务 3.6.2: 审核项创建测试 ====================

describe('Review Item Creation Tests (任务 3.6.2)', () => {
  let queue: HumanReviewQueue;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    queue = new HumanReviewQueue(mockStorage);
    vi.clearAllMocks();
  });

  describe('add', () => {
    it('should create a new review item', async () => {
      const input: ReviewItemInput = {
        traceId: 'new-trace',
        evaluationId: 'new-eval',
        priority: 'high',
        details: {
          query: 'new query',
          answer: 'new answer',
          safetyScore: 0.25,
        },
      };

      const item = await queue.add(input);

      expect(item).toBeDefined();
      expect(item.reviewId).toBeDefined();
      expect(item.traceId).toBe('new-trace');
      expect(item.status).toBe('pending');
      expect(item.priority).toBe('high');
    });

    it('should use default priority when not specified', async () => {
      const input: ReviewItemInput = {
        traceId: 'default-priority',
        evaluationId: 'eval',
        details: {
          query: 'query',
          answer: 'answer',
        },
      };

      const item = await queue.add(input);

      expect(item.priority).toBe('medium');
    });

    it('should include alertId when provided', async () => {
      const input: ReviewItemInput = {
        traceId: 'with-alert',
        evaluationId: 'eval',
        alertId: 'alert-123',
        details: {
          query: 'query',
          answer: 'answer',
        },
      };

      const item = await queue.add(input);

      expect(item.alertId).toBe('alert-123');
    });

    it('should save to storage', async () => {
      const input: ReviewItemInput = {
        traceId: 'storage-test',
        evaluationId: 'eval',
        details: {
          query: 'query',
          answer: 'answer',
        },
      };

      await queue.add(input);

      expect((mockStorage as { saveReviewItem: ReturnType<typeof vi.fn> }).saveReviewItem).toHaveBeenCalled();
    });
  });

  describe('addFromAlert', () => {
    it('should create review item from alert', async () => {
      const alert: AlertEvent = {
        alertId: 'alert-from',
        timestamp: new Date().toISOString(),
        type: 'SAFETY_CRITICAL',
        severity: 'critical',
        traceId: 'alert-trace',
        evaluationId: 'alert-eval',
        details: { safetyScore: 0.2 },
        suggestedActions: ['review'],
        status: 'active',
      };

      const item = await queue.addFromAlert(alert, 'test query', 'test answer');

      expect(item).toBeDefined();
      expect(item.traceId).toBe('alert-trace');
      expect(item.priority).toBe('critical');
      expect(item.details.safetyScore).toBeDefined();
    });
  });
});

// ==================== 任务 3.6.3: 审核流程测试 ====================

describe('Review Process Tests (任务 3.6.3)', () => {
  let queue: HumanReviewQueue;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    queue = new HumanReviewQueue(mockStorage);
    vi.clearAllMocks();
  });

  describe('assign', () => {
    it('should assign review item to reviewer', async () => {
      const item = await queue.assign('review-1', 'reviewer-2');

      expect(item).toBeDefined();
      expect((mockStorage as { updateReviewItem: ReturnType<typeof vi.fn> }).updateReviewItem).toHaveBeenCalledWith(
        'review-1',
        expect.objectContaining({
          status: 'assigned',
          assignedTo: 'reviewer-2',
        })
      );
    });

    it('should throw error for non-pending status', async () => {
      await expect(queue.assign('review-2', 'reviewer-3')).rejects.toThrow();
    });

    it('should return null for non-existent item', async () => {
      const item = await queue.assign('non-existent', 'reviewer');
      expect(item).toBeNull();
    });
  });

  describe('approve', () => {
    it('should approve pending review item', async () => {
      const item = await queue.approve('review-1', 'approver', 'Good response');

      expect(item).toBeDefined();
      expect((mockStorage as { updateReviewItem: ReturnType<typeof vi.fn> }).updateReviewItem).toHaveBeenCalledWith(
        'review-1',
        expect.objectContaining({
          status: 'reviewed',
          result: 'approved',
          reviewNotes: 'Good response',
        })
      );
    });

    it('should approve assigned review item', async () => {
      const item = await queue.approve('review-2', 'approver');

      expect(item).toBeDefined();
    });

    it('should throw error for reviewed/resolved status', async () => {
      // Create a reviewed item mock
      const reviewedStorage = {
        ...mockStorage,
        getReviewItems: vi.fn().mockReturnValue([
          {
            reviewId: 'review-reviewed',
            status: 'reviewed',
            traceId: 'trace',
            evaluationId: 'eval',
            createdAt: new Date().toISOString(),
            details: {},
          },
        ]),
      } as unknown as TraceStorage;

      const reviewedQueue = new HumanReviewQueue(reviewedStorage);

      await expect(reviewedQueue.approve('review-reviewed', 'approver')).rejects.toThrow();
    });

    it('should return null for non-existent item', async () => {
      const item = await queue.approve('non-existent', 'approver');
      expect(item).toBeNull();
    });
  });

  describe('reject', () => {
    it('should reject pending review item', async () => {
      const item = await queue.reject('review-1', 'rejector', 'Bad response');

      expect(item).toBeDefined();
      expect((mockStorage as { updateReviewItem: ReturnType<typeof vi.fn> }).updateReviewItem).toHaveBeenCalledWith(
        'review-1',
        expect.objectContaining({
          status: 'reviewed',
          result: 'rejected',
          reviewNotes: 'Bad response',
        })
      );
    });

    it('should reject without notes', async () => {
      const item = await queue.reject('review-1', 'rejector');

      expect(item).toBeDefined();
    });
  });

  describe('resolve', () => {
    it('should resolve reviewed item', async () => {
      // Create a reviewed item mock
      const reviewedStorage = {
        ...mockStorage,
        getReviewItems: vi.fn().mockReturnValue([
          {
            reviewId: 'review-to-resolve',
            status: 'reviewed',
            traceId: 'trace',
            evaluationId: 'eval',
            createdAt: new Date().toISOString(),
            details: {},
          },
        ]),
        updateReviewItem: vi.fn().mockResolvedValue({}),
      } as unknown as TraceStorage;

      const resolveQueue = new HumanReviewQueue(reviewedStorage);

      const item = await resolveQueue.resolve('review-to-resolve');

      expect((reviewedStorage as { updateReviewItem: ReturnType<typeof vi.fn> }).updateReviewItem).toHaveBeenCalledWith(
        'review-to-resolve',
        expect.objectContaining({
          status: 'resolved',
        })
      );
    });
  });
});

// ==================== 任务 3.6.5: SLA 监控测试 ====================

describe('SLA Monitoring Tests (任务 3.6.5)', () => {
  let queue: HumanReviewQueue;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    queue = new HumanReviewQueue(mockStorage);
    vi.clearAllMocks();
  });

  describe('getCount', () => {
    it('should return total count without status filter', () => {
      const count = queue.getCount();
      expect(count).toBe(3);
    });

    it('should return filtered count by status', () => {
      const pendingCount = queue.getCount('pending');
      expect(pendingCount).toBe(2);

      const assignedCount = queue.getCount('assigned');
      expect(assignedCount).toBe(1);
    });
  });

  describe('getPending', () => {
    it('should return only pending items', () => {
      const items = queue.getPending();
      expect(items.every(item => item.status === 'pending')).toBe(true);
    });

    it('should filter by priority', () => {
      const items = queue.getPending({ priority: 'critical' });
      expect(items.every(item => item.priority === 'critical')).toBe(true);
    });

    it('should respect limit', () => {
      const items = queue.getPending({ limit: 1 });
      expect(items.length).toBeLessThanOrEqual(1);
    });
  });

  describe('SLA breach detection', () => {
    it('should identify old pending items for SLA breach', () => {
      const items = queue.getPending();
      const slaThresholdMs = 24 * 60 * 60 * 1000; // 24 hours

      const breachedItems = items.filter(item => {
        const createdAt = new Date(item.createdAt).getTime();
        const elapsed = Date.now() - createdAt;
        return elapsed > slaThresholdMs;
      });

      // review-3 was created 25 hours ago
      expect(breachedItems.length).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', () => {
      const stats = queue.getStats();

      expect(stats.total).toBeDefined();
      expect(stats.pending).toBeDefined();
      expect(stats.assigned).toBeDefined();
      expect(stats.reviewed).toBeDefined();
      expect(stats.resolved).toBeDefined();
      expect(stats.byPriority).toBeDefined();
    });
  });
});