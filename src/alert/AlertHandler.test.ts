/**
 * AlertHandler Unit Tests
 *
 * 任务 2.7.1: 编写 AlertHandler 单元测试
 * 任务 2.7.2: 编写告警阈值触发测试
 * 任务 2.7.3: 编写告警广播测试
 * 任务 2.7.4: 编写告警存储测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AlertHandler, type EvaluationResultInput } from '../alert/AlertHandler.js';
import type { AlertEvent } from '../alert/types.js';
import type { TraceStorage } from '../tracing/TraceStorage.js';
import { ALERT_THRESHOLDS, getAlertThresholds } from '../alert/config.js';

// Mock TraceStorage
const mockStorage = {
  saveAlert: vi.fn().mockResolvedValue(undefined),
  getAlerts: vi.fn().mockResolvedValue([]),
  getAlert: vi.fn().mockResolvedValue(null),
  acknowledgeAlert: vi.fn().mockResolvedValue(undefined),
  resolveAlert: vi.fn().mockResolvedValue(undefined),
} as unknown as TraceStorage;

describe('AlertHandler', () => {
  let handler: AlertHandler;
  let broadcastFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handler = new AlertHandler(mockStorage);
    broadcastFn = vi.fn();
    handler.setBroadcast(broadcastFn);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor and setup', () => {
    it('should initialize with storage', () => {
      expect(handler).toBeDefined();
    });

    it('should accept broadcast function', () => {
      const fn = vi.fn();
      handler.setBroadcast(fn);
      // Broadcast function is used when alerts are processed
      expect(handler).toBeDefined();
    });
  });

  describe('checkAndAlert - Safety 告警', () => {
    it('should create SAFETY_CRITICAL alert when safety score below critical threshold', async () => {
      const result: EvaluationResultInput = {
        traceId: 'test-trace-1',
        evaluationId: 'eval-1',
        metrics: {
          faithfulness: { score: 0.8 },
          contextRelevance: { score: 0.9 },
        },
        extendedMetrics: {
          safetyAssessment: {
            score: 0.2, // Below critical threshold (default 0.5)
            severity: 'absolute',
            contraindication: 'Drug interaction detected',
          },
        },
      };

      const alerts = await handler.checkAndAlert(result);

      expect(alerts.length).toBeGreaterThan(0);
      const safetyAlert = alerts.find(a => a.type === 'SAFETY_CRITICAL');
      expect(safetyAlert).toBeDefined();
      expect(safetyAlert?.severity).toBe('critical');
      expect((safetyAlert?.details as { safetyScore: number }).safetyScore).toBe(0.2);
    });

    it('should create SAFETY warning alert when safety score below warning threshold', async () => {
      const result: EvaluationResultInput = {
        traceId: 'test-trace-2',
        evaluationId: 'eval-2',
        metrics: {
          faithfulness: { score: 0.8 },
          contextRelevance: { score: 0.9 },
        },
        extendedMetrics: {
          safetyAssessment: {
            score: 0.6, // Between critical (0.5) and warning (0.7)
            severity: 'relative',
          },
        },
      };

      const alerts = await handler.checkAndAlert(result);

      const safetyAlert = alerts.find(a => a.type === 'SAFETY_CRITICAL');
      expect(safetyAlert).toBeDefined();
      expect(safetyAlert?.severity).toBe('warning');
    });

    it('should not create alert when safety score is acceptable', async () => {
      const result: EvaluationResultInput = {
        traceId: 'test-trace-3',
        evaluationId: 'eval-3',
        metrics: {
          faithfulness: { score: 0.8 },
          contextRelevance: { score: 0.9 },
        },
        extendedMetrics: {
          safetyAssessment: {
            score: 0.9, // Above warning threshold
            severity: 'safe',
          },
        },
      };

      const alerts = await handler.checkAndAlert(result);

      const safetyAlert = alerts.find(a => a.type === 'SAFETY_CRITICAL');
      expect(safetyAlert).toBeUndefined();
    });
  });

  describe('checkAndAlert - Faithfulness 告警', () => {
    it('should create FAITHFULNESS_LOW alert when faithfulness below threshold', async () => {
      const result: EvaluationResultInput = {
        traceId: 'test-trace-4',
        evaluationId: 'eval-4',
        metrics: {
          faithfulness: { score: 0.5 }, // Below warning threshold (default 0.7)
          contextRelevance: { score: 0.9 },
        },
      };

      const alerts = await handler.checkAndAlert(result);

      const faithfulnessAlert = alerts.find(a => a.type === 'FAITHFULNESS_LOW');
      expect(faithfulnessAlert).toBeDefined();
      expect((faithfulnessAlert?.details as { value: number }).value).toBe(0.5);
    });

    it('should not create alert when faithfulness is acceptable', async () => {
      const result: EvaluationResultInput = {
        traceId: 'test-trace-5',
        evaluationId: 'eval-5',
        metrics: {
          faithfulness: { score: 0.85 },
          contextRelevance: { score: 0.9 },
        },
      };

      const alerts = await handler.checkAndAlert(result);

      const faithfulnessAlert = alerts.find(a => a.type === 'FAITHFULNESS_LOW');
      expect(faithfulnessAlert).toBeUndefined();
    });
  });

  describe('createSafetyAlert', () => {
    it('should create proper SAFETY_CRITICAL alert structure', () => {
      const alert = handler.createSafetyAlert({
        traceId: 'trace-1',
        evaluationId: 'eval-1',
        safetyScore: 0.3,
        threshold: 0.5,
        delta: -0.2,
        severity: 'critical',
        contraindication: 'Test contraindication',
        dangerousAdvice: ['advice1', 'advice2'],
      });

      expect(alert.type).toBe('SAFETY_CRITICAL');
      expect(alert.severity).toBe('critical');
      expect(alert.traceId).toBe('trace-1');
      expect(alert.status).toBe('active');
      expect(alert.details).toBeDefined();
      expect((alert.details as { safetyScore: number }).safetyScore).toBe(0.3);
      expect((alert.details as { contraindication: string }).contraindication).toBe('Test contraindication');
      expect((alert.details as { dangerousAdvice: string[] }).dangerousAdvice).toEqual(['advice1', 'advice2']);
    });
  });

  describe('createFaithfulnessAlert', () => {
    it('should create proper FAITHFULNESS_LOW alert structure', async () => {
      const result: EvaluationResultInput = {
        traceId: 'trace-2',
        evaluationId: 'eval-2',
        metrics: {
          faithfulness: { score: 0.4 },
          contextRelevance: { score: 0.9 },
        },
      };

      const alerts = await handler.checkAndAlert(result);

      const alert = alerts.find(a => a.type === 'FAITHFULNESS_LOW');
      expect(alert).toBeDefined();
      expect(alert?.severity).toBeDefined();
      expect(alert?.status).toBe('active');
    });
  });

  describe('processAlert - storage and broadcast', () => {
    it('should call storage.saveAlert for each alert', async () => {
      const result: EvaluationResultInput = {
        traceId: 'trace-3',
        evaluationId: 'eval-3',
        metrics: {
          faithfulness: { score: 0.3 },
          contextRelevance: { score: 0.5 },
        },
      };

      await handler.checkAndAlert(result);

      // Should have saved alerts to storage
      expect(mockStorage.saveAlert).toHaveBeenCalled();
    });

    it('should broadcast alert when broadcast function is set', async () => {
      const result: EvaluationResultInput = {
        traceId: 'trace-4',
        evaluationId: 'eval-4',
        metrics: {
          faithfulness: { score: 0.3 },
          contextRelevance: { score: 0.9 },
        },
      };

      await handler.checkAndAlert(result);

      // Should have broadcast alerts
      expect(broadcastFn).toHaveBeenCalled();
    });
  });

  describe('alert aggregation', () => {
    it('should aggregate similar alerts within time window', async () => {
      // First alert
      const result1: EvaluationResultInput = {
        traceId: 'trace-agg-1',
        evaluationId: 'eval-agg-1',
        metrics: {
          faithfulness: { score: 0.3 },
          contextRelevance: { score: 0.9 },
        },
      };

      await handler.checkAndAlert(result1);

      // Second similar alert
      const result2: EvaluationResultInput = {
        traceId: 'trace-agg-2',
        evaluationId: 'eval-agg-2',
        metrics: {
          faithfulness: { score: 0.25 },
          contextRelevance: { score: 0.9 },
        },
      };

      await handler.checkAndAlert(result2);

      // Both should be processed
      expect(mockStorage.saveAlert).toHaveBeenCalled();
    });
  });
});

// ==================== 任务 2.7.2: 告警阈值触发测试 ====================

describe('Alert Threshold Triggering (任务 2.7.2)', () => {
  let handler: AlertHandler;
  const thresholds = getAlertThresholds();

  beforeEach(() => {
    const mockStorage = {
      saveAlert: vi.fn().mockResolvedValue(undefined),
      getAlerts: vi.fn().mockResolvedValue([]),
      getAlert: vi.fn().mockResolvedValue(null),
      acknowledgeAlert: vi.fn().mockResolvedValue(undefined),
      resolveAlert: vi.fn().mockResolvedValue(undefined),
    } as unknown as TraceStorage;
    handler = new AlertHandler(mockStorage);
    handler.setBroadcast(vi.fn());
    vi.clearAllMocks();
  });

  describe('Safety threshold boundaries', () => {
    it('should trigger critical when safety < critical threshold', async () => {
      const result: EvaluationResultInput = {
        traceId: 'safety-critical',
        evaluationId: 'eval-1',
        metrics: {},
        extendedMetrics: {
          safetyAssessment: {
            score: thresholds.safetyCriticalThreshold - 0.01,
            severity: 'absolute',
          },
        },
      };

      const alerts = await handler.checkAndAlert(result);
      const critical = alerts.find(a => a.severity === 'critical');
      expect(critical).toBeDefined();
    });

    it('should trigger warning when safety between critical and warning thresholds', async () => {
      const result: EvaluationResultInput = {
        traceId: 'safety-warning',
        evaluationId: 'eval-2',
        metrics: {},
        extendedMetrics: {
          safetyAssessment: {
            score: thresholds.safetyCriticalThreshold + 0.1,
            severity: 'relative',
          },
        },
      };

      const alerts = await handler.checkAndAlert(result);
      const warning = alerts.find(a => a.severity === 'warning');
      expect(warning).toBeDefined();
    });

    it('should not trigger when safety above warning threshold', async () => {
      const result: EvaluationResultInput = {
        traceId: 'safety-safe',
        evaluationId: 'eval-3',
        metrics: {},
        extendedMetrics: {
          safetyAssessment: {
            score: thresholds.safetyWarningThreshold + 0.1,
            severity: 'safe',
          },
        },
      };

      const alerts = await handler.checkAndAlert(result);
      const safetyAlert = alerts.find(a => a.type === 'SAFETY_CRITICAL');
      expect(safetyAlert).toBeUndefined();
    });
  });

  describe('Faithfulness threshold boundaries', () => {
    it('should trigger when faithfulness < warning threshold', async () => {
      const result: EvaluationResultInput = {
        traceId: 'faithfulness-low',
        evaluationId: 'eval-1',
        metrics: {
          faithfulness: { score: thresholds.faithfulnessWarningThreshold - 0.01 },
          contextRelevance: { score: 0.9 },
        },
      };

      const alerts = await handler.checkAndAlert(result);
      const faithfulnessAlert = alerts.find(a => a.type === 'FAITHFULNESS_LOW');
      expect(faithfulnessAlert).toBeDefined();
    });

    it('should not trigger when faithfulness >= monitor threshold', async () => {
      const result: EvaluationResultInput = {
        traceId: 'faithfulness-ok',
        evaluationId: 'eval-2',
        metrics: {
          faithfulness: { score: thresholds.faithfulnessMonitorThreshold + 0.1 },
          contextRelevance: { score: 0.9 },
        },
      };

      const alerts = await handler.checkAndAlert(result);
      const faithfulnessAlert = alerts.find(a => a.type === 'FAITHFULNESS_LOW');
      expect(faithfulnessAlert).toBeUndefined();
    });
  });
});

// ==================== 任务 2.7.3: 告警广播测试 ====================

describe('Alert Broadcast Tests (任务 2.7.3)', () => {
  let handler: AlertHandler;
  let broadcastFn: ReturnType<typeof vi.fn>;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = {
      saveAlert: vi.fn().mockResolvedValue(undefined),
      getAlerts: vi.fn().mockResolvedValue([]),
      getAlert: vi.fn().mockResolvedValue(null),
      acknowledgeAlert: vi.fn().mockResolvedValue(undefined),
      resolveAlert: vi.fn().mockResolvedValue(undefined),
    } as unknown as TraceStorage;

    handler = new AlertHandler(mockStorage);
    broadcastFn = vi.fn();
    handler.setBroadcast(broadcastFn);
    vi.clearAllMocks();
  });

  it('should broadcast alert:new event for each triggered alert', async () => {
    const result: EvaluationResultInput = {
      traceId: 'broadcast-test',
      evaluationId: 'eval-1',
      metrics: {
        faithfulness: { score: 0.3 },
        contextRelevance: { score: 0.9 },
      },
    };

    await handler.checkAndAlert(result);

    expect(broadcastFn).toHaveBeenCalled();
    const call = broadcastFn.mock.calls[0]?.[0];
    expect(call?.type).toBe('alert:new');
    expect(call?.alert).toBeDefined();
  });

  it('should broadcast multiple alerts for multiple violations', async () => {
    const result: EvaluationResultInput = {
      traceId: 'multi-alert',
      evaluationId: 'eval-2',
      metrics: {
        faithfulness: { score: 0.3 },
        contextRelevance: { score: 0.3 },
      },
      extendedMetrics: {
        safetyAssessment: {
          score: 0.3,
          severity: 'absolute',
        },
      },
    };

    await handler.checkAndAlert(result);

    // Should broadcast for each alert type
    expect(broadcastFn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should not broadcast when no alerts triggered', async () => {
    const result: EvaluationResultInput = {
      traceId: 'no-alert',
      evaluationId: 'eval-3',
      metrics: {
        faithfulness: { score: 0.9 },
        contextRelevance: { score: 0.9 },
      },
    };

    await handler.checkAndAlert(result);

    expect(broadcastFn).not.toHaveBeenCalled();
  });
});

// ==================== 任务 2.7.4: 告警存储测试 ====================

describe('Alert Storage Tests (任务 2.7.4)', () => {
  let handler: AlertHandler;
  let mockStorage: TraceStorage;

  beforeEach(() => {
    mockStorage = {
      saveAlert: vi.fn().mockResolvedValue(undefined),
      getAlerts: vi.fn().mockResolvedValue([]),
      getAlert: vi.fn().mockResolvedValue(null),
      acknowledgeAlert: vi.fn().mockResolvedValue(undefined),
      resolveAlert: vi.fn().mockResolvedValue(undefined),
    } as unknown as TraceStorage;

    handler = new AlertHandler(mockStorage);
    handler.setBroadcast(vi.fn());
    vi.clearAllMocks();
  });

  it('should save alert to storage when triggered', async () => {
    const result: EvaluationResultInput = {
      traceId: 'storage-test',
      evaluationId: 'eval-1',
      metrics: {
        faithfulness: { score: 0.3 },
        contextRelevance: { score: 0.9 },
      },
    };

    await handler.checkAndAlert(result);

    expect((mockStorage as { saveAlert: ReturnType<typeof vi.fn> }).saveAlert).toHaveBeenCalled();
  });

  it('should save alert with correct structure', async () => {
    const result: EvaluationResultInput = {
      traceId: 'structure-test',
      evaluationId: 'eval-2',
      metrics: {
        faithfulness: { score: 0.3 },
        contextRelevance: { score: 0.9 },
      },
    };

    await handler.checkAndAlert(result);

    const saveCall = (mockStorage as { saveAlert: ReturnType<typeof vi.fn> }).saveAlert.mock.calls[0]?.[0];
    expect(saveCall).toBeDefined();
    expect(saveCall?.alertId).toBeDefined();
    expect(saveCall?.timestamp).toBeDefined();
    expect(saveCall?.type).toBeDefined();
    expect(saveCall?.traceId).toBe('structure-test');
  });

  it('should handle storage errors gracefully', async () => {
    const failingStorage = {
      saveAlert: vi.fn().mockRejectedValue(new Error('Storage error')),
      getAlerts: vi.fn().mockResolvedValue([]),
      getAlert: vi.fn().mockResolvedValue(null),
      acknowledgeAlert: vi.fn().mockResolvedValue(undefined),
      resolveAlert: vi.fn().mockResolvedValue(undefined),
    } as unknown as TraceStorage;

    const handlerWithFailingStorage = new AlertHandler(failingStorage);
    handlerWithFailingStorage.setBroadcast(vi.fn());

    const result: EvaluationResultInput = {
      traceId: 'error-test',
      evaluationId: 'eval-3',
      metrics: {
        faithfulness: { score: 0.3 },
        contextRelevance: { score: 0.9 },
      },
    };

    // Should not throw even if storage fails
    await expect(handlerWithFailingStorage.checkAndAlert(result)).resolves.toBeDefined();
  });
});