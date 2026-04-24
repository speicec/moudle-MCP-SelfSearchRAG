/**
 * TraceExporter Tests - OpenTelemetry 导出器测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraceExporter, createTraceExporter } from './TraceExporter.js';
import type { TraceContextData } from './types.js';

// Mock fetch
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
}));

describe('TraceExporter', () => {
  let exporter: TraceExporter;

  beforeEach(() => {
    vi.clearAllMocks();
    exporter = createTraceExporter({
      serviceName: 'test-service',
      enabled: true,
    });
  });

  describe('Exporter Creation', () => {
    it('should create exporter with default config', () => {
      const defaultExporter = createTraceExporter();
      expect(defaultExporter.getConfig().serviceName).toBe('medical-rag-agent');
    });

    it('should accept custom config', () => {
      expect(exporter.getConfig().serviceName).toBe('test-service');
    });
  });

  describe('OTLP Conversion', () => {
    it('should convert trace data to OTLP format', () => {
      const traceData: TraceContextData = {
        traceId: 'test-trace-123',
        query: { raw: 'test query', rewritten: 'rewritten query' },
        status: 'completed',
        startTime: Date.now() - 100,
        endTime: Date.now(),
        durationMs: 100,
        answer: { text: 'test answer', confidence: 0.85, sources: ['source1'] },
        retrieval: { chunks: [], topK: 0 },
        spans: [],
        phases: [],
        llmCalls: [],
      };

      const otlp = exporter.convertToOTLP(traceData);

      expect(otlp.resourceSpans).toHaveLength(1);
      expect(otlp.resourceSpans[0].scopeSpans).toHaveLength(1);
      expect(otlp.resourceSpans[0].scopeSpans[0].spans.length).toBeGreaterThan(0);
    });

    it('should include resource attributes', () => {
      const traceData: TraceContextData = {
        traceId: 'test-trace',
        query: { raw: 'test' },
        status: 'completed',
        startTime: Date.now(),
        endTime: Date.now(),
        durationMs: 0,
      };

      const otlp = exporter.convertToOTLP(traceData);
      const attrs = otlp.resourceSpans[0].resource.attributes;

      expect(attrs['service.name']).toBe('test-service');
    });

    it('should include span attributes', () => {
      const traceData: TraceContextData = {
        traceId: 'test-trace',
        query: { raw: 'test query' },
        status: 'completed',
        startTime: Date.now() - 100,
        endTime: Date.now(),
        durationMs: 100,
        answer: { text: 'answer', confidence: 0.9 },
      };

      const otlp = exporter.convertToOTLP(traceData);
      const mainSpan = otlp.resourceSpans[0].scopeSpans[0].spans[0];

      expect(mainSpan.attributes['query.raw']).toBe('test query');
      expect(mainSpan.attributes['answer.confidence']).toBe(0.9);
    });

    it('should convert child spans', () => {
      const traceData: TraceContextData = {
        traceId: 'test-trace',
        query: { raw: 'test' },
        status: 'completed',
        startTime: Date.now() - 100,
        endTime: Date.now(),
        durationMs: 100,
        spans: [
          {
            spanId: 'span-1',
            phase: 'retrieval',
            startTime: Date.now() - 80,
            endTime: Date.now() - 60,
            durationMs: 20,
            input: { query: 'test' },
            output: { results: [] },
          },
        ],
      };

      const otlp = exporter.convertToOTLP(traceData);
      const spans = otlp.resourceSpans[0].scopeSpans[0].spans;

      // 应有主 span + 子 span
      expect(spans.length).toBeGreaterThanOrEqual(2);
    });

    it('should convert retrieval chunks', () => {
      const traceData: TraceContextData = {
        traceId: 'test-trace',
        query: { raw: 'test' },
        status: 'completed',
        startTime: Date.now() - 100,
        endTime: Date.now(),
        durationMs: 100,
        retrieval: {
          chunks: [
            { chunkId: 'chunk-1', content: 'content', similarityScore: 0.85, metadata: { source: 'doc1' } },
          ],
          topK: 1,
        },
      };

      const otlp = exporter.convertToOTLP(traceData);
      const spans = otlp.resourceSpans[0].scopeSpans[0].spans;

      // 应有 retrieval chunk span
      const retrievalSpan = spans.find(s => s.name === 'retrieval.chunk');
      expect(retrievalSpan).toBeDefined();
    });
  });

  describe('Export Functionality', () => {
    it('should export trace data', async () => {
      const traceData: TraceContextData = {
        traceId: 'test-trace',
        query: { raw: 'test' },
        status: 'completed',
        startTime: Date.now(),
        endTime: Date.now(),
        durationMs: 0,
      };

      const result = await exporter.export(traceData);
      expect(result).toBe(true);
    });

    it('should not export when disabled', async () => {
      const disabledExporter = createTraceExporter({ enabled: false });

      const traceData: TraceContextData = {
        traceId: 'test-trace',
        query: { raw: 'test' },
        status: 'completed',
        startTime: Date.now(),
        endTime: Date.now(),
        durationMs: 0,
      };

      const result = await disabledExporter.export(traceData);
      expect(result).toBe(false);
    });

    it('should handle export failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }));

      const traceData: TraceContextData = {
        traceId: 'test-trace',
        query: { raw: 'test' },
        status: 'completed',
        startTime: Date.now(),
        endTime: Date.now(),
        durationMs: 0,
      };

      const result = await exporter.export(traceData);
      expect(result).toBe(false);
    });
  });

  describe('Batch Export', () => {
    it('should export batch of traces', async () => {
      // Reset fetch mock for this test
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }));

      const traces: TraceContextData[] = [
        { traceId: 'trace-1', query: { raw: 'test1' }, status: 'completed', startTime: Date.now(), endTime: Date.now(), durationMs: 0 },
        { traceId: 'trace-2', query: { raw: 'test2' }, status: 'completed', startTime: Date.now(), endTime: Date.now(), durationMs: 0 },
      ];

      const result = await exporter.exportBatch(traces);
      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe('Config Update', () => {
    it('should update config', () => {
      exporter.updateConfig({ serviceName: 'new-service' });
      expect(exporter.getConfig().serviceName).toBe('new-service');
    });
  });
});