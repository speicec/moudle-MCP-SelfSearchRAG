/**
 * AgentEmitter Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentEmitter, createAgentEmitter } from './agent-emitter.js';
import type { PipelineEvent } from './types.js';
import type { MedicalEntities } from '../medical/types.js';
import type { ComplexityAssessment, TaskDAG, ExecutorState } from '../medical/agent/ExecutionTypes.js';
import type { TemplateAttempt } from '../medical/agent/RetrievalVisualization.js';
import type { AgentResult } from '../medical/agent/types.js';

describe('AgentEmitter', () => {
  let mockWsHandler: { broadcast: ReturnType<typeof vi.fn> };
  let agentEmitter: AgentEmitter;

  beforeEach(() => {
    mockWsHandler = {
      broadcast: vi.fn(),
    };
    agentEmitter = createAgentEmitter(mockWsHandler as any);
  });

  describe('emitInput', () => {
    it('should broadcast agent:input event with query', () => {
      agentEmitter.emitInput('二甲双胍用法');

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.type).toBe('agent:input');
      expect(event.agentPhase).toBe('input');
      expect(event.query).toBe('二甲双胍用法');
      expect(event.timestamp).toBeDefined();
    });
  });

  describe('emitEntities', () => {
    it('should broadcast agent:entities event with entity matches', () => {
      const entities: MedicalEntities = {
        diseases: [
          { matchedTerm: '糖尿病', canonicalName: '2型糖尿病', id: 'disease_t2dm', aliases: [], classification: { category: '代谢性疾病' } },
        ],
        drugs: [
          { matchedTerm: '二甲双胍', canonicalName: '二甲双胍', id: 'drug_metformin', aliases: [], classification: { category: '降糖药' } },
        ],
        indicators: [
          { matchedTerm: 'HbA1c', canonicalName: '糖化血红蛋白', id: 'indicator_hba1c', value: 7.5, unit: '%' },
        ],
        relations: [],
        rawQuery: '二甲双胍治疗糖尿病',
        confidence: 0.9,
      };

      agentEmitter.emitEntities(entities);

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.type).toBe('agent:entities');
      expect(event.agentPhase).toBe('entities');
      expect(event.entityMatches).toHaveLength(3);
      expect(event.entityMatches?.[0]?.entityType).toBe('disease');
      expect(event.entityMatches?.[1]?.entityType).toBe('drug');
      expect(event.entityMatches?.[2]?.entityType).toBe('indicator');
      expect(event.entityMatches?.[2]?.value).toBe(7.5);
      expect(event.entityMatches?.[2]?.unit).toBe('%');
    });
  });

  describe('emitComplexity', () => {
    it('should broadcast agent:complexity event with assessment', () => {
      const complexity: ComplexityAssessment = {
        level: 'moderate',
        needsPlanning: true,
        entityCount: 3,
        hasComparison: false,
        hasConditions: true,
        hasInteraction: false,
        reason: '包含条件判断，需要规划执行',
      };

      agentEmitter.emitComplexity(complexity);

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.type).toBe('agent:complexity');
      expect(event.complexity?.level).toBe('moderate');
      expect(event.complexity?.needsPlanning).toBe(true);
      expect(event.complexity?.entityCount).toBe(3);
      expect(event.complexity?.hasConditions).toBe(true);
      expect(event.complexity?.reason).toBe('包含条件判断，需要规划执行');
    });
  });

  describe('emitMode', () => {
    it('should broadcast agent:mode event for ReAct mode', () => {
      agentEmitter.emitMode('react', '简单查询，使用 ReAct 循环');

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.type).toBe('agent:mode');
      expect(event.executionMode).toBe('react');
      expect(event.executionReason).toBe('简单查询，使用 ReAct 循环');
      expect(event.matchedTemplate).toBeUndefined();
    });

    it('should broadcast agent:mode event for Planning mode with template', () => {
      agentEmitter.emitMode('planning', '复杂查询，匹配用药调整模板', 'drug_adjustment');

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.executionMode).toBe('planning');
      expect(event.matchedTemplate).toBe('drug_adjustment');
    });
  });

  describe('emitQueryRewriting', () => {
    it('should broadcast agent:query_rewrite event with strategy', () => {
      const strategy = {
        primaryQuery: '二甲双胍 2型糖尿病 用法用量',
        expandedTerms: ['Metformin', '格华止', '血糖控制'],
      };

      agentEmitter.emitQueryRewriting(strategy, '二甲双胍怎么用');

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.type).toBe('agent:query_rewrite');
      expect(event.queryRewriting?.primaryQuery).toBe('二甲双胍 2型糖尿病 用法用量');
      expect(event.queryRewriting?.expandedTerms).toHaveLength(3);
      expect(event.query).toBe('二甲双胍怎么用');
    });
  });

  describe('emitTemplate', () => {
    it('should broadcast agent:template event with attempts', () => {
      const attempts: TemplateAttempt[] = [
        { templateId: 'drug_interaction', templateName: '药物相互作用检查', matched: false, rejectionReason: '未涉及多药联合' },
        { templateId: 'drug_adjustment', templateName: '用药调整方案', matched: true },
      ];

      agentEmitter.emitTemplate(attempts, 'drug_adjustment');

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.type).toBe('agent:template');
      expect(event.templateAttempts).toHaveLength(2);
      expect(event.templateAttempts?.[0]?.matched).toBe(false);
      expect(event.templateAttempts?.[1]?.matched).toBe(true);
      expect(event.matchedTemplate).toBe('drug_adjustment');
    });
  });

  describe('emitDAG', () => {
    it('should broadcast agent:dag event with task structure', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: '二甲双胍用法' }, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'retrieve', params: { query: '糖尿病指南' }, dependencies: [], priority: 1 },
          { id: 'task_3', type: 'synthesize', params: {}, dependencies: ['task_1', 'task_2'], priority: 2 },
        ],
        entryTasks: ['task_1', 'task_2'],
        exitTasks: ['task_3'],
        parallelGroups: [['task_1', 'task_2']],
      };

      agentEmitter.emitDAG(dag);

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.type).toBe('agent:dag');
      expect(event.dag?.tasks).toHaveLength(3);
      expect(event.dag?.entryTasks).toHaveLength(2);
      expect(event.dag?.parallelGroups).toHaveLength(1);
    });
  });

  describe('emitExecution', () => {
    it('should broadcast agent:execution event with state', () => {
      const state: ExecutorState = {
        dag: {} as any,
        completed: new Map([['task_1', { taskId: 'task_1', result: {} }]]),
        pending: new Set(['task_3']),
        running: new Set(['task_2']),
        failed: [],
        status: 'running',
        startTime: Date.now(),
        currentRound: 1,
        entities: {} as any,
        query: 'test',
        contextEntries: [],
      };

      agentEmitter.emitExecution(state);

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.type).toBe('agent:execution');
      expect(event.executorState?.status).toBe('running');
      expect(event.executorState?.currentRound).toBe(1);
      expect(event.executorState?.completedCount).toBe(1);
      expect(event.executorState?.runningTasks).toHaveLength(1);
    });
  });

  describe('emitComplete', () => {
    it('should broadcast agent:complete event with result summary', () => {
      const result: AgentResult = {
        success: true,
        satisfied: true,
        answer: {
          conclusion: { text: '测试答案', confidence: 'high' },
          details: { points: [] },
          evidenceGrade: { grade: 'A', sourceType: 'guideline' },
          sources: [],
          warnings: [],
        },
        stats: {
          iterations: 2,
          actionsExecuted: 3,
          retrievalCalls: 2,
          llmCalls: 3,
          totalTimeMs: 1500,
        },
        visualization: {
          retrievalResultCount: 5,
        } as any,
      };

      agentEmitter.emitComplete(result);

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.type).toBe('agent:complete');
      expect(event.agentResult?.satisfied).toBe(true);
      expect(event.agentResult?.retrievalCount).toBe(5);
      expect(event.agentResult?.totalTimeMs).toBe(1500);
      expect(event.agentResult?.iterations).toBe(2);
    });

    it('should broadcast agent:complete event with evidence grade data', () => {
      const result: AgentResult = {
        success: true,
        satisfied: true,
        answer: {
          conclusion: { text: '测试答案', confidence: 'high' },
          details: { points: [] },
          evidenceGrade: { grade: 'A', sourceType: 'guideline' },
          sources: [],
          warnings: [],
        },
        stats: {
          iterations: 2,
          actionsExecuted: 3,
          retrievalCalls: 2,
          llmCalls: 3,
          totalTimeMs: 1500,
        },
        visualization: {
          retrievalResultCount: 5,
        } as any,
        // Evidence data
        overallEvidenceGrade: 'A',
        evidenceStatistics: {
          gradeDistribution: { A: 2, B: 1, C: 0, D: 0 },
          averageCompositeScore: 0.85,
          conflictDetected: false,
        },
      };

      agentEmitter.emitComplete(result);

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.type).toBe('agent:complete');
      expect(event.agentResult?.overallEvidenceGrade).toBe('A');
      expect(event.agentResult?.evidenceStatistics?.gradeDistribution).toEqual({ A: 2, B: 1, C: 0, D: 0 });
      expect(event.agentResult?.evidenceStatistics?.averageCompositeScore).toBe(0.85);
      expect(event.agentResult?.evidenceStatistics?.conflictDetected).toBe(false);
    });
  });

  describe('emitEvidenceEvaluated', () => {
    it('should broadcast evidence:evaluated event with GRADE data', () => {
      const evidenceEvaluation = [
        {
          literatureType: 'rct',
          grade: 'A',
          isCurrent: true,
          year: 2024,
          sourceAuthority: 'international',
          authorityWeight: 1.0,
          timeWeight: 0.95,
          compositeScore: 0.95,
          chunkIndex: 0,
        },
        {
          literatureType: 'meta_analysis',
          grade: 'A',
          isCurrent: true,
          year: 2023,
          sourceAuthority: 'international',
          authorityWeight: 1.0,
          timeWeight: 0.85,
          compositeScore: 0.92,
          chunkIndex: 1,
        },
      ];

      agentEmitter.emitEvidenceEvaluated(evidenceEvaluation, 'A');

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.type).toBe('evidence:evaluated');
      expect(event.evidenceEvaluation).toHaveLength(2);
      expect(event.evidenceEvaluation?.[0]?.literatureType).toBe('rct');
      expect(event.evidenceEvaluation?.[0]?.grade).toBe('A');
      expect(event.evidenceEvaluation?.[0]?.chunkIndex).toBe(0);
      expect(event.overallEvidenceGrade).toBe('A');
    });

    it('should broadcast evidence:evaluated event with mixed grades', () => {
      const evidenceEvaluation = [
        {
          literatureType: 'guideline',
          grade: 'A',
          isCurrent: true,
          year: 2024,
          chunkIndex: 0,
        },
        {
          literatureType: 'observational',
          grade: 'B',
          isCurrent: true,
          year: 2022,
          chunkIndex: 1,
        },
        {
          literatureType: 'case_report',
          grade: 'D',
          isCurrent: false,
          year: 2018,
          chunkIndex: 2,
        },
      ];

      agentEmitter.emitEvidenceEvaluated(evidenceEvaluation, 'B');

      expect(mockWsHandler.broadcast).toHaveBeenCalledTimes(1);
      const event = mockWsHandler.broadcast.mock.calls[0][0] as PipelineEvent;
      expect(event.type).toBe('evidence:evaluated');
      expect(event.evidenceEvaluation).toHaveLength(3);
      expect(event.overallEvidenceGrade).toBe('B');
    });
  });

  describe('createAgentEmitter', () => {
    it('should create AgentEmitter instance', () => {
      const emitter = createAgentEmitter(mockWsHandler as any);
      expect(emitter).toBeInstanceOf(AgentEmitter);
    });
  });
});