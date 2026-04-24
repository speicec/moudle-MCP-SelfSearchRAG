/**
 * TraceContext Tests - 追踪上下文测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TraceContext, createTraceContext } from './TraceContext.js';
import type { TraceSpan, RetrievedChunk, LLMCallRecord } from './types.js';

describe('TraceContext', () => {
  let context: TraceContext;

  beforeEach(() => {
    context = createTraceContext('test-session');
  });

  describe('Trace ID Generation', () => {
    it('should generate valid UUID v4 traceId', () => {
      const traceId = context.getTraceId();
      expect(traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique traceIds', () => {
      const context2 = createTraceContext();
      expect(context.getTraceId()).not.toBe(context2.getTraceId());
    });
  });

  describe('Session Association', () => {
    it('should store sessionId when provided', () => {
      const contextWithSession = createTraceContext('session-123');
      const data = contextWithSession.build();
      expect(data.sessionId).toBe('session-123');
    });

    it('should allow undefined sessionId', () => {
      const contextWithoutSession = createTraceContext();
      const data = contextWithoutSession.build();
      expect(data.sessionId).toBeUndefined();
    });
  });

  describe('Query Information', () => {
    it('should record raw query', () => {
      context.setQuery('高血压患者如何选择降压药？');
      const data = context.build();
      expect(data.query.raw).toBe('高血压患者如何选择降压药？');
    });

    it('should record rewritten query', () => {
      context.setQuery('高血压患者如何选择降压药？', '高血压 药物选择 指南');
      const data = context.build();
      expect(data.query.raw).toBe('高血压患者如何选择降压药？');
      expect(data.query.rewritten).toBe('高血压 药物选择 指南');
    });

    it('should record entities', () => {
      const entities = {
        diseases: [{ id: 'disease_hypertension', canonicalName: '高血压', matchedTerm: '高血压', aliases: [] }],
        drugs: [],
        indicators: [],
        relations: [],
        rawQuery: '高血压患者如何选择降压药？',
        confidence: 0.9,
      };
      context.setEntities(entities);
      const data = context.build();
      expect(data.query.entities).toEqual(entities);
    });

    it('should record complexity assessment', () => {
      const complexity = {
        level: 'moderate',
        entityCount: 2,
        hasComparison: false,
        hasConditions: true,
        hasInteraction: false,
        needsPlanning: true,
        reason: '包含条件查询',
      };
      context.setComplexity(complexity);
      const data = context.build();
      expect(data.query.complexity).toEqual(complexity);
    });
  });

  describe('Phase Recording', () => {
    it('should record single span', () => {
      const span: TraceSpan = {
        spanId: 'input-1',
        phase: 'input',
        startTime: Date.now() - 100,
        endTime: Date.now(),
        durationMs: 100,
        input: { query: 'test' },
        output: { query: 'test' },
      };
      context.recordSpan(span);
      expect(context.getSpanCount()).toBe(1);
    });

    it('should record multiple spans in order', () => {
      const spans: TraceSpan[] = [
        {
          spanId: 'input-1',
          phase: 'input',
          startTime: 100,
          endTime: 150,
          durationMs: 50,
          input: { query: 'test' },
          output: { query: 'test' },
        },
        {
          spanId: 'entity-2',
          phase: 'entityRecognition',
          startTime: 150,
          endTime: 200,
          durationMs: 50,
          input: { query: 'test' },
          output: { entities: [] },
        },
      ];

      spans.forEach(s => context.recordSpan(s));
      const data = context.build();
      expect(data.phases).toHaveLength(2);
      expect(data.phases[0].phase).toBe('input');
      expect(data.phases[1].phase).toBe('entityRecognition');
    });

    it('should record nested spans with parentSpanId', () => {
      const parentSpan: TraceSpan = {
        spanId: 'execution-1',
        phase: 'execution',
        startTime: 100,
        endTime: 300,
        durationMs: 200,
        input: {},
        output: {},
      };

      const childSpan: TraceSpan = {
        spanId: 'retrieve-2',
        parentSpanId: 'execution-1',
        phase: 'execution',
        startTime: 150,
        endTime: 250,
        durationMs: 100,
        input: { query: 'test' },
        output: { results: [] },
      };

      context.recordSpan(parentSpan);
      context.recordSpan(childSpan);
      const data = context.build();
      expect(data.phases[1].parentSpanId).toBe('execution-1');
    });

    it('should record span metadata', () => {
      const span: TraceSpan = {
        spanId: 'input-1',
        phase: 'input',
        startTime: 100,
        endTime: 150,
        durationMs: 50,
        input: {},
        output: {},
        metadata: { usedLLM: true, customField: 'value' },
      };
      context.recordSpan(span);
      const data = context.build();
      expect(data.phases[0].metadata).toEqual({ usedLLM: true, customField: 'value' });
    });
  });

  describe('LLM Call Recording', () => {
    it('should record LLM call', () => {
      const call: LLMCallRecord = {
        callId: 'llm-1',
        model: 'deepseek-reasoner',
        provider: 'deepseek',
        latencyMs: 1500,
        phase: 'planning',
      };
      context.recordLLMCall(call);
      expect(context.getLLMCallCount()).toBe(1);
    });

    it('should record multiple LLM calls', () => {
      const calls: LLMCallRecord[] = [
        {
          callId: 'llm-1',
          model: 'deepseek-reasoner',
          provider: 'deepseek',
          latencyMs: 1500,
          phase: 'planning',
        },
        {
          callId: 'llm-2',
          model: 'deepseek-reasoner',
          provider: 'deepseek',
          latencyMs: 2000,
          phase: 'answer',
        },
      ];

      calls.forEach(c => context.recordLLMCall(c));
      expect(context.getLLMCallCount()).toBe(2);
    });

    it('should record token information', () => {
      const call: LLMCallRecord = {
        callId: 'llm-1',
        model: 'deepseek-reasoner',
        provider: 'deepseek',
        promptTokens: 500,
        completionTokens: 300,
        latencyMs: 1500,
      };
      context.recordLLMCall(call);
      const data = context.build();
      expect(data.llmCalls[0].promptTokens).toBe(500);
      expect(data.llmCalls[0].completionTokens).toBe(300);
    });

    it('should record prompt/response preview', () => {
      const call: LLMCallRecord = {
        callId: 'llm-1',
        model: 'deepseek-reasoner',
        provider: 'deepseek',
        latencyMs: 1500,
        promptPreview: '请分析以下...',
        responsePreview: '根据分析...',
      };
      context.recordLLMCall(call);
      const data = context.build();
      expect(data.llmCalls[0].promptPreview).toBe('请分析以下...');
      expect(data.llmCalls[0].responsePreview).toBe('根据分析...');
    });
  });

  describe('Retrieval Recording', () => {
    it('should record retrieval chunks', () => {
      const chunks: RetrievedChunk[] = [
        {
          chunkId: 'chunk-1',
          content: 'ADA指南建议...',
          sourceDocumentId: 'doc-ada-2024',
          sourcePage: 123,
          similarityScore: 0.85,
          confidenceLevel: 'high',
          source: 'hybrid',
        },
        {
          chunkId: 'chunk-2',
          content: 'KDIGO指南...',
          sourceDocumentId: 'doc-kdigo-2023',
          similarityScore: 0.72,
          confidenceLevel: 'medium',
          source: 'dense',
        },
      ];

      context.recordRetrieval(chunks);
      expect(context.getChunkCount()).toBe(2);
    });

    it('should set retrieval config', () => {
      context.setRetrievalConfig({ topK: 15, threshold: 0.4, mode: 'sparse' });
      const data = context.build();
      expect(data.retrieval.topK).toBe(15);
      expect(data.retrieval.threshold).toBe(0.4);
      expect(data.retrieval.mode).toBe('sparse');
    });

    it('should use chunk count as topK when chunks recorded', () => {
      const chunks: RetrievedChunk[] = [
        {
          chunkId: 'chunk-1',
          content: 'test',
          sourceDocumentId: 'doc-1',
          similarityScore: 0.8,
          confidenceLevel: 'high',
          source: 'hybrid',
        },
      ];

      context.setRetrievalConfig({ topK: 20 });
      context.recordRetrieval(chunks);
      const data = context.build();
      expect(data.retrieval.topK).toBe(1);
    });
  });

  describe('Answer Recording', () => {
    it('should record answer text', () => {
      context.setAnswer('建议使用二甲双胍作为首选药物...');
      const data = context.build();
      expect(data.answer.text).toBe('建议使用二甲双胍作为首选药物...');
    });

    it('should record answer confidence', () => {
      context.setAnswer('建议使用二甲双胍...', 0.85);
      const data = context.build();
      expect(data.answer.confidence).toBe(0.85);
    });

    it('should record answer sources', () => {
      context.setAnswer('建议使用二甲双胍...', undefined, ['ADA 2024', 'KDIGO 2023']);
      const data = context.build();
      expect(data.answer.sources).toEqual(['ADA 2024', 'KDIGO 2023']);
    });
  });

  describe('Status Management', () => {
    it('should start with running status', () => {
      expect(context.getStatus()).toBe('running');
    });

    it('should change to completed status', () => {
      context.complete();
      expect(context.getStatus()).toBe('completed');
      const data = context.build();
      expect(data.status).toBe('completed');
    });

    it('should change to failed status with error', () => {
      context.fail('检索失败');
      expect(context.getStatus()).toBe('failed');
      const data = context.build();
      expect(data.status).toBe('failed');
      expect(data.error).toBe('检索失败');
    });
  });

  describe('Build Output', () => {
    it('should build complete TraceContextData', () => {
      context.setQuery('test query', 'rewritten');
      context.setAnswer('test answer');

      const data = context.build();
      expect(data.traceId).toBe(context.getTraceId());
      expect(data.timestamp).toBeDefined();
      expect(data.query.raw).toBe('test query');
      expect(data.answer.text).toBe('test answer');
      expect(data.evaluation).toBeUndefined();
    });

    it('should include timestamp in ISO format', () => {
      const data = context.build();
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should calculate total duration', () => {
      const now = Date.now();
      context.recordSpan({
        spanId: 'span-1',
        phase: 'input',
        startTime: now - 100,
        endTime: now - 50,
        durationMs: 50,
        input: {},
        output: {},
      });
      context.recordSpan({
        spanId: 'span-2',
        phase: 'answer',
        startTime: now - 50,
        endTime: now,
        durationMs: 50,
        input: {},
        output: {},
      });

      expect(context.getTotalDurationMs()).toBe(100);
    });

    it('should return 0 duration for empty spans', () => {
      expect(context.getTotalDurationMs()).toBe(0);
    });
  });

  describe('endSpan method', () => {
    it('should create and record span using endSpan', () => {
      const spanId = context.createSpan('input', { query: 'test' });
      const startTime = Date.now() - 100;
      context.endSpan(spanId, 'input', startTime, { query: 'test' }, { query: 'test' });

      expect(context.getSpanCount()).toBe(1);
      const data = context.build();
      expect(data.phases[0].spanId).toBe(spanId);
      expect(data.phases[0].durationMs).toBeGreaterThanOrEqual(100);
    });
  });
});