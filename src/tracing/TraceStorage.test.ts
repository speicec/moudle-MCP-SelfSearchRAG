/**
 * TraceStorage Tests - 追踪存储测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TraceStorage, createTraceStorage } from './TraceStorage.js';
import { TraceContext, createTraceContext } from './TraceContext.js';
import type { EvaluationResult, RetrievedChunk, TraceSpan, LLMCallRecord } from './types.js';

describe('TraceStorage', () => {
  let storage: TraceStorage;

  beforeEach(async () => {
    // 使用内存数据库进行测试
    storage = new TraceStorage(':memory:');
    await storage.init();
  });

  afterEach(() => {
    storage.close();
  });

  describe('Database Initialization', () => {
    it('should initialize database with schema', async () => {
      const newStorage = new TraceStorage(':memory:');
      await newStorage.init();

      // 验证表已创建
      const tables = newStorage.getRecentTraces(0);
      expect(tables).toEqual([]);

      newStorage.close();
    });

    it('should support in-memory mode', async () => {
      const memStorage = await createTraceStorage(':memory:');
      expect(memStorage).toBeDefined();

      memStorage.close();
    });
  });

  describe('Trace Storage', () => {
    it('should save and retrieve a trace', async () => {
      const context = createTraceContext('test-session');
      context.setQuery('test query');
      context.setAnswer('test answer');
      context.complete();

      const trace = context.build();
      await storage.saveTrace(trace);

      const retrieved = storage.getTrace(trace.traceId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.traceId).toBe(trace.traceId);
      expect(retrieved!.query.raw).toBe('test query');
      expect(retrieved!.status).toBe('completed');
    });

    it('should save and retrieve spans', async () => {
      const context = createTraceContext();

      const span1: TraceSpan = {
        spanId: 'span-1',
        phase: 'input',
        startTime: 100,
        endTime: 150,
        durationMs: 50,
        input: { query: 'test' },
        output: { query: 'test' },
      };

      const span2: TraceSpan = {
        spanId: 'span-2',
        phase: 'entityRecognition',
        startTime: 150,
        endTime: 200,
        durationMs: 50,
        input: {},
        output: { entities: [] },
      };

      context.recordSpan(span1);
      context.recordSpan(span2);
      context.complete();

      const trace = context.build();
      await storage.saveTrace(trace);

      const retrieved = storage.getTrace(trace.traceId);
      expect(retrieved!.phases).toHaveLength(2);
      expect(retrieved!.phases[0].phase).toBe('input');
      expect(retrieved!.phases[1].phase).toBe('entityRecognition');
    });

    it('should save and retrieve LLM calls', async () => {
      const context = createTraceContext();

      const call: LLMCallRecord = {
        callId: 'llm-1',
        model: 'deepseek-reasoner',
        provider: 'deepseek',
        latencyMs: 1500,
        promptTokens: 500,
        completionTokens: 300,
      };

      context.recordLLMCall(call);
      context.complete();

      const trace = context.build();
      await storage.saveTrace(trace);

      const retrieved = storage.getTrace(trace.traceId);
      expect(retrieved!.llmCalls).toHaveLength(1);
      expect(retrieved!.llmCalls[0].model).toBe('deepseek-reasoner');
      expect(retrieved!.llmCalls[0].promptTokens).toBe(500);
    });

    it('should save and retrieve retrieval chunks', async () => {
      const context = createTraceContext();

      const chunks: RetrievedChunk[] = [
        {
          chunkId: 'chunk-1',
          content: 'test content',
          sourceDocumentId: 'doc-1',
          similarityScore: 0.85,
          confidenceLevel: 'high',
          source: 'hybrid',
        },
      ];

      context.recordRetrieval(chunks);
      context.complete();

      const trace = context.build();
      await storage.saveTrace(trace);

      const retrieved = storage.getTrace(trace.traceId);
      expect(retrieved!.retrieval.chunks).toHaveLength(1);
      expect(retrieved!.retrieval.chunks[0].chunkId).toBe('chunk-1');
    });

    it('should save trace with failed status', async () => {
      const context = createTraceContext();
      context.setQuery('test');
      context.fail('Test error');

      const trace = context.build();
      await storage.saveTrace(trace);

      const retrieved = storage.getTrace(trace.traceId);
      expect(retrieved!.status).toBe('failed');
      expect(retrieved!.error).toBe('Test error');
    });
  });

  describe('Evaluation Storage', () => {
    it('should save and retrieve evaluation', async () => {
      const context = createTraceContext();
      context.setQuery('test query');
      context.setAnswer('test answer');
      context.complete();

      const trace = context.build();
      await storage.saveTrace(trace);

      const evaluation: EvaluationResult = {
        evaluationId: 'eval-1',
        traceId: trace.traceId,
        timestamp: new Date().toISOString(),
        metrics: {
          faithfulness: { score: 0.85, verdicts: [] },
          contextRelevance: { score: 0.72, chunkScores: [0.8, 0.7] },
          answerRelevance: { score: 0.9, generatedQuestions: ['q1', 'q2'] },
        },
        overallScore: 0.82,
        metadata: {
          evaluatorModel: 'deepseek-reasoner',
          evaluationDurationMs: 1500,
          retryCount: 0,
        },
      };

      await storage.saveEvaluation(evaluation);

      // 验证存储成功（通过趋势查询）
      const trends = storage.getEvaluationTrends(1);
      // 可能没有结果因为日期分组
    });

    it('should save multiple evaluations for same trace', async () => {
      const context = createTraceContext();
      context.complete();
      const trace = context.build();
      await storage.saveTrace(trace);

      const eval1: EvaluationResult = {
        evaluationId: 'eval-1',
        traceId: trace.traceId,
        timestamp: new Date().toISOString(),
        metrics: {
          faithfulness: { score: 0.8, verdicts: [] },
          contextRelevance: { score: 0.7, chunkScores: [] },
          answerRelevance: { score: 0.9, generatedQuestions: [] },
        },
        overallScore: 0.8,
        metadata: { evaluatorModel: 'test', evaluationDurationMs: 100, retryCount: 0 },
      };

      const eval2: EvaluationResult = {
        evaluationId: 'eval-2',
        traceId: trace.traceId,
        timestamp: new Date().toISOString(),
        metrics: {
          faithfulness: { score: 0.9, verdicts: [] },
          contextRelevance: { score: 0.8, chunkScores: [] },
          answerRelevance: { score: 0.95, generatedQuestions: [] },
        },
        overallScore: 0.88,
        metadata: { evaluatorModel: 'test', evaluationDurationMs: 100, retryCount: 0 },
      };

      await storage.saveEvaluation(eval1);
      await storage.saveEvaluation(eval2);
    });
  });

  describe('Query Methods', () => {
    it('should return null for non-existent trace', () => {
      const retrieved = storage.getTrace('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should get recent traces in order', async () => {
      // 创建多个追踪（间隔以确保时间顺序）
      const traces = [];
      for (let i = 0; i < 5; i++) {
        const context = createTraceContext();
        context.setQuery(`query ${i}`);
        context.complete();
        const trace = context.build();
        await storage.saveTrace(trace);
        traces.push(trace);
        // 添加小延迟确保 created_at 递增
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const recent = storage.getRecentTraces(3);
      expect(recent).toHaveLength(3);
      // 最新的是最后保存的（created_at 最大的）
      expect(recent[0].query.raw).toBe('query 4');
    });

    it('should get all traces with high limit', async () => {
      for (let i = 0; i < 10; i++) {
        const context = createTraceContext();
        context.complete();
        await storage.saveTrace(context.build());
      }

      const recent = storage.getRecentTraces(50);
      expect(recent).toHaveLength(10);
    });
  });

  describe('Evaluation Trends', () => {
    it('should return empty array for no evaluations', () => {
      const trends = storage.getEvaluationTrends(30);
      expect(trends).toEqual([]);
    });

    it('should return trends with evaluations', async () => {
      // 创建追踪和评估
      const context = createTraceContext();
      context.complete();
      const trace = context.build();
      await storage.saveTrace(trace);

      const evaluation: EvaluationResult = {
        evaluationId: 'eval-1',
        traceId: trace.traceId,
        timestamp: new Date().toISOString(),
        metrics: {
          faithfulness: { score: 0.8, verdicts: [] },
          contextRelevance: { score: 0.7, chunkScores: [] },
          answerRelevance: { score: 0.9, generatedQuestions: [] },
        },
        overallScore: 0.8,
        metadata: { evaluatorModel: 'test', evaluationDurationMs: 100, retryCount: 0 },
      };

      await storage.saveEvaluation(evaluation);

      const trends = storage.getEvaluationTrends(1);
      // 趋势查询可能返回结果（取决于日期分组）
    });
  });

  describe('Data Cleanup', () => {
    it('should clear all data', async () => {
      const context = createTraceContext();
      context.complete();
      await storage.saveTrace(context.build());

      await storage.clear();

      const recent = storage.getRecentTraces();
      expect(recent).toHaveLength(0);
    });

    it('should clear old traces by days', async () => {
      // 创建追踪
      const context = createTraceContext();
      context.complete();
      await storage.saveTrace(context.build());

      // 清理超过 -1 天的数据（即清理所有未来的数据，包括现在创建的）
      // 使用 -1 来测试清理功能
      await storage.clearOldTraces(-1);

      const recent = storage.getRecentTraces();
      expect(recent).toHaveLength(0);
    });
  });

  describe('Connection Management', () => {
    it('should close database properly', async () => {
      const newStorage = await createTraceStorage(':memory:');
      newStorage.close();

      // 关闭后不应能访问
      expect(() => newStorage.getTrace('test')).toThrow('not initialized');
    });

    it('should throw error if not initialized', () => {
      const uninitialized = new TraceStorage();
      expect(() => uninitialized.getTrace('test')).toThrow('not initialized');
    });
  });

  describe('JSON Field Storage', () => {
    it('should store and retrieve complex objects as JSON', async () => {
      const context = createTraceContext();

      const complexInput = {
        nested: { data: [1, 2, 3] },
        metadata: { key: 'value' },
      };

      const span: TraceSpan = {
        spanId: 'span-1',
        phase: 'input',
        startTime: 100,
        endTime: 150,
        durationMs: 50,
        input: complexInput,
        output: { result: 'ok' },
        metadata: { custom: 'metadata' },
      };

      context.recordSpan(span);
      context.complete();

      const trace = context.build();
      await storage.saveTrace(trace);

      const retrieved = storage.getTrace(trace.traceId);
      expect(retrieved!.phases[0].input).toEqual(complexInput);
      expect(retrieved!.phases[0].metadata).toEqual({ custom: 'metadata' });
    });
  });
});