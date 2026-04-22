/**
 * TaskExecutor Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  execute,
  findReadyTasks,
  updateExecutorState,
  trackProgress,
  buildExecutionSummary,
} from './TaskExecutor.js';
import type { TaskDAG, AgentTask, ExecutorState } from './ExecutionTypes.js';
import type { MedicalEntities, SourceCitation } from '../types.js';

describe('TaskExecutor', () => {
  const createTestEntities = (): MedicalEntities => ({
    diseases: [],
    drugs: [],
    indicators: [],
    relations: [],
    rawQuery: 'test',
    confidence: 0.9,
  });

  const createMockRetrieval = () => {
    return async (query: string) => {
      return [
        { content: `Mock content for ${query}`, source: { documentName: 'Test Document' } as SourceCitation },
      ];
    };
  };

  const createTestState = (overrides?: Partial<ExecutorState>): ExecutorState => ({
    dag: { tasks: [], parallelGroups: [], entryTasks: [], exitTasks: [] },
    completed: new Map(),
    pending: [],
    running: [],
    failed: [],
    status: 'initialized',
    startTime: Date.now(),
    currentRound: 0,
    entities: createTestEntities(),
    query: 'test',
    contextEntries: [],
    ...overrides,
  });

  describe('findReadyTasks', () => {
    it('should find tasks with no dependencies', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'evaluate', params: {}, dependencies: ['task_1'], priority: 4 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1'],
        exitTasks: ['task_2'],
      };

      const state = createTestState({ dag, pending: ['task_1', 'task_2'] });
      const ready = findReadyTasks(state);
      expect(ready.length).toBe(1);
      expect(ready[0].id).toBe('task_1');
    });

    it('should find tasks when dependencies are satisfied', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'evaluate', params: {}, dependencies: ['task_1'], priority: 4 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1'],
        exitTasks: ['task_2'],
      };

      const completed = new Map();
      completed.set('task_1', { taskId: 'task_1', success: true, data: {}, durationMs: 100 });

      const state = createTestState({ dag, pending: ['task_2'], completed });
      const ready = findReadyTasks(state);
      expect(ready.length).toBe(1);
      expect(ready[0].id).toBe('task_2');
    });

    it('should not find tasks when dependencies are not satisfied', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'evaluate', params: {}, dependencies: ['task_1'], priority: 4 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1'],
        exitTasks: ['task_2'],
      };

      // task_1 未完成
      const state = createTestState({ dag, pending: ['task_2'] });
      const ready = findReadyTasks(state);
      expect(ready.length).toBe(0);
    });

    it('should not find tasks that failed as dependencies', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'evaluate', params: {}, dependencies: ['task_1'], priority: 4 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1'],
        exitTasks: ['task_2'],
      };

      const completed = new Map();
      completed.set('task_1', { taskId: 'task_1', success: false, error: 'failed', durationMs: 100 });

      const state = createTestState({ dag, pending: ['task_2'], completed });
      const ready = findReadyTasks(state);
      expect(ready.length).toBe(0);
    });
  });

  describe('updateExecutorState', () => {
    it('should update status', () => {
      const state = createTestState({ status: 'initialized' });
      const updated = updateExecutorState(state, 'running');
      expect(updated.status).toBe('running');
    });

    it('should preserve other state', () => {
      const state = createTestState({ pending: ['task_1'] });
      const updated = updateExecutorState(state, 'running');
      expect(updated.pending).toEqual(['task_1']);
    });
  });

  describe('trackProgress', () => {
    it('should return progress string', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
        ],
        parallelGroups: [],
        entryTasks: [],
        exitTasks: [],
      };

      const completed = new Map();
      completed.set('task_1', { taskId: 'task_1', success: true, data: {}, durationMs: 100 });

      const state = createTestState({ dag, completed, failed: [] });
      const progress = trackProgress(state);
      expect(progress).toContain('1/2 tasks');
      expect(progress).toContain('0 failed');
    });
  });

  describe('buildExecutionSummary', () => {
    it('should build summary from state', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'retrieve', params: {}, dependencies: [], priority: 1, parallelGroup: 'group_1' },
          { id: 'task_3', type: 'evaluate', params: {}, dependencies: ['task_1', 'task_2'], priority: 4 },
        ],
        parallelGroups: ['group_1'],
        entryTasks: [],
        exitTasks: [],
      };

      const completed = new Map();
      completed.set('task_1', { taskId: 'task_1', success: true, data: {}, durationMs: 100 });
      completed.set('task_2', { taskId: 'task_2', success: true, data: {}, durationMs: 50 });

      const state = createTestState({ dag, completed, startTime: Date.now() - 1000 });

      const summary = buildExecutionSummary(state);
      expect(summary.totalTasks).toBe(3);
      expect(summary.completedTasks).toBe(2);
      expect(summary.failedTasks).toBe(0);
      expect(summary.parallelTasks).toBe(1);
      expect(summary.totalDurationMs).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('execute', () => {
    describe('sequential execution with dependencies', () => {
      it('should execute tasks in dependency order', async () => {
        const dag: TaskDAG = {
          tasks: [
            { id: 'retrieve_1', type: 'retrieve', params: { query: 'metformin' }, dependencies: [], priority: 1 },
            { id: 'evaluate_1', type: 'evaluate', params: { results: [] }, dependencies: ['retrieve_1'], priority: 4 },
            { id: 'answer', type: 'generate_answer', params: {}, dependencies: ['evaluate_1'], priority: 7 },
          ],
          parallelGroups: [],
          entryTasks: ['retrieve_1'],
          exitTasks: ['answer'],
        };

        const context = {
          retrieval: createMockRetrieval(),
          entities: createTestEntities(),
          query: 'test',
        };

        const result = await execute(dag, context, { maxRetries: 1, retryDelayMs: 100, enableLogging: false });

        expect(result.status).toBe('completed');
        expect(result.completed.size).toBe(3);
        expect(result.failed.length).toBe(0);
        expect(result.pending.length).toBe(0);
        expect(result.running.length).toBe(0);
      });

      it('should handle failed dependencies', async () => {
        const dag: TaskDAG = {
          tasks: [
            { id: 'retrieve_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
            { id: 'evaluate_1', type: 'evaluate', params: {}, dependencies: ['retrieve_1'], priority: 4 },
          ],
          parallelGroups: [],
          entryTasks: ['retrieve_1'],
          exitTasks: ['evaluate_1'],
        };

        // Mock retrieval that fails
        const context = {
          retrieval: async () => {
            throw new Error('Retrieval failed');
          },
          entities: createTestEntities(),
          query: 'test',
        };

        const result = await execute(dag, context, { maxRetries: 0, retryDelayMs: 0, enableLogging: false });

        expect(result.status).toBe('failed');
        expect(result.failed.length).toBeGreaterThan(0);
        expect(result.failed).toContain('retrieve_1');
        // evaluate_1 应该无法执行（依赖失败）
        expect(result.completed.has('evaluate_1')).toBe(false);
      });
    });

    describe('parallel execution with concurrency limits', () => {
      it('should execute parallel tasks concurrently', async () => {
        const dag: TaskDAG = {
          tasks: [
            { id: 'retrieve_1', type: 'retrieve', params: { query: 'a' }, dependencies: [], priority: 1, parallelGroup: 'parallel_1' },
            { id: 'retrieve_2', type: 'retrieve', params: { query: 'b' }, dependencies: [], priority: 1, parallelGroup: 'parallel_1' },
            { id: 'evaluate', type: 'evaluate', params: {}, dependencies: ['retrieve_1', 'retrieve_2'], priority: 4 },
          ],
          parallelGroups: ['parallel_1'],
          entryTasks: ['retrieve_1', 'retrieve_2'],
          exitTasks: ['evaluate'],
        };

        const context = {
          retrieval: createMockRetrieval(),
          entities: createTestEntities(),
          query: 'test',
        };

        const result = await execute(dag, context, { maxRetries: 1, retryDelayMs: 100, enableLogging: false });

        expect(result.status).toBe('completed');
        expect(result.completed.has('retrieve_1')).toBe(true);
        expect(result.completed.has('retrieve_2')).toBe(true);
      });

      it('should respect type concurrency limits', async () => {
        // 超过 retrieve 限制 (3) 的测试
        const dag: TaskDAG = {
          tasks: [
            { id: 'r1', type: 'retrieve', params: { query: 'a' }, dependencies: [], priority: 1, parallelGroup: 'g1' },
            { id: 'r2', type: 'retrieve', params: { query: 'b' }, dependencies: [], priority: 1, parallelGroup: 'g1' },
            { id: 'r3', type: 'retrieve', params: { query: 'c' }, dependencies: [], priority: 1, parallelGroup: 'g1' },
            { id: 'r4', type: 'retrieve', params: { query: 'd' }, dependencies: [], priority: 1, parallelGroup: 'g1' },
            { id: 'eval', type: 'evaluate', params: {}, dependencies: ['r1', 'r2', 'r3', 'r4'], priority: 4 },
          ],
          parallelGroups: ['g1'],
          entryTasks: ['r1', 'r2', 'r3', 'r4'],
          exitTasks: ['eval'],
        };

        const context = {
          retrieval: createMockRetrieval(),
          entities: createTestEntities(),
          query: 'test',
        };

        const result = await execute(dag, context, { maxRetries: 1, retryDelayMs: 100, enableLogging: false });

        // 所有任务应该最终完成（超出限制的任务会等待下一轮）
        expect(result.status).toBe('completed');
        expect(result.completed.size).toBe(5);
      });
    });

    describe('retry and fallback scenarios', () => {
      it('should retry failed tasks', async () => {
        const dag: TaskDAG = {
          tasks: [
            { id: 'retrieve_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
          ],
          parallelGroups: [],
          entryTasks: ['retrieve_1'],
          exitTasks: ['retrieve_1'],
        };

        let attempts = 0;
        const context = {
          retrieval: async () => {
            attempts++;
            if (attempts < 2) {
              throw new Error('Temporary failure');
            }
            return [{ content: 'success', source: { documentName: 'Test' } }];
          },
          entities: createTestEntities(),
          query: 'test',
        };

        const result = await execute(dag, context, { maxRetries: 2, retryDelayMs: 50, enableLogging: false });

        expect(result.status).toBe('completed');
        expect(result.completed.get('retrieve_1')?.success).toBe(true);
        expect(result.completed.get('retrieve_1')?.retryCount).toBe(1);
      });

      it('should skip task with skip fallback strategy', async () => {
        const dag: TaskDAG = {
          tasks: [
            {
              id: 'retrieve_1',
              type: 'retrieve',
              params: { query: 'test' },
              dependencies: [],
              priority: 1,
              fallbackStrategy: { type: 'skip' },
            },
          ],
          parallelGroups: [],
          entryTasks: ['retrieve_1'],
          exitTasks: ['retrieve_1'],
        };

        const context = {
          retrieval: async () => {
            throw new Error('Always fails');
          },
          entities: createTestEntities(),
          query: 'test',
        };

        const result = await execute(dag, context, { maxRetries: 0, retryDelayMs: 0, enableLogging: false });

        expect(result.failed).toContain('retrieve_1');
        expect(result.completed.get('retrieve_1')?.success).toBe(false);
      });
    });
  });

  describe('task type execution', () => {
    it('should execute calculate_indicator task', async () => {
      const dag: TaskDAG = {
        tasks: [
          {
            id: 'calc_1',
            type: 'calculate_indicator',
            params: { indicator: 'indicator_egfr', value: 35 },
            dependencies: [],
            priority: 3,
          },
        ],
        parallelGroups: [],
        entryTasks: ['calc_1'],
        exitTasks: ['calc_1'],
      };

      const context = {
        retrieval: createMockRetrieval(),
        entities: createTestEntities(),
        query: 'test',
      };

      const result = await execute(dag, context);
      const taskResult = result.completed.get('calc_1');

      expect(taskResult?.success).toBe(true);
      expect(taskResult?.data).toMatchObject({
        indicator: 'indicator_egfr',
        value: 35,
        zone: expect.any(String),
      });
    });

    it('should execute check_contraindication task', async () => {
      const dag: TaskDAG = {
        tasks: [
          {
            id: 'check_1',
            type: 'check_contraindication',
            params: { drug: 'drug_metformin', threshold: 25 },
            dependencies: [],
            priority: 5,
          },
        ],
        parallelGroups: [],
        entryTasks: ['check_1'],
        exitTasks: ['check_1'],
      };

      const context = {
        retrieval: createMockRetrieval(),
        entities: createTestEntities(),
        query: 'test',
      };

      const result = await execute(dag, context);
      const taskResult = result.completed.get('check_1');

      expect(taskResult?.success).toBe(true);
      expect(taskResult?.data).toMatchObject({
        hasContraindication: true,
        severity: 'absolute',
      });
    });

    it('should execute check_interaction task', async () => {
      const dag: TaskDAG = {
        tasks: [
          {
            id: 'check_1',
            type: 'check_interaction',
            params: { drug1: 'drug_metformin', drug2: 'drug_insulin' },
            dependencies: [],
            priority: 5,
          },
        ],
        parallelGroups: [],
        entryTasks: ['check_1'],
        exitTasks: ['check_1'],
      };

      const context = {
        retrieval: createMockRetrieval(),
        entities: createTestEntities(),
        query: 'test',
      };

      const result = await execute(dag, context);
      const taskResult = result.completed.get('check_1');

      expect(taskResult?.success).toBe(true);
    });
  });
});