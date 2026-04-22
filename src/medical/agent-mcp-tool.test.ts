/**
 * agent-mcp-tool Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  MEDICAL_AGENT_TOOL,
  MEDICAL_AGENT_PLAN_TOOL,
  validateMedicalAgentInput,
  validateMedicalAgentPlanInput,
  formatAgentResultAsMarkdown,
  formatPlanningResultAsMarkdown,
  getMedicalAgentTools,
} from './agent-mcp-tool.js';

describe('agent-mcp-tool', () => {
  describe('MEDICAL_AGENT_TOOL', () => {
    it('should have correct tool name', () => {
      expect(MEDICAL_AGENT_TOOL.name).toBe('medical_agent');
    });

    it('should have required query property', () => {
      expect(MEDICAL_AGENT_TOOL.inputSchema.required).toContain('query');
    });

    it('should have optional properties', () => {
      const props = MEDICAL_AGENT_TOOL.inputSchema.properties;
      expect(props.domain).toBeDefined();
      expect(props.max_iterations).toBeDefined();
      expect(props.confidence_threshold).toBeDefined();
    });
  });

  describe('MEDICAL_AGENT_PLAN_TOOL', () => {
    it('should have correct tool name', () => {
      expect(MEDICAL_AGENT_PLAN_TOOL.name).toBe('medical_agent_plan');
    });

    it('should have required query property', () => {
      expect(MEDICAL_AGENT_PLAN_TOOL.inputSchema.required).toContain('query');
    });

    it('should have planning-specific properties', () => {
      const props = MEDICAL_AGENT_PLAN_TOOL.inputSchema.properties;
      expect(props.enable_planning).toBeDefined();
      expect(props.max_replan_rounds).toBeDefined();
    });

    it('should have default values', () => {
      const props = MEDICAL_AGENT_PLAN_TOOL.inputSchema.properties;
      expect(props.enable_planning?.default).toBe(true);
      expect(props.max_replan_rounds?.default).toBe(2);
    });
  });

  describe('validateMedicalAgentInput', () => {
    it('should validate valid input', () => {
      const input = { query: '二甲双胍用法' };
      const result = validateMedicalAgentInput(input);
      expect(result.valid).toBe(true);
      expect(result.data?.query).toBe('二甲双胍用法');
    });

    it('should reject missing query', () => {
      const input = { domain: 'diabetes' };
      const result = validateMedicalAgentInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('query is required and must be a non-empty string');
    });

    it('should reject empty query', () => {
      const input = { query: '' };
      const result = validateMedicalAgentInput(input);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid domain', () => {
      const input = { query: 'test', domain: 'invalid' };
      const result = validateMedicalAgentInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('domain must be one of'))).toBe(true);
    });

    it('should reject invalid max_iterations', () => {
      const input = { query: 'test', max_iterations: 15 };
      const result = validateMedicalAgentInput(input);
      expect(result.valid).toBe(false);
    });

    it('should accept all optional parameters', () => {
      const input = {
        query: 'test',
        domain: 'diabetes',
        max_iterations: 5,
        confidence_threshold: 0.8,
      };
      const result = validateMedicalAgentInput(input);
      expect(result.valid).toBe(true);
      expect(result.data?.domain).toBe('diabetes');
      expect(result.data?.max_iterations).toBe(5);
    });

    it('should reject non-object input', () => {
      const result = validateMedicalAgentInput('string');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Input must be an object');
    });
  });

  describe('validateMedicalAgentPlanInput', () => {
    it('should validate valid input', () => {
      const input = { query: '二甲双胍vs利拉鲁肽' };
      const result = validateMedicalAgentPlanInput(input);
      expect(result.valid).toBe(true);
      expect(result.data?.query).toBe('二甲双胍vs利拉鲁肽');
      expect(result.data?.enable_planning).toBe(true); // Default
    });

    it('should accept enable_planning false', () => {
      const input = { query: 'test', enable_planning: false };
      const result = validateMedicalAgentPlanInput(input);
      expect(result.valid).toBe(true);
      expect(result.data?.enable_planning).toBe(false);
    });

    it('should reject invalid max_replan_rounds', () => {
      const input = { query: 'test', max_replan_rounds: 10 };
      const result = validateMedicalAgentPlanInput(input);
      expect(result.valid).toBe(false);
    });

    it('should accept all planning parameters', () => {
      const input = {
        query: 'test',
        enable_planning: true,
        max_replan_rounds: 2,
        confidence_threshold: 0.65,
      };
      const result = validateMedicalAgentPlanInput(input);
      expect(result.valid).toBe(true);
    });

    it('should reject non-boolean enable_planning', () => {
      const input = { query: 'test', enable_planning: 'yes' };
      const result = validateMedicalAgentPlanInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be a boolean'))).toBe(true);
    });
  });

  describe('formatAgentResultAsMarkdown', () => {
    it('should format result correctly', () => {
      const result = {
        answer: {
          conclusion: { text: '测试结论', confidence: 'high' },
          details: { points: [{ text: '详细说明点' }] },
          evidenceGrade: { grade: 'A', sourceType: 'guideline' },
          sources: [{ documentName: 'ADA指南', year: 2024 }],
          warnings: ['警告信息'],
        },
        stats: {
          iterations: 3,
          actionsExecuted: 5,
          totalTimeMs: 1000,
        },
        satisfied: true,
      };

      const markdown = formatAgentResultAsMarkdown(result);

      expect(markdown).toContain('## 结论');
      expect(markdown).toContain('测试结论');
      expect(markdown).toContain('## 详细说明');
      expect(markdown).toContain('## 证据等级');
      expect(markdown).toContain('Grade A');
      expect(markdown).toContain('## 来源引用');
      expect(markdown).toContain('ADA指南');
      expect(markdown).toContain('## 注意事项');
      expect(markdown).toContain('## Agent 执行统计');
      expect(markdown).toContain('迭代次数: 3');
    });

    it('should handle empty details', () => {
      const result = {
        answer: {
          conclusion: { text: '结论', confidence: 'high' },
          details: { points: [] },
          evidenceGrade: { grade: 'B', sourceType: 'rct' },
          sources: [],
          warnings: [],
        },
        stats: { iterations: 1, actionsExecuted: 2, totalTimeMs: 500 },
        satisfied: false,
      };

      const markdown = formatAgentResultAsMarkdown(result);
      expect(markdown).toContain('## 结论');
      expect(markdown).not.toContain('详细说明点');
      expect(markdown).toContain('未满足');
    });
  });

  describe('formatPlanningResultAsMarkdown', () => {
    it('should format planning result with DAG', () => {
      const result = {
        answer: {
          conclusion: { text: '结论', confidence: 'high' },
          details: { points: [] },
          evidenceGrade: { grade: 'A', sourceType: 'guideline' },
          sources: [],
          warnings: [],
        },
        entities: {
          diseases: [],
          drugs: [{ id: 'drug_1', canonicalName: '二甲双胍' }],
          indicators: [],
        },
        executedDAG: {
          tasks: [
            { id: 'retrieve_1', type: 'retrieve', status: 'completed' },
            { id: 'answer', type: 'generate_answer', status: 'completed' },
          ],
          parallelGroups: [],
        },
        stats: {
          totalTasks: 3,
          completedTasks: 3,
          failedTasks: 0,
          parallelTasks: 2,
          totalDurationMs: 1500,
          llmCallCount: 1,
          replanningRounds: 0,
        },
        complexityLevel: 'moderate',
        matchedTemplate: '药物禁忌检查',
      };

      const markdown = formatPlanningResultAsMarkdown(result);

      expect(markdown).toContain('## Planning 模式信息');
      expect(markdown).toContain('复杂度级别: moderate');
      expect(markdown).toContain('匹配模板: 药物禁忌检查');
      expect(markdown).toContain('## 执行 DAG');
      expect(markdown).toContain('retrieve_1');
      expect(markdown).toContain('generate_answer');
      expect(markdown).toContain('总任务数: 3');
      expect(markdown).toContain('LLM 调用次数: 1');
    });

    it('should format planning result with replanning history', () => {
      const result = {
        answer: {
          conclusion: { text: '结论', confidence: 'medium' },
          details: { points: [] },
          evidenceGrade: { grade: 'B', sourceType: 'rct' },
          sources: [],
          warnings: [],
        },
        entities: { diseases: [], drugs: [], indicators: [] },
        replanningHistory: [
          { round: 1, triggers: ['coverage_threshold'], supplementalTasks: 2 },
          { round: 2, triggers: ['evidence_quality'], supplementalTasks: 1 },
        ],
        stats: {
          totalTasks: 5,
          completedTasks: 5,
          failedTasks: 0,
          parallelTasks: 3,
          totalDurationMs: 2000,
          llmCallCount: 2,
          replanningRounds: 2,
        },
        complexityLevel: 'complex',
      };

      const markdown = formatPlanningResultAsMarkdown(result);

      expect(markdown).toContain('## 重规划历史');
      expect(markdown).toContain('Round 1');
      expect(markdown).toContain('coverage_threshold');
      expect(markdown).toContain('重规划轮数: 2');
    });

    it('should show fallback reason', () => {
      const result = {
        answer: {
          conclusion: { text: '结论', confidence: 'low' },
          details: { points: [] },
          evidenceGrade: { grade: 'C', sourceType: 'observational' },
          sources: [],
          warnings: ['Planning failed'],
        },
        entities: { diseases: [], drugs: [], indicators: [] },
        stats: {
          totalTasks: 2,
          completedTasks: 2,
          failedTasks: 0,
          parallelTasks: 0,
          totalDurationMs: 500,
          llmCallCount: 0,
          replanningRounds: 0,
        },
        complexityLevel: 'complex',
        fallbackReason: 'Planning failed, reverted to ReAct',
      };

      const markdown = formatPlanningResultAsMarkdown(result);

      expect(markdown).toContain('回退原因: Planning failed, reverted to ReAct');
    });
  });

  describe('getMedicalAgentTools', () => {
    it('should return both tools', () => {
      const tools = getMedicalAgentTools();
      expect(tools.length).toBe(2);
      expect(tools.find(t => t.name === 'medical_agent')).toBeDefined();
      expect(tools.find(t => t.name === 'medical_agent_plan')).toBeDefined();
    });
  });
});