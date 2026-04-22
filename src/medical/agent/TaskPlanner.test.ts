/**
 * TaskPlanner Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  plan,
  parsePlanningResponse,
  buildTaskDAG,
  identifyParallelGroups,
  TASK_PLANNER_PROMPT,
} from './TaskPlanner.js';
import type { MedicalEntities } from '../types.js';
import type { AgentTask } from './ExecutionTypes.js';

describe('TaskPlanner', () => {
  const createTestEntities = (overrides?: Partial<MedicalEntities>): MedicalEntities => ({
    diseases: [],
    drugs: [],
    indicators: [],
    relations: [],
    rawQuery: 'test',
    confidence: 0.9,
    ...overrides,
  });

  describe('TASK_PLANNER_PROMPT', () => {
    it('should contain all placeholder fields', () => {
      expect(TASK_PLANNER_PROMPT).toContain('{diseases}');
      expect(TASK_PLANNER_PROMPT).toContain('{drugs}');
      expect(TASK_PLANNER_PROMPT).toContain('{indicators}');
      expect(TASK_PLANNER_PROMPT).toContain('{query}');
      expect(TASK_PLANNER_PROMPT).toContain('{queryTypes}');
      expect(TASK_PLANNER_PROMPT).toContain('{primaryFocus}');
      expect(TASK_PLANNER_PROMPT).toContain('{specialNeeds}');
    });

    it('should define all tool types', () => {
      expect(TASK_PLANNER_PROMPT).toContain('retrieve');
      expect(TASK_PLANNER_PROMPT).toContain('evaluate');
      expect(TASK_PLANNER_PROMPT).toContain('calculate_indicator');
      expect(TASK_PLANNER_PROMPT).toContain('check_contraindication');
      expect(TASK_PLANNER_PROMPT).toContain('check_interaction');
      expect(TASK_PLANNER_PROMPT).toContain('generate_answer');
    });

    it('should include planning rules', () => {
      expect(TASK_PLANNER_PROMPT).toContain('任务分解规则');
      expect(TASK_PLANNER_PROMPT).toContain('依赖规则');
      expect(TASK_PLANNER_PROMPT).toContain('并行规则');
      expect(TASK_PLANNER_PROMPT).toContain('优先级规则');
    });
  });

  describe('plan (simple query)', () => {
    it('should skip planning for simple query', async () => {
      const entities = createTestEntities({
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        rawQuery: '什么是糖尿病',
      });

      const result = await plan(entities, '什么是糖尿病');
      expect(result.success).toBe(false);
      expect(result.complexityLevel).toBe('simple');
      expect(result.usedLLM).toBe(false);
    });

    it('should skip planning for single entity', async () => {
      const entities = createTestEntities({
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        rawQuery: '二甲双胍用法',
      });

      const result = await plan(entities, '二甲双胍用法');
      expect(result.success).toBe(false);
      expect(result.complexityLevel).toBe('simple');
    });
  });

  describe('plan (template match)', () => {
    it('should use template DAG for comparison query', async () => {
      const entities = createTestEntities({
        drugs: [
          { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
          { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
        ],
        rawQuery: '二甲双胍vs利拉鲁肽',
      });

      const result = await plan(entities, '二甲双胍vs利拉鲁肽');
      expect(result.success).toBe(true);
      expect(result.matchedTemplate).toBe('药物对比');
      expect(result.usedLLM).toBe(false);
      expect(result.dag).toBeDefined();
      expect(result.dag?.tasks.length).toBe(5);
    });

    it('should use template DAG for contraindication query', async () => {
      const entities = createTestEntities({
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        rawQuery: '二甲双胍禁忌症',
      });

      const result = await plan(entities, '二甲双胍禁忌症');
      expect(result.success).toBe(true);
      expect(result.matchedTemplate).toBe('药物禁忌检查');
      expect(result.dag?.tasks.some(t => t.type === 'check_contraindication')).toBe(true);
    });

    it('should use template DAG for year filter query', async () => {
      const entities = createTestEntities({
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        rawQuery: '2024年ADA糖尿病指南',
      });

      const result = await plan(entities, '2024年ADA糖尿病指南');
      expect(result.success).toBe(true);
      expect(result.matchedTemplate).toBe('指南年份过滤');
      expect(result.dag?.tasks[0].params.filters?.year).toBe(2024);
    });

    it('should use template DAG for indicator drug query', async () => {
      const entities = createTestEntities({
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        indicators: [{ id: 'indicator_1', canonicalName: 'eGFR', matchedTerm: 'eGFR', unit: 'mL/min/1.73m²', value: 35 }],
        rawQuery: 'eGFR=35能否使用二甲双胍',
      });

      const result = await plan(entities, 'eGFR=35能否使用二甲双胍');
      expect(result.success).toBe(true);
      expect(result.matchedTemplate).toBe('指标药物查询');
      expect(result.dag?.tasks.some(t => t.type === 'calculate_indicator')).toBe(true);
    });
  });

  describe('plan (LLM fallback)', () => {
    it('should use LLM when no template matches', async () => {
      const entities = createTestEntities({
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        indicators: [{ id: 'indicator_1', canonicalName: 'HbA1c', matchedTerm: 'HbA1c', unit: '%', value: 7.5 }],
        rawQuery: 'HbA1c 7.5 二甲双胍效果',
      });

      // Mock LLM call
      const mockLLMCall = async () => JSON.stringify({
        tasks: [
          { id: 'retrieve_drug', type: 'retrieve', params: { query: '二甲双胍效果' }, dependencies: [], priority: 1 },
          { id: 'retrieve_indicator', type: 'retrieve', params: { query: 'HbA1c 7.5' }, dependencies: [], priority: 1 },
          { id: 'evaluate', type: 'evaluate', params: { results: [] }, dependencies: ['retrieve_drug', 'retrieve_indicator'], priority: 4 },
          { id: 'generate_answer', type: 'generate_answer', params: {}, dependencies: ['evaluate'], priority: 7 },
        ],
        parallelGroups: [],
        entryTasks: ['retrieve_drug', 'retrieve_indicator'],
        exitTasks: ['generate_answer'],
      });

      const result = await plan(entities, 'HbA1c 7.5 二甲双胍效果', {
        llmCall: mockLLMCall,
        enableLLMFallback: true,
      });

      expect(result.usedLLM).toBe(true);
      expect(result.dag).toBeDefined();
    });

    it('should fail when LLM returns invalid DAG', async () => {
      const entities = createTestEntities({
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        rawQuery: '糖尿病二甲双胍综合分析',
      });

      const mockLLMCall = async () => 'invalid response';

      const result = await plan(entities, 'test', {
        llmCall: mockLLMCall,
        enableLLMFallback: true,
      });

      expect(result.success).toBe(false);
      expect(result.usedLLM).toBe(true);
    });

    it('should fail without LLM when no template matches', async () => {
      const entities = createTestEntities({
        diseases: [{ id: 'disease_1', canonicalName: '糖尿病', matchedTerm: '糖尿病', aliases: [] }],
        drugs: [{ id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } }],
        indicators: [{ id: 'indicator_1', canonicalName: 'HbA1c', matchedTerm: 'HbA1c', unit: '%', value: 7.5 }],
        rawQuery: '复杂综合查询',
      });

      const result = await plan(entities, '复杂综合查询');
      expect(result.success).toBe(false);
      expect(result.usedLLM).toBe(false);
      expect(result.validationErrors).toBeDefined();
    });
  });

  describe('parsePlanningResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'generate_answer', params: {}, dependencies: ['task_1'], priority: 7 },
        ],
        parallelGroups: [],
        entryTasks: ['task_1'],
        exitTasks: ['task_2'],
      });

      const dag = parsePlanningResponse(response);
      expect(dag).toBeDefined();
      expect(dag?.tasks.length).toBe(2);
    });

    it('should handle response with extra text', () => {
      const response = 'Here is the plan:\n' + JSON.stringify({
        tasks: [
          { id: 'task_1', type: 'retrieve', params: { query: 'test' }, dependencies: [], priority: 1 },
        ],
        parallelGroups: [],
      }) + '\nEnd of plan.';

      const dag = parsePlanningResponse(response);
      expect(dag).toBeDefined();
    });

    it('should return null for invalid JSON', () => {
      expect(parsePlanningResponse('not json')).toBeNull();
      expect(parsePlanningResponse('{invalid}')).toBeNull();
    });

    it('should return null for missing tasks field', () => {
      expect(parsePlanningResponse(JSON.stringify({ parallelGroups: [] }))).toBeNull();
    });

    it('should infer entry and exit tasks if not provided', () => {
      const response = JSON.stringify({
        tasks: [
          { id: 'task_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          { id: 'task_2', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
          { id: 'task_3', type: 'generate_answer', params: {}, dependencies: ['task_1', 'task_2'], priority: 7 },
        ],
      });

      const dag = parsePlanningResponse(response);
      expect(dag?.entryTasks).toEqual(['task_1', 'task_2']);
      expect(dag?.exitTasks).toEqual(['task_3']);
    });

    it('should generate task id if missing', () => {
      const response = JSON.stringify({
        tasks: [
          { type: 'retrieve', params: {}, dependencies: [], priority: 1 },
        ],
      });

      const dag = parsePlanningResponse(response);
      expect(dag?.tasks[0].id).toBeDefined();
    });
  });

  describe('identifyParallelGroups', () => {
    it('should identify parallel groups from tasks', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: {}, dependencies: [], priority: 1, parallelGroup: 'group_a' },
        { id: 'task_2', type: 'retrieve', params: {}, dependencies: [], priority: 1, parallelGroup: 'group_a' },
        { id: 'task_3', type: 'retrieve', params: {}, dependencies: [], priority: 1, parallelGroup: 'group_b' },
        { id: 'task_4', type: 'generate_answer', params: {}, dependencies: ['task_1', 'task_2', 'task_3'], priority: 7 },
      ];

      const groups = identifyParallelGroups(tasks);
      expect(groups).toEqual(['group_a', 'group_b']);
    });

    it('should return empty array when no parallel groups', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
        { id: 'task_2', type: 'generate_answer', params: {}, dependencies: ['task_1'], priority: 7 },
      ];

      const groups = identifyParallelGroups(tasks);
      expect(groups).toEqual([]);
    });
  });

  describe('buildTaskDAG', () => {
    it('should build DAG from tasks', () => {
      const tasks: AgentTask[] = [
        { id: 'retrieve_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
        { id: 'retrieve_2', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
        { id: 'evaluate', type: 'evaluate', params: {}, dependencies: ['retrieve_1', 'retrieve_2'], priority: 4 },
        { id: 'answer', type: 'generate_answer', params: {}, dependencies: ['evaluate'], priority: 7 },
      ];

      const dag = buildTaskDAG(tasks);
      expect(dag.tasks.length).toBe(4);
      expect(dag.entryTasks).toEqual(['retrieve_1', 'retrieve_2']);
      expect(dag.exitTasks).toEqual(['answer']);
      expect(dag.parallelGroups).toEqual([]);
    });

    it('should identify entry tasks correctly', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
        { id: 'task_2', type: 'retrieve', params: {}, dependencies: ['task_1'], priority: 2 },
      ];

      const dag = buildTaskDAG(tasks);
      expect(dag.entryTasks).toEqual(['task_1']);
    });

    it('should identify exit tasks correctly', () => {
      const tasks: AgentTask[] = [
        { id: 'task_1', type: 'retrieve', params: {}, dependencies: [], priority: 1 },
        { id: 'task_2', type: 'retrieve', params: {}, dependencies: ['task_1'], priority: 2 },
      ];

      const dag = buildTaskDAG(tasks);
      expect(dag.exitTasks).toEqual(['task_2']);
    });
  });

  describe('validation and correction', () => {
    it('should validate and auto-correct DAG from template', async () => {
      // Template that might produce invalid DAG (simulated)
      const entities = createTestEntities({
        drugs: [
          { id: 'drug_1', canonicalName: '二甲双胍', matchedTerm: '二甲双胍', aliases: [], classification: { category: '降糖药', subcategory: '胰岛素增敏剂' } },
          { id: 'drug_2', canonicalName: '利拉鲁肽', matchedTerm: '利拉鲁肽', aliases: [], classification: { category: '降糖药', subcategory: 'GLP-1受体激动剂' } },
        ],
        rawQuery: '对比二甲双胍和利拉鲁肽',
      });

      const result = await plan(entities, '对比二甲双胍和利拉鲁肽');
      expect(result.success).toBe(true);
      expect(result.validationErrors).toBeUndefined();
    });
  });
});