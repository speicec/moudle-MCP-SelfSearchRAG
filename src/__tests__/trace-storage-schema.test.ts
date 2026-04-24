/**
 * TraceStorage Schema Migration Tests
 *
 * Tests for verifying the new schema tables and indexes:
 * - alerts table (AlertHandler)
 * - human_review_queue table (HumanReviewQueue)
 * - scale_events table (EvaluationAutoscaler)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TraceStorage } from '../tracing/TraceStorage.js';
import type { AlertEvent, ReviewItem, ScaleEvent } from '../alert/types.js';

describe('TraceStorage Schema Migration', () => {
  let storage: TraceStorage;

  beforeEach(async () => {
    storage = new TraceStorage(':memory:');
    await storage.init();
  });

  afterEach(() => {
    storage.close();
  });

  describe('Schema Initialization', () => {
    it('should initialize all required tables', async () => {
      const tables = storage.getTables();

      expect(tables).toContain('traces');
      expect(tables).toContain('spans');
      expect(tables).toContain('llm_calls');
      expect(tables).toContain('evaluations');
      expect(tables).toContain('alerts');
      expect(tables).toContain('human_review_queue');
      expect(tables).toContain('scale_events');
    });

    it('should create all required indexes', async () => {
      const indexes = storage.getIndexes();

      // Core indexes
      expect(indexes.some(idx => idx.includes('idx_traces_timestamp'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_traces_session'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_traces_status'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_spans_trace'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_spans_phase'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_llm_calls_trace'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_evaluations_trace'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_evaluations_timestamp'))).toBe(true);

      // Alert indexes
      expect(indexes.some(idx => idx.includes('idx_alerts_status'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_alerts_type'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_alerts_timestamp'))).toBe(true);

      // Review queue indexes
      expect(indexes.some(idx => idx.includes('idx_review_status'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_review_priority'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_review_created'))).toBe(true);

      // Scale events indexes
      expect(indexes.some(idx => idx.includes('idx_scale_timestamp'))).toBe(true);
      expect(indexes.some(idx => idx.includes('idx_scale_type'))).toBe(true);
    });
  });

  describe('Alerts Table Schema', () => {
    it('should have correct column structure', async () => {
      const columns = storage.getTableColumns('alerts');

      expect(columns).toContain('alert_id');
      expect(columns).toContain('timestamp');
      expect(columns).toContain('type');
      expect(columns).toContain('severity');
      expect(columns).toContain('trace_id');
      expect(columns).toContain('evaluation_id');
      expect(columns).toContain('details_json');
      expect(columns).toContain('suggested_actions_json');
      expect(columns).toContain('status');
      expect(columns).toContain('acknowledged_by');
      expect(columns).toContain('resolved_at');
    });

    it('should store and retrieve alert correctly', async () => {
      const alert: AlertEvent = {
        alertId: 'alert-001',
        timestamp: new Date().toISOString(),
        type: 'SAFETY_CRITICAL',
        severity: 'critical',
        traceId: 'trace-001',
        evaluationId: 'eval-001',
        details: {
          safetyScore: 0.3,
          threshold: 0.5,
          delta: -0.2,
          contraindication: 'Drug X contraindicated with Drug Y',
          dangerousAdvice: ['Suggest taking Drug X']
        },
        suggestedActions: ['阻止答案发布', '立即人工审核'],
        status: 'active'
      };

      await storage.saveAlert(alert);
      const retrieved = storage.getAlert('alert-001');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.alertId).toBe('alert-001');
      expect(retrieved?.type).toBe('SAFETY_CRITICAL');
      expect(retrieved?.severity).toBe('critical');
      expect(retrieved?.status).toBe('active');
      expect(retrieved?.details).toEqual(alert.details);
      expect(retrieved?.suggestedActions).toEqual(alert.suggestedActions);
    });

    it('should support alert status transitions', async () => {
      const alert: AlertEvent = {
        alertId: 'alert-002',
        timestamp: new Date().toISOString(),
        type: 'FAITHFULNESS_LOW',
        severity: 'warning',
        details: {
          metric: 'faithfulness',
          value: 0.45,
          threshold: 0.5,
          delta: -0.05,
          unsupportedCount: 3
        },
        suggestedActions: ['触发二次检索'],
        status: 'active'
      };

      await storage.saveAlert(alert);

      await storage.acknowledgeAlert('alert-002', 'admin@example.com');
      const acknowledged = storage.getAlert('alert-002');
      expect(acknowledged?.status).toBe('acknowledged');
      expect(acknowledged?.acknowledgedBy).toBe('admin@example.com');

      await storage.resolveAlert('alert-002');
      const resolved = storage.getAlert('alert-002');
      expect(resolved?.status).toBe('resolved');
      expect(resolved?.resolvedAt).toBeDefined();
    });

    it('should filter alerts by status and type', async () => {
      const alerts: AlertEvent[] = [
        {
          alertId: 'alert-a',
          timestamp: new Date().toISOString(),
          type: 'SAFETY_CRITICAL',
          severity: 'critical',
          details: { safetyScore: 0.3, threshold: 0.5, delta: -0.2 },
          suggestedActions: [],
          status: 'active'
        },
        {
          alertId: 'alert-b',
          timestamp: new Date().toISOString(),
          type: 'FAITHFULNESS_LOW',
          severity: 'warning',
          details: { metric: 'faithfulness', value: 0.4, threshold: 0.5, delta: -0.1 },
          suggestedActions: [],
          status: 'active'
        },
        {
          alertId: 'alert-c',
          timestamp: new Date().toISOString(),
          type: 'SAFETY_CRITICAL',
          severity: 'critical',
          details: { safetyScore: 0.35, threshold: 0.5, delta: -0.15 },
          suggestedActions: [],
          status: 'resolved'
        }
      ];

      for (const alert of alerts) {
        await storage.saveAlert(alert);
      }

      const activeAlerts = storage.getAlerts({ status: 'active' });
      expect(activeAlerts.length).toBe(2);

      const safetyAlerts = storage.getAlerts({ type: 'SAFETY_CRITICAL' });
      expect(safetyAlerts.length).toBe(2);

      const activeSafetyAlerts = storage.getAlerts({ status: 'active', type: 'SAFETY_CRITICAL' });
      expect(activeSafetyAlerts.length).toBe(1);
    });
  });

  describe('Human Review Queue Table Schema', () => {
    it('should have correct column structure', async () => {
      const columns = storage.getTableColumns('human_review_queue');

      expect(columns).toContain('review_id');
      expect(columns).toContain('trace_id');
      expect(columns).toContain('evaluation_id');
      expect(columns).toContain('alert_id');
      expect(columns).toContain('status');
      expect(columns).toContain('priority');
      expect(columns).toContain('created_at');
      expect(columns).toContain('assigned_to');
      expect(columns).toContain('reviewed_at');
      expect(columns).toContain('resolved_at');
      expect(columns).toContain('review_notes');
      expect(columns).toContain('result');
      expect(columns).toContain('details_json');
    });

    it('should store and retrieve review item correctly', async () => {
      const item: ReviewItem = {
        reviewId: 'review-001',
        traceId: 'trace-001',
        evaluationId: 'eval-001',
        alertId: 'alert-001',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date().toISOString(),
        details: {
          query: 'What is the recommended dosage for Drug X?',
          answer: 'Take 500mg daily.',
          safetyScore: 0.3,
          contraindication: 'Drug X contraindicated with Drug Y',
          dangerousAdvice: ['Suggest taking Drug X']
        }
      };

      await storage.saveReviewItem(item);
      const items = storage.getReviewItems({ status: 'pending' });

      expect(items.length).toBe(1);
      expect(items[0]?.reviewId).toBe('review-001');
      expect(items[0]?.priority).toBe('critical');
      expect(items[0]?.details.query).toBe('What is the recommended dosage for Drug X?');
    });

    it('should support review workflow transitions', async () => {
      const item: ReviewItem = {
        reviewId: 'review-002',
        traceId: 'trace-002',
        evaluationId: 'eval-002',
        status: 'pending',
        priority: 'high',
        createdAt: new Date().toISOString(),
        details: {
          query: 'Test query',
          answer: 'Test answer',
          faithfulness: 0.45
        }
      };

      await storage.saveReviewItem(item);

      await storage.updateReviewItem('review-002', {
        status: 'assigned',
        assignedTo: 'reviewer@example.com'
      });

      const assigned = storage.getReviewItems({ status: 'assigned' });
      expect(assigned[0]?.assignedTo).toBe('reviewer@example.com');

      await storage.updateReviewItem('review-002', {
        status: 'reviewed',
        reviewedAt: new Date().toISOString(),
        reviewNotes: 'Answer needs modification',
        result: 'modified'
      });

      const reviewed = storage.getReviewItems({ status: 'reviewed' });
      expect(reviewed[0]?.reviewNotes).toBe('Answer needs modification');
      expect(reviewed[0]?.result).toBe('modified');
    });

    it('should sort review items by priority', async () => {
      const items: ReviewItem[] = [
        {
          reviewId: 'review-low',
          traceId: 'trace-low',
          evaluationId: 'eval-low',
          status: 'pending',
          priority: 'low',
          createdAt: new Date().toISOString(),
          details: { query: 'q1', answer: 'a1' }
        },
        {
          reviewId: 'review-critical',
          traceId: 'trace-critical',
          evaluationId: 'eval-critical',
          status: 'pending',
          priority: 'critical',
          createdAt: new Date().toISOString(),
          details: { query: 'q2', answer: 'a2' }
        },
        {
          reviewId: 'review-medium',
          traceId: 'trace-medium',
          evaluationId: 'eval-medium',
          status: 'pending',
          priority: 'medium',
          createdAt: new Date().toISOString(),
          details: { query: 'q3', answer: 'a3' }
        }
      ];

      for (const item of items) {
        await storage.saveReviewItem(item);
      }

      const pendingItems = storage.getReviewItems({ status: 'pending' });

      expect(pendingItems[0]?.priority).toBe('critical');
      expect(pendingItems[1]?.priority).toBe('medium');
      expect(pendingItems[2]?.priority).toBe('low');
    });

    it('should count review items by status', async () => {
      const items: ReviewItem[] = [
        {
          reviewId: 'r1',
          traceId: 't1',
          evaluationId: 'e1',
          status: 'pending',
          priority: 'medium',
          createdAt: new Date().toISOString(),
          details: { query: 'q', answer: 'a' }
        },
        {
          reviewId: 'r2',
          traceId: 't2',
          evaluationId: 'e2',
          status: 'pending',
          priority: 'high',
          createdAt: new Date().toISOString(),
          details: { query: 'q', answer: 'a' }
        },
        {
          reviewId: 'r3',
          traceId: 't3',
          evaluationId: 'e3',
          status: 'assigned',
          priority: 'critical',
          createdAt: new Date().toISOString(),
          details: { query: 'q', answer: 'a' }
        }
      ];

      for (const item of items) {
        await storage.saveReviewItem(item);
      }

      expect(storage.getReviewCount('pending')).toBe(2);
      expect(storage.getReviewCount('assigned')).toBe(1);
      expect(storage.getReviewCount()).toBe(3);
    });
  });

  describe('Scale Events Table Schema', () => {
    it('should have correct column structure', async () => {
      const columns = storage.getTableColumns('scale_events');

      expect(columns).toContain('event_id');
      expect(columns).toContain('timestamp');
      expect(columns).toContain('type');
      expect(columns).toContain('from_replicas');
      expect(columns).toContain('to_replicas');
      expect(columns).toContain('reason');
      expect(columns).toContain('triggered_by');
      expect(columns).toContain('success');
      expect(columns).toContain('error');
    });

    it('should store and retrieve scale event correctly', async () => {
      const event: ScaleEvent = {
        eventId: 'scale-001',
        timestamp: new Date().toISOString(),
        type: 'scale_up',
        fromReplicas: 2,
        toReplicas: 4,
        reason: 'Queue backlog exceeded threshold (waiting: 75 > 50)',
        triggeredBy: 'autoscaler',
        success: true
      };

      await storage.saveScaleEvent(event);
      const events = storage.getScaleEvents(10);

      expect(events.length).toBe(1);
      expect(events[0]?.eventId).toBe('scale-001');
      expect(events[0]?.type).toBe('scale_up');
      expect(events[0]?.fromReplicas).toBe(2);
      expect(events[0]?.toReplicas).toBe(4);
      expect(events[0]?.success).toBe(true);
    });

    it('should store failed scale event with error', async () => {
      const event: ScaleEvent = {
        eventId: 'scale-002',
        timestamp: new Date().toISOString(),
        type: 'scale_up',
        fromReplicas: 2,
        toReplicas: 6,
        reason: 'Manual scale request',
        triggeredBy: 'manual',
        success: false,
        error: 'Docker API timeout'
      };

      await storage.saveScaleEvent(event);
      const events = storage.getScaleEvents();

      expect(events[0]?.success).toBe(false);
      expect(events[0]?.error).toBe('Docker API timeout');
    });

    it('should store multiple scale events in order', async () => {
      const events: ScaleEvent[] = [
        {
          eventId: 's1',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          type: 'scale_up',
          fromReplicas: 1,
          toReplicas: 2,
          reason: 'Initial scale up',
          triggeredBy: 'autoscaler',
          success: true
        },
        {
          eventId: 's2',
          timestamp: new Date(Date.now() - 30000).toISOString(),
          type: 'scale_down',
          fromReplicas: 2,
          toReplicas: 1,
          reason: 'Queue empty',
          triggeredBy: 'autoscaler',
          success: true
        },
        {
          eventId: 's3',
          timestamp: new Date().toISOString(),
          type: 'manual_scale',
          fromReplicas: 1,
          toReplicas: 3,
          reason: 'Manual request',
          triggeredBy: 'manual',
          success: true
        }
      ];

      for (const event of events) {
        await storage.saveScaleEvent(event);
      }

      const retrieved = storage.getScaleEvents();

      expect(retrieved.length).toBe(3);
      expect(retrieved[0]?.eventId).toBe('s3');
      expect(retrieved[1]?.eventId).toBe('s2');
      expect(retrieved[2]?.eventId).toBe('s1');
    });
  });

  describe('Migration from Legacy Schema', () => {
    it('should add new tables when migrating from legacy schema', async () => {
      const legacySchema = `
        -- Legacy schema without new tables
        CREATE TABLE IF NOT EXISTS traces (
          trace_id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          status TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS spans (
          span_id TEXT PRIMARY KEY,
          trace_id TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS llm_calls (
          call_id TEXT PRIMARY KEY,
          trace_id TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS evaluations (
          evaluation_id TEXT PRIMARY KEY,
          trace_id TEXT NOT NULL
        );
      `;

      const legacyStorage = new TraceStorage(':memory:');
      await legacyStorage.init();

      const tables = legacyStorage.getTables();

      expect(tables).toContain('alerts');
      expect(tables).toContain('human_review_queue');
      expect(tables).toContain('scale_events');

      legacyStorage.close();
    });

    it('should preserve existing data during migration', async () => {
      const storage2 = new TraceStorage(':memory:');
      await storage2.init();

      const alert: AlertEvent = {
        alertId: 'migrate-test',
        timestamp: new Date().toISOString(),
        type: 'SAFETY_CRITICAL',
        severity: 'critical',
        details: { safetyScore: 0.3, threshold: 0.5, delta: -0.2 },
        suggestedActions: [],
        status: 'active'
      };

      await storage2.saveAlert(alert);
      await storage2.persist();

      const retrieved = storage2.getAlert('migrate-test');
      expect(retrieved).not.toBeNull();

      storage2.close();
    });
  });

  describe('Data Cleanup', () => {
    it('should clear all tables including new ones', async () => {
      const alert: AlertEvent = {
        alertId: 'clear-test',
        timestamp: new Date().toISOString(),
        type: 'QUEUE_BACKLOG',
        severity: 'warning',
        details: { waiting: 75, threshold: 50 },
        suggestedActions: [],
        status: 'active'
      };

      const item: ReviewItem = {
        reviewId: 'clear-review',
        traceId: 'clear-trace',
        evaluationId: 'clear-eval',
        status: 'pending',
        priority: 'medium',
        createdAt: new Date().toISOString(),
        details: { query: 'q', answer: 'a' }
      };

      const event: ScaleEvent = {
        eventId: 'clear-scale',
        timestamp: new Date().toISOString(),
        type: 'scale_up',
        fromReplicas: 1,
        toReplicas: 2,
        reason: 'test',
        triggeredBy: 'manual',
        success: true
      };

      await storage.saveAlert(alert);
      await storage.saveReviewItem(item);
      await storage.saveScaleEvent(event);

      await storage.clear();

      expect(storage.getAlerts().length).toBe(0);
      expect(storage.getReviewItems().length).toBe(0);
      expect(storage.getScaleEvents().length).toBe(0);
    });
  });
});