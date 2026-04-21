/**
 * Medical Agent MCP Tool - 医学 Agent MCP 工具定义
 */

import type { MedicalQueryInput, SourceCitation } from './types.js';

/**
 * Medical Agent Tool 定义
 */
export const MEDICAL_AGENT_TOOL = {
  name: 'medical_agent',
  description: '内分泌领域医学智能 Agent，执行完整 ReAct 循环（Think→Act→Observe→Decide→Answer）。支持复杂医学查询、多轮推理、证据评估。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: '医学查询问题，如"糖尿病患者合并肾功能不全eGFR=35，二甲双胍是否还能用，剂量如何调整"',
      },
      domain: {
        type: 'string',
        description: '领域范围',
        enum: ['diabetes', 'hypertension', 'thyroid', 'all'],
        default: 'all',
      },
      max_iterations: {
        type: 'number',
        description: '最大推理迭代次数（默认5）',
        default: 5,
      },
      confidence_threshold: {
        type: 'number',
        description: '置信度阈值（默认0.8）',
        default: 0.8,
      },
    },
    required: ['query'],
  },
};

/**
 * Medical Agent Tool 输入验证器
 */
export function validateMedicalAgentInput(input: unknown): {
  valid: boolean;
  errors: string[];
  data?: MedicalQueryInput & {
    max_iterations?: number;
    confidence_threshold?: number;
  };
} {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const args = input as Record<string, unknown>;

  // 必需参数：query
  if (typeof args.query !== 'string' || args.query.length === 0) {
    errors.push('query is required and must be a non-empty string');
  }

  // 可选参数：domain
  if (args.domain !== undefined) {
    const validDomains = ['diabetes', 'hypertension', 'thyroid', 'all'];
    if (!validDomains.includes(args.domain as string)) {
      errors.push(`domain must be one of: ${validDomains.join(', ')}`);
    }
  }

  // 可选参数：max_iterations
  if (args.max_iterations !== undefined) {
    if (typeof args.max_iterations !== 'number' || args.max_iterations < 1 || args.max_iterations > 10) {
      errors.push('max_iterations must be a number between 1 and 10');
    }
  }

  // 可选参数：confidence_threshold
  if (args.confidence_threshold !== undefined) {
    if (typeof args.confidence_threshold !== 'number' || args.confidence_threshold < 0 || args.confidence_threshold > 1) {
      errors.push('confidence_threshold must be a number between 0 and 1');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 构建有效的输入
  const data: MedicalQueryInput & {
    max_iterations?: number;
    confidence_threshold?: number;
  } = {
    query: args.query as string,
    domain: (args.domain as MedicalQueryInput['domain']) ?? 'all',
  };

  if (args.max_iterations !== undefined) {
    data.max_iterations = args.max_iterations as number;
  }

  if (args.confidence_threshold !== undefined) {
    data.confidence_threshold = args.confidence_threshold as number;
  }

  return { valid: true, errors: [], data };
}

/**
 * 格式化 Agent 结果为 Markdown
 */
export function formatAgentResultAsMarkdown(result: {
  answer: {
    conclusion: { text: string; confidence: string };
    details: { points: Array<{ text: string }> };
    evidenceGrade: { grade: string; sourceType: string };
    sources: Array<{ documentName: string; year?: number; section?: string }>;
    warnings: string[];
  };
  stats: {
    iterations: number;
    actionsExecuted: number;
    totalTimeMs: number;
  };
  satisfied: boolean;
}): string {
  const sections: string[] = [];

  // 结论
  sections.push('## 结论');
  sections.push(result.answer.conclusion.text);
  sections.push(`置信度: ${result.answer.conclusion.confidence}`);
  sections.push('');

  // 详细说明
  if (result.answer.details.points.length > 0) {
    sections.push('## 详细说明');
    for (const point of result.answer.details.points) {
      sections.push(`- ${point.text}`);
    }
    sections.push('');
  }

  // 证据等级
  sections.push('## 证据等级');
  sections.push(`Grade ${result.answer.evidenceGrade.grade} - ${result.answer.evidenceGrade.sourceType}`);
  sections.push('');

  // 来源引用
  if (result.answer.sources.length > 0) {
    sections.push('## 来源引用');
    for (let i = 0; i < result.answer.sources.length; i++) {
      const source = result.answer.sources[i];
      if (source !== undefined) {
        const yearStr = source.year !== undefined ? ` (${source.year})` : '';
        const sectionStr = source.section !== undefined ? `, ${source.section}` : '';
        sections.push(`${i + 1}. ${source.documentName}${yearStr}${sectionStr}`);
      }
    }
    sections.push('');
  }

  // 注意事项
  sections.push('## 注意事项');
  for (const warning of result.answer.warnings) {
    sections.push(`- ${warning}`);
  }
  sections.push('');

  // 执行统计
  sections.push('## Agent 执行统计');
  sections.push(`- 迭代次数: ${result.stats.iterations}`);
  sections.push(`- 执行动作: ${result.stats.actionsExecuted}`);
  sections.push(`- 耗时: ${result.stats.totalTimeMs}ms`);
  sections.push(`- 状态: ${result.satisfied ? '满足' : '未满足（达到最大迭代）'}`);

  return sections.join('\n');
}