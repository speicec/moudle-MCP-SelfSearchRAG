/**
 * ReplanningEngine Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateReplanningNeed,
  calculateCoverage,
  calculateEvidenceScore,
  calculateFailedRatio,
  calculateCompositeScore,
  checkReplanningLimits,
  REPLANNING_PROMPT,
} from './ReplanningEngine.js';
import type { ExecutorState, TaskDAG, TaskResult, AgentTask } from './ExecutionTypes.js';
import type { MedicalEntities } from '../types.js';

describe('ReplanningEngine', () => {
  const createTestEntities = (overrides?: Partial<MedicalEntities>): MedicalEntities => ({
    diseases: [],
    drugs: [],
    indicators: [],
    relations: [],
    rawQuery: 'test',
    confidence: 0.9,
    ...overrides,
  });

  const createTestState = (overrides?: Partial<ExecutorState>): ExecutorState => ({
    dag: { tasks: [], parallelGroups: [], entryTasks: [], exitTasks: [] },
    completed: new Map(),
    pending: [],
    running: [],
    failed: [],
    status: 'running',
    startTime: Date.now(),
    currentRound: 0,
    entities: createTestEntities(),
    query: 'test',
    contextEntries: [],
    ...overrides,
  });

  describe('REPLANNING_PROMPT', () => {
    it('should contain all placeholder fields', () => {
      expect(REPLANNING_PROMPT).toContain('{completedTasks}');
      expect(REPLANNING_PROMPT).toContain('{failedTasks}');
      expect(REPLANNING_PROMPT).toContain('{coverage}');
      expect(REPLANNING_PROMPT).toContain('{evidenceScore}');
      expect(REPLANNING_PROMPT).toContain('{compositeScore}');
      expect(REPLANNING_PROMPT).toContain('{triggers}');
      expect(REPLANNING_PROMPT).toContain('{query}');
      expect(REPLANNING_PROMPT).toContain('{diseases}');
      expect(REPLANNING_PROMPT).toContain('{drugs}');
      expect(REPLANNING_PROMPT).toContain('{indicators}');
    });

    it('should define supplemental task types', () => {
      expect(REPLANNING_PROMPT).toContain('补充检索');
      expect(REPLANNING_PROMPT).toContain('重试任务');
      expect(REPLANNING_PROMPT).toContain('替代任务');
      expect(REPLANNING_PROMPT).toContain('指南检索');
    });
  });

  describe('calculateCoverage', () => {
    it('should return 1 for empty entities', () => {
      const state = createTestState();
      const entities = createTestEntities();
      expect(calculateCoverage(state, entities)).toBe(1);
    });

    it('should calculate coverage based on completed tasks', () => {
      const entities = createTestEntities({
        drugs: [
          { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
          { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
        ],
      });

      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { drug: 'drug_1' }, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'retrieve', params: { drug: 'drug_2' }, dependencies: [], priority: 1 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1', 'task_2'],
        exitTasks: ['task_1', 'task_2'],
      };

      const completed = new Map<string, TaskResult>();
      completed.set('task_1', { taskId: 'task_1', success: true, data: { entity: 'drug_1' }, durationMs: 100 });

      const state = createTestState({ dag, completed });

      // 只覆盖了 drug_1，覆盖率应为 0.5
      expect(calculateCoverage(state, entities)).toBe(0.5);
    });

    it('should count entity from completed task params', () => {
      const entities = createTestEntities({
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
      });

      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { drug: 'drug_1' }, dependencies: [], priority: 1 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1'],
        exitTasks: ['task_1'],
      };

      // Without completed task, coverage should be 0
      const statePending = createTestState({ dag });
      expect(calculateCoverage(statePending, entities)).toBe(0);

      // With completed task, coverage should be 1
      const completed = new Map<string, TaskResult>();
      completed.set('task_1', { taskId: 'task_1', success: true, data: {}, durationMs: 100 });
      const stateCompleted = createTestState({ dag, completed });
      expect(calculateCoverage(stateCompleted, entities)).toBe(1);
    });
  });

  describe('calculateEvidenceScore', () => {
    it('should calculate score from evaluate tasks', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'eval_1', type: 'evaluate', params: { results: [] }, dependencies: [], priority: 4 },
          { id: 'eval_2', type: 'evaluate', params: { results: [] }, dependencies: [], priority: 4 },
        ],
        parallelGroups: [],
        entryTasks: ['eval_1', 'eval_2'],
        exitTasks: ['eval_1', 'eval_2'],
      };

      const completed = new Map<string, TaskResult>();
      completed.set('eval_1', { taskId: 'eval_1', success: true, data: { score: 0.8 }, durationMs: 100 });
      completed.set('eval_2', { taskId: 'eval_2', success: true, data: { score: 0.6 }, durationMs: 100 });

      const state = createTestState({ dag, completed });
      expect(calculateEvidenceScore(state)).toBe(0.7);
    });

    it('should fallback to retrieve ratio when no evaluate tasks', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'retrieve_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          { id: 'retrieve_2', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
        ],
        parallelGroups: [],
        entryTasks: ['retrieve_1', 'retrieve_2'],
        exitTasks: ['retrieve_1', 'retrieve_2'],
      };

      const completed = new Map<string, TaskResult>();
      completed.set('retrieve_1', { taskId: 'retrieve_1', success: true, data: {}, durationMs: 100 });

      const state = createTestState({ dag, completed });
      expect(calculateEvidenceScore(state)).toBe(0.5);
    });

    it('should return 0 when no tasks', () => {
      const state = createTestState();
      expect(calculateEvidenceScore(state)).toBe(0);
    });
  });

  describe('calculateFailedRatio', () => {
    it('should calculate failed ratio', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          { id: 'task_3', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
        ],
        parallelGroups: [],
        entryTasks: [],
        exitTasks: [],
      };

      const state = createTestState({ dag, failed: ['task_1', 'task_2'] });
      expect(calculateFailedRatio(state)).toBeCloseTo(0.67);
    });

    it('should return 0 when no failures', () => {
      const state = createTestState();
      expect(calculateFailedRatio(state)).toBe(0);
    });

    it('should return 0 when no tasks', () => {
      const state = createTestState({ failed: ['unknown'] });
      expect(calculateFailedRatio(state)).toBe(0);
    });
  });

  describe('calculateCompositeScore', () => {
    it('should calculate weighted composite score', () => {
      const entities = createTestEntities({
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
      });

      const dag: TaskDAG = {
        tasks: [
          { id: 'retrieve_1', type: 'retrieve', params: { drug: 'drug_1' }, dependencies: [], priority: 1 },
          { id: 'evaluate_1', type: 'evaluate', params: {}, dependencies: ['retrieve_1'], priority: 4 },
          { id: 'answer', type: 'generate_answer', params: {}, dependencies: ['evaluate_1'], priority: 7 },
        ],
        parallelGroups: [],
        entryTasks: ['retrieve_1'],
        exitTasks: ['answer'],
      };

      const completed = new Map<string, TaskResult>();
      completed.set('retrieve_1', { taskId: 'retrieve_1', success: true, data: { entity: 'drug_1' }, durationMs: 100 });
      completed.set('evaluate_1', { taskId: 'evaluate_1', success: true, data: { score: 0.8 }, durationMs: 100 });
      completed.set('answer', { taskId: 'answer', success: true, data: {}, durationMs: 100 });

      const state = createTestState({ dag, completed, entities });

      const score = calculateCompositeScore(state, entities);
      // coverage=1, evidence=0.8, execution=1, answer=1
      // score = 1*0.4 + 0.8*0.25 + 1*0.15 + 1*0.2 = 0.4 + 0.2 + 0.15 + 0.2 = 0.95
      expect(score).toBeCloseTo(0.95);
    });

    it('should handle partial completion', () => {
      const entities = createTestEntities({
        drugs: [
          { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
          { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
        ],
      });

      const dag: TaskDAG = {
        tasks: [
          { id: 'retrieve_1', type: 'retrieve', params: { drug: 'drug_1' }, dependencies: [], priority: 1 },
        ],
        parallelGroups: [],
        entryTasks: ['retrieve_1'],
        exitTasks: [],
      };

      const completed = new Map<string, TaskResult>();
      completed.set('retrieve_1', { taskId: 'retrieve_1', success: true, data: {}, durationMs: 100 });

      const state = createTestState({ dag, completed, entities });

      const score = calculateCompositeScore(state, entities);
      // coverage=0.5, evidence估算, execution=1, answer=0
      expect(score).toBeLessThan(0.65);
    });
  });

  describe('checkReplanningLimits', () => {
    it('should detect max rounds limit', () => {
      const state = createTestState({ currentRound: 2 });
      const limits = { maxReplanRounds: 2, maxSupplementalTasks: 3, convergenceThreshold: 0.05, cooldownMs: 500 };
      const result = checkReplanningLimits(state, limits);
      expect(result.limitReached).toBe(true);
      expect(result.reason).toContain('Max replan rounds');
    });

    it('should detect max supplemental tasks limit', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'sup_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          { id: 'sup_2', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          { id: 'sup_3', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
        ],
        parallelGroups: [],
        entryTasks: [],
        exitTasks: [],
      };

      const state = createTestState({ dag, currentRound: 0 });
      const limits = { maxReplanRounds: 2, maxSupplementalTasks: 3, convergenceThreshold: 0.05, cooldownMs: 500 };
      const result = checkReplanningLimits(state, limits);
      expect(result.limitReached).toBe(true);
      expect(result.reason).toContain('Max supplemental tasks');
    });

    it('should pass when limits not reached', () => {
      const state = createTestState({ currentRound: 0 });
      const limits = { maxReplanRounds: 2, maxSupplementalTasks: 3, convergenceThreshold: 0.05, cooldownMs: 500 };
      const result = checkReplanningLimits(state, limits);
      expect(result.limitReached).toBe(false);
    });
  });

  describe('evaluateReplanningNeed', () => {
    describe('trigger scenarios', () => {
      it('should trigger on coverage threshold', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          ],
        });

        const dag: TaskDAG = {
          tasks: [
            { id: 'retrieve_1', type: 'retrieve', params: { drug: 'drug_1' }, dependencies: [], priority: 1 },
          ],
          parallelGroups: [],
          entryTasks: ['retrieve_1'],
          exitTasks: [],
        };

        const state = createTestState({ dag, entities });

        const result = evaluateReplanningNeed(state, entities);
        expect(result.triggers).toContain('coverage_threshold');
      });

      it('should trigger on critical entity missing', () => {
        const dag: TaskDAG = {
          tasks: [
            { id: 'retrieve_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          ],
          parallelGroups: [],
          entryTasks: ['retrieve_1'],
          exitTasks: [],
        };

        const failed = ['retrieve_1'];
        const state = createTestState({ dag, failed });

        const result = evaluateReplanningNeed(state, createTestEntities());
        expect(result.triggers).toContain('critical_entity_missing');
        expect(result.urgency).toBe('CRITICAL');
      });

      it('should trigger on critical task failure', () => {
        const dag: TaskDAG = {
          tasks: [
            { id: 'retrieve_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
            { id: 'contra_1', type: 'check_contraindication', params: { drug: 'test' }, dependencies: ['retrieve_1'], priority: 5 },
          ],
          parallelGroups: [],
          entryTasks: ['retrieve_1'],
          exitTasks: ['contra_1'],
        };

        const failed = ['contra_1'];
        const state = createTestState({ dag, failed });

        const result = evaluateReplanningNeed(state, createTestEntities());
        expect(result.triggers).toContain('critical_task_failure');
      });

      it('should trigger on execution failure', () => {
        const dag: TaskDAG = {
          tasks: [
            { id: 'task_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
            { id: 'task_2', type: 'evaluate', params: {}, dependencies: ['task_1'], priority: 4 },
            { id: 'task_3', type: 'generate_answer', params: {}, dependencies: ['task_2'], priority: 7 },
          ],
          parallelGroups: [],
          entryTasks: ['task_1'],
          exitTasks: ['task_3'],
        };

        const failed = ['task_1'];
        const state = createTestState({ dag, failed });

        const result = evaluateReplanningNeed(state, createTestEntities());
        // 失败率 1/3 > 0.2
        expect(result.triggers).toContain('execution_failure');
      });
    });

    describe('urgency level determination', () => {
      it('should set CRITICAL for coverage < 0.5', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: 'A', matchedTerm: 'A', aliases: [], classification: { category: 'test', subcategory: 'test' } },
            { id: 'drug_2', canonicalName: 'B', matchedTerm: 'B', aliases: [], classification: { category: 'test', subcategory: 'test' } },
          ],
        });

        const state = createTestState({ entities });
        const result = evaluateReplanningNeed(state, entities);
        // coverage = 0, < 0.5
        expect(result.urgency).toBe('CRITICAL');
      });

      it('should set CRITICAL for critical entity missing', () => {
        const dag: TaskDAG = {
          tasks: [{ id: 'retrieve_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 }],
          parallelGroups: [],
          entryTasks: [],
          exitTasks: [],
        };

        const state = createTestState({ dag, failed: ['retrieve_1'] });
        const result = evaluateReplanningNeed(state, createTestEntities());
        expect(result.urgency).toBe('CRITICAL');
      });

      it('should set HIGH for failed ratio > 0.2', () => {
        const dag: TaskDAG = {
          tasks: [
            { id: 't1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
            { id: 't2', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
            { id: 't3', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          ],
          parallelGroups: [],
          entryTasks: [],
          exitTasks: [],
        };

        const state = createTestState({ dag, failed: ['t1', 't2'] });
        const result = evaluateReplanningNeed(state, createTestEntities());
        expect(result.urgency).toBe('CRITICAL'); // 因为有 retrieve 失败
      });
    });

    describe('limit enforcement', () => {
      it('should not replan when max rounds reached', () => {
        const state = createTestState({ currentRound: 2 });
        const limits = { maxReplanRounds: 2, maxSupplementalTasks: 3, convergenceThreshold: 0.05, cooldownMs: 500 };

        // 低覆盖率触发
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: 'A', matchedTerm: 'A', aliases: [], classification: { category: 'test', subcategory: 'test' } },
            { id: 'drug_2', canonicalName: 'B', matchedTerm: 'B', aliases: [], classification: { category: 'test', subcategory: 'test' } },
          ],
        });

        const result = evaluateReplanningNeed(state, entities, limits);
        expect(result.shouldReplan).toBe(false);
        expect(result.limitReached).toContain('Max replan rounds');
      });

      it('should not replan when max supplemental tasks reached', () => {
        const dag: TaskDAG = {
          tasks: [
            { id: 'sup_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
            { id: 'sup_2', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
            { id: 'sup_3', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          ],
          parallelGroups: [],
          entryTasks: [],
          exitTasks: [],
        };

        const state = createTestState({ dag });
        const limits = { maxReplanRounds: 2, maxSupplementalTasks: 3, convergenceThreshold: 0.05, cooldownMs: 500 };

        const result = evaluateReplanningNeed(state, createTestEntities(), limits);
        expect(result.shouldReplan).toBe(false);
        expect(result.limitReached).toContain('Max supplemental tasks');
      });
    });

    describe('supplemental task generation', () => {
      it('should generate retrieval tasks for missing entities', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
            { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
          ],
        });

        const dag: TaskDAG = {
          tasks: [
            { id: 'retrieve_1', type: 'retrieve', params: { drug: 'drug_1' }, dependencies: [], priority: 1 },
          ],
          parallelGroups: [],
          entryTasks: [],
          exitTasks: [],
        };

        const state = createTestState({ dag, entities });

        const result = evaluateReplanningNeed(state, entities);
        expect(result.supplementalTasks.length).toBeGreaterThan(0);
        expect(result.supplementalTasks.some(t => t.type === 'retrieve')).toBe(true);
      });

      it('should generate retry tasks for critical task failure', () => {
        const dag: TaskDAG = {
          tasks: [
            { id: 'retrieve_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
          ],
          parallelGroups: [],
          entryTasks: [],
          exitTasks: [],
        };

        const state = createTestState({ dag, failed: ['retrieve_1'] });

        const result = evaluateReplanningNeed(state, createTestEntities());
        expect(result.supplementalTasks.some(t => t.id.startsWith('sup_retry'))).toBe(true);
      });

      it('should limit supplemental tasks count', () => {
        const entities = createTestEntities({
          drugs: [
            { id: 'drug_1', canonicalName: 'A', matchedTerm: 'A', aliases: [], classification: { category: 'test', subcategory: 'test' } },
            { id: 'drug_2', canonicalName: 'B', matchedTerm: 'B', aliases: [], classification: { category: 'test', subcategory: 'test' } },
            { id: 'drug_3', canonicalName: 'C', matchedTerm: 'C', aliases: [], classification: { category: 'test', subcategory: 'test' } },
            { id: 'drug_4', canonicalName: 'D', matchedTerm: 'D', aliases: [], classification: { category: 'test', subcategory: 'test' } },
          ],
        });

        const dag: TaskDAG = {
          tasks: [],
          parallelGroups: [],
          entryTasks: [],
          exitTasks: [],
        };

        const state = createTestState({ dag, entities });
        const limits = { maxReplanRounds: 2, maxSupplementalTasks: 2, convergenceThreshold: 0.05, cooldownMs: 500 };

        const result = evaluateReplanningNeed(state, entities, limits);
        expect(result.supplementalTasks.length).toBeLessThanOrEqual(2);
      });
    });

    describe('composite score threshold', () => {
      it('should trigger when composite score < 0.65', () => {
        const state = createTestState();
        const entities = createTestEntities();

        // 空状态，coverage=1, evidence=0, execution=1, answer=0
        // score = 1*0.4 + 0*0.25 + 1*0.15 + 0*0.2 = 0.55 < 0.65

        const result = evaluateReplanningNeed(state, entities);
        expect(result.shouldReplan).toBe(true);
      });

      it('should not trigger when composite score >= 0.65', () => {
        const entities = createTestEntities({
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        });

        const dag: TaskDAG = {
          tasks: [
            { id: 'retrieve_1', type: 'retrieve', params: { drug: 'drug_1' }, dependencies: [], priority: 1 },
            { id: 'evaluate_1', type: 'evaluate', params: {}, dependencies: ['retrieve_1'], priority: 4 },
            { id: 'answer', type: 'generate_answer', params: {}, dependencies: ['evaluate_1'], priority: 7 },
          ],
          parallelGroups: [],
          entryTasks: [],
          exitTasks: [],
        };

        const completed = new Map<string, TaskResult>();
        completed.set('retrieve_1', { taskId: 'retrieve_1', success: true, data: { entity: 'drug_1' }, durationMs: 100 });
        completed.set('evaluate_1', { taskId: 'evaluate_1', success: true, data: { score: 0.9 }, durationMs: 100 });
        completed.set('answer', { taskId: 'answer', success: true, data: {}, durationMs: 100 });

        const state = createTestState({ dag, completed, entities });

        const result = evaluateReplanningNeed(state, entities);
        expect(result.shouldReplan).toBe(false);
      });
    });
  });
});