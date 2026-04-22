/**
 * DAGValidator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateDAG,
  detectDuplicateIds,
  detectMissingDependencies,
  detectCircularDependencies,
  detectSelfDependencies,
  detectParallelInternalDependencies,
  checkParallelTypeLimits,
  checkPriorityOrder,
  detectUnknownToolTypes,
  checkRequiredParams,
  calculateDAGStats,
  autoCorrectDAG,
  removeDependency,
  adjustPriority,
} from './DAGValidator.js';
import type { TaskDAG, AgentTask } from './ExecutionTypes.js';

describe('DAGValidator', () => {
  describe('detectDuplicateIds', () => {
    it('should detect duplicate task IDs', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
        { id: 'task_1', type: 'retrieve', params: { query: 'test2' }, dependencies: [], priority: 2 },
        { id: 'task_2', type: 'retrieve', params: { query: 'test3' }, dependencies: [], priority: 3 },
      ];
      expect(detectDuplicateIds(tasks)).toEqual(['task_1']);
    });

    it('should return empty array for unique IDs', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
        { id: 'task_2', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 2 },
      ];
      expect(detectDuplicateIds(tasks)).toEqual([]);
    });
  });

  describe('detectMissingDependencies', () => {
    it('should detect missing dependencies', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'generate_answer', params: {}, dependencies: ['task_3'], priority: 7 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1'],
        exitTasks: ['task_2'],
      };
      const missing = detectMissingDependencies(dag);
      expect(missing).toEqual([{ taskId: 'task_2', missingDep: 'task_3' }]);
    });

    it('should return empty array when all dependencies exist', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'generate_answer', params: {}, dependencies: ['task_1'], priority: 7 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1'],
        exitTasks: ['task_2'],
      };
      expect(detectMissingDependencies(dag)).toEqual([]);
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect direct circular dependency', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'A', type: 'retrieve', params: { query: 'test' }, dependencies: ['B'], priority: 1 },
          { id: 'B', type: 'retrieve', params: { query: 'test' }, dependencies: ['A'], priority: 2 },
        ],
        parallelGroups: [],
        entryTasks: [],
        exitTasks: [],
      };
      const cycles = detectCircularDependencies(dag);
      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles.some(c => c.includes('A') && c.includes('B'))).toBe(true);
    });

    it('should detect indirect circular dependency', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'A', type: 'retrieve', params: { query: 'test' }, dependencies: ['B'], priority: 1 },
          { id: 'B', type: 'retrieve', params: { query: 'test' }, dependencies: ['C'], priority: 2 },
          { id: 'C', type: 'retrieve', params: { query: 'test' }, dependencies: ['A'], priority: 3 },
        ],
        parallelGroups: [],
        entryTasks: [],
        exitTasks: [],
      };
      const cycles = detectCircularDependencies(dag);
      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles.some(c => c.includes('A') && c.includes('B') && c.includes('C'))).toBe(true);
    });

    it('should return empty array for valid DAG', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'A', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
          { id: 'B', type: 'retrieve', params: { query: 'test' }, dependencies: ['A'], priority: 2 },
        ],
        parallelGroups: [],
        entryTasks: ['A'],
        exitTasks: ['B'],
      };
      expect(detectCircularDependencies(dag)).toEqual([]);
    });
  });

  describe('detectSelfDependencies', () => {
    it('should detect self-dependency', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: ['task_1'], priority: 1 },
        { id: 'task_2', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 2 },
      ];
      expect(detectSelfDependencies(tasks)).toEqual(['task_1']);
    });

    it('should return empty array when no self-dependencies', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
      ];
      expect(detectSelfDependencies(tasks)).toEqual([]);
    });
  });

  describe('detectParallelInternalDependencies', () => {
    it('should detect internal dependency in parallel group', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1, parallelGroup: 'group_1' },
          { id: 'task_2', type: 'retrieve', params: { query: 'test' }, dependencies: ['task_1'], priority: 2, parallelGroup: 'group_1' },
        ],
        parallelGroups: ['group_1'],
        entryTasks: ['task_1'],
        exitTasks: ['task_2'],
      };
      const result = detectParallelInternalDependencies(dag);
      expect(result).toEqual([{ taskId: 'task_2', dependency: 'task_1', group: 'group_1' }]);
    });

    it('should return empty array for valid parallel groups', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1, parallelGroup: 'group_1' },
          { id: 'task_2', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1, parallelGroup: 'group_1' },
        ],
        parallelGroups: ['group_1'],
        entryTasks: ['task_1', 'task_2'],
        exitTasks: ['task_1', 'task_2'],
      };
      expect(detectParallelInternalDependencies(dag)).toEqual([]);
    });
  });

  describe('checkParallelTypeLimits', () => {
    it('should warn when retrieve type limit exceeded', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1, parallelGroup: 'group_1' },
          { id: 'task_2', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1, parallelGroup: 'group_1' },
          { id: 'task_3', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1, parallelGroup: 'group_1' },
          { id: 'task_4', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1, parallelGroup: 'group_1' },
        ],
        parallelGroups: ['group_1'],
        entryTasks: ['task_1', 'task_2', 'task_3', 'task_4'],
        exitTasks: ['task_1', 'task_2', 'task_3', 'task_4'],
      };
      const warnings = checkParallelTypeLimits(dag);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('retrieve');
      expect(warnings[0].count).toBe(4);
      expect(warnings[0].limit).toBe(3);
    });

    it('should pass when type limit respected', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1, parallelGroup: 'group_1' },
          { id: 'task_2', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1, parallelGroup: 'group_1' },
          { id: 'task_3', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1, parallelGroup: 'group_1' },
        ],
        parallelGroups: ['group_1'],
        entryTasks: ['task_1', 'task_2', 'task_3'],
        exitTasks: ['task_1', 'task_2', 'task_3'],
      };
      expect(checkParallelTypeLimits(dag)).toEqual([]);
    });
  });

  describe('checkPriorityOrder', () => {
    it('should warn when priority order violated', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 5 },
        { id: 'task_2', type: 'generate_answer', params: {}, dependencies: ['task_1'], priority: 3 },
      ];
      const warnings = checkPriorityOrder(tasks);
      expect(warnings).toEqual([{ taskId: 'task_2', depTaskId: 'task_1' }]);
    });

    it('should pass when priority order correct', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
        { id: 'task_2', type: 'generate_answer', params: {}, dependencies: ['task_1'], priority: 7 },
      ];
      expect(checkPriorityOrder(tasks)).toEqual([]);
    });
  });

  describe('detectUnknownToolTypes', () => {
    it('should detect unknown tool types', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
        { id: 'task_2', type: 'unknown_type' as any, params: {}, dependencies: [], priority: 2 },
      ];
      const unknown = detectUnknownToolTypes(tasks);
      expect(unknown).toEqual([{ taskId: 'task_2', type: 'unknown_type' }]);
    });

    it('should pass for known tool types', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
      ];
      expect(detectUnknownToolTypes(tasks)).toEqual([]);
    });
  });

  describe('checkRequiredParams', () => {
    it('should detect missing required params', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
      ];
      const missing = checkRequiredParams(tasks);
      expect(missing).toEqual([{ taskId: 'task_1', param: 'query' }]);
    });

    it('should pass when required params present', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
      ];
      expect(checkRequiredParams(tasks)).toEqual([]);
    });
  });

  describe('calculateDAGStats', () => {
    it('should calculate task count', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'retrieve', params: { query: 'test' }, dependencies: ['task_1'], priority: 2 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1'],
        exitTasks: ['task_2'],
      };
      const stats = calculateDAGStats(dag);
      expect(stats.taskCount).toBe(2);
    });

    it('should calculate max depth', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'retrieve', params: { query: 'test' }, dependencies: ['task_1'], priority: 2 },
          { id: 'task_3', type: 'generate_answer', params: {}, dependencies: ['task_2'], priority: 7 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1'],
        exitTasks: ['task_3'],
      };
      const stats = calculateDAGStats(dag);
      expect(stats.maxDepth).toBe(2);
    });

    it('should calculate critical path length', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'generate_answer', params: {}, dependencies: ['task_1'], priority: 7 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1'],
        exitTasks: ['task_2'],
      };
      const stats = calculateDAGStats(dag);
      expect(stats.criticalPathLength).toBe(2);
    });
  });

  describe('autoCorrectDAG', () => {
    it('should correct self-dependency', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: ['task_1'], priority: 1 },
        ],
        parallelGroups: [],
        entryTasks: [],
        exitTasks: [],
      };
      const result = autoCorrectDAG(dag);
      expect(result.appliedCorrections).toContain('Removed self-dependency from task_1');
      expect(result.correctedDag.tasks[0].dependencies).toEqual([]);
    });

    it('should correct priority order', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 5 },
          { id: 'task_2', type: 'generate_answer', params: {}, dependencies: ['task_1'], priority: 3 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1'],
        exitTasks: ['task_2'],
      };
      const result = autoCorrectDAG(dag);
      expect(result.appliedCorrections.length).toBeGreaterThan(0);
      expect(result.correctedDag.tasks.find(t => t.id === 'task_1')!.priority).toBeLessThan(3);
    });

    it('should correct parallel internal dependency', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1, parallelGroup: 'group_1' },
          { id: 'task_2', type: 'retrieve', params: { query: 'test' }, dependencies: ['task_1'], priority: 2, parallelGroup: 'group_1' },
        ],
        parallelGroups: ['group_1'],
        entryTasks: [],
        exitTasks: [],
      };
      const result = autoCorrectDAG(dag);
      expect(result.appliedCorrections).toContain('Removed task_2 from parallel group');
      expect(result.correctedDag.tasks.find(t => t.id === 'task_2')!.parallelGroup).toBeUndefined();
    });

    it('should not correct circular dependencies', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'A', type: 'retrieve', params: { query: 'test' }, dependencies: ['B'], priority: 1 },
          { id: 'B', type: 'retrieve', params: { query: 'test' }, dependencies: ['A'], priority: 2 },
        ],
        parallelGroups: [],
        entryTasks: [],
        exitTasks: [],
      };
      const result = autoCorrectDAG(dag);
      expect(result.remainingErrors.some(e => e.type === 'circular_dependency')).toBe(true);
    });
  });

  describe('validateDAG (full validation)', () => {
    it('should pass valid DAG', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'retrieve_1', type: 'retrieve', params: { query: 'metformin' }, dependencies: [], priority: 1 },
          { id: 'retrieve_2', type: 'retrieve', params: { query: 'egfr' }, dependencies: [], priority: 1 },
          { id: 'evaluate', type: 'evaluate', params: { results: [] }, dependencies: ['retrieve_1', 'retrieve_2'], priority: 4 },
          { id: 'answer', type: 'generate_answer', params: { context: 'test' }, dependencies: ['evaluate'], priority: 7 },
        ],
        parallelGroups: [],
        entryTasks: ['retrieve_1', 'retrieve_2'],
        exitTasks: ['answer'],
      };
      const result = validateDAG(dag);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should report all errors for invalid DAG', () => {
      const dag: TaskDAG = {
        tasks: [
          { id: 'task_1', type: 'retrieve', params: {}, dependencies: ['task_1'], priority: 1 },
          { id: 'task_1', type: 'unknown' as any, params: {}, dependencies: ['missing'], priority: 5 },
        ],
        parallelGroups: [],
        entryTasks: [],
        exitTasks: [],
      };
      const result = validateDAG(dag);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('helper functions', () => {
    it('removeDependency should remove specific dependency', () => {
      const task: AgentTask = {
        id: 'task_1',
        type: 'retrieve',
        params: { query: 'test' },
        dependencies: ['dep_1', 'dep_2', 'dep_3'],
        priority: 1,
      };
      const result = removeDependency(task, 'dep_2');
      expect(result.dependencies).toEqual(['dep_1', 'dep_3']);
    });

    it('adjustPriority should change priority', () => {
      const task: AgentTask = {
        id: 'task_1',
        type: 'retrieve',
        params: { query: 'test' },
        dependencies: [],
        priority: 1,
      };
      const result = adjustPriority(task, 5);
      expect(result.priority).toBe(5);
    });
  });
});