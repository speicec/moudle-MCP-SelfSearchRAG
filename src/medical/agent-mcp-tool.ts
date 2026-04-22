/**
 * Medical Agent MCP Tool - 医学 Agent MCP 工具定义
 *
 * 支持双模式：ReAct 和 PlanAndExecute
 */

import type { MedicalQueryInput, SourceCitation } from './types.js';
import type { RetrievalVisualization, ExecutionTrace } from './agent/types.js';

/**
 * 格式化可视化简要版
 */
function formatVisualizationBrief(viz: RetrievalVisualization): string {
  const lines: string[] = [];

  // 原始查询
  lines.push(`**原始查询**: "${viz.originalQuery}"`);
  lines.push('');

  // 识别结果
  if (viz.entityMatches.length > 0) {
    lines.push('**识别结果**:');
    for (const match of viz.entityMatches) {
      const valueStr = match.value !== undefined ? `=${match.value}${match.unit ?? ''}` : '';
      lines.push(`- ${match.entityType}: ${match.matchedTerm}${valueStr} → ${match.canonicalName}`);
    }
    lines.push('');
  }

  // 优化查询
  if (viz.queryRewriting.primaryQuery && viz.queryRewriting.primaryQuery !== viz.originalQuery) {
    lines.push(`**优化查询**: "${viz.queryRewriting.primaryQuery}"`);
    if (viz.queryRewriting.expandedTerms.length > 0) {
      lines.push(`  扩展词: ${viz.queryRewriting.expandedTerms.join(', ')}`);
    }
    lines.push('');
  }

  // 执行路径
  lines.push(`**执行路径**: ${viz.executionPath.stages.join(' → ')}`);
  if (viz.executionPath.matchedTemplate) {
    lines.push(`  匹配模板: ${viz.executionPath.matchedTemplate}`);
  }
  lines.push('');

  // 检索结果
  lines.push(`**检索结果**: ${viz.retrievalResultCount}条相关文献`);

  return lines.join('\n');
}

/**
 * Medical Agent Tool 定义（ReAct 模式）
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
 * Medical Agent Plan Tool 定义（Planning 模式）
 */
export const MEDICAL_AGENT_PLAN_TOOL = {
  name: 'medical_agent_plan',
  description: '内分泌领域医学智能 Agent，支持 PlanAndExecute 模式。将复杂查询分解为任务 DAG，支持并行检索、动态重规划。适用于对比查询、多实体查询等复杂场景。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: '医学查询问题，如"二甲双胍和利拉鲁肽哪个更适合肾功能不全患者"',
      },
      domain: {
        type: 'string',
        description: '领域范围',
        enum: ['diabetes', 'hypertension', 'thyroid', 'all'],
        default: 'all',
      },
      enable_planning: {
        type: 'boolean',
        description: '是否启用 Planning 模式（默认 true）',
        default: true,
      },
      max_replan_rounds: {
        type: 'number',
        description: '最大重规划轮数（默认2）',
        default: 2,
      },
      confidence_threshold: {
        type: 'number',
        description: '综合满意度阈值（默认0.65）',
        default: 0.65,
      },
    },
    required: ['query'],
  },
};

/**
 * Planning 模式输入参数
 */
export interface PlanningModeInput extends MedicalQueryInput {
  enable_planning?: boolean;
  max_replan_rounds?: number;
  confidence_threshold?: number;
}

/**
 * Planning 模式输出结果
 */
export interface PlanningModeOutput {
  answer: {
    conclusion: { text: string; confidence: string };
    details: { points: Array<{ text: string }> };
    evidenceGrade: { grade: string; sourceType: string };
    sources: Array<{ documentName: string; year?: number; section?: string }>;
    warnings: string[];
  };
  entities: {
    diseases: Array<{ id: string; canonicalName: string }>;
    drugs: Array<{ id: string; canonicalName: string }>;
    indicators: Array<{ id: string; canonicalName: string }>;
  };
  executedDAG?: {
    tasks: Array<{ id: string; type: string; status: string }>;
    parallelGroups: string[];
  };
  replanningHistory?: Array<{
    round: number;
    triggers: string[];
    supplementalTasks: number;
  }>;
  stats: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    parallelTasks: number;
    totalDurationMs: number;
    llmCallCount: number;
    replanningRounds: number;
  };
  complexityLevel?: string | undefined;
  matchedTemplate?: string | undefined;
  fallbackReason?: string | undefined;
  limitReached?: string | undefined;
  visualization?: RetrievalVisualization | undefined;
  executionTrace?: ExecutionTrace | undefined;
}

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
 * Medical Agent Plan Tool 输入验证器
 */
export function validateMedicalAgentPlanInput(input: unknown): {
  valid: boolean;
  errors: string[];
  data?: PlanningModeInput;
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

  // 可选参数：enable_planning
  if (args.enable_planning !== undefined) {
    if (typeof args.enable_planning !== 'boolean') {
      errors.push('enable_planning must be a boolean');
    }
  }

  // 可选参数：max_replan_rounds
  if (args.max_replan_rounds !== undefined) {
    if (typeof args.max_replan_rounds !== 'number' || args.max_replan_rounds < 0 || args.max_replan_rounds > 5) {
      errors.push('max_replan_rounds must be a number between 0 and 5');
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
  const data: PlanningModeInput = {
    query: args.query as string,
    domain: (args.domain as MedicalQueryInput['domain']) ?? 'all',
    enable_planning: (args.enable_planning as boolean) ?? true,
  };

  if (args.max_replan_rounds !== undefined) {
    data.max_replan_rounds = args.max_replan_rounds as number;
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
  visualization?: RetrievalVisualization | undefined;
}): string {
  const sections: string[] = [];

  // 检索分析（在结论之前）
  if (result.visualization) {
    sections.push('## 🔍 检索分析');
    sections.push(formatVisualizationBrief(result.visualization));
    sections.push('');
  }

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

/**
 * 格式化 Planning 模式结果为 Markdown
 */
export function formatPlanningResultAsMarkdown(result: PlanningModeOutput): string {
  const sections: string[] = [];

  // 检索分析（在结论之前）
  if (result.visualization) {
    sections.push('## 🔍 检索分析');
    sections.push(formatVisualizationBrief(result.visualization));
    sections.push('');
  }

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
  if (result.answer.warnings.length > 0) {
    sections.push('## 注意事项');
    for (const warning of result.answer.warnings) {
      sections.push(`- ${warning}`);
    }
    sections.push('');
  }

  // Planning 模式信息
  if (result.complexityLevel) {
    sections.push('## Planning 模式信息');
    sections.push(`- 复杂度级别: ${result.complexityLevel}`);
    if (result.matchedTemplate) {
      sections.push(`- 匹配模板: ${result.matchedTemplate}`);
    }
    if (result.fallbackReason) {
      sections.push(`- 回退原因: ${result.fallbackReason}`);
    }
    sections.push('');
  }

  // 执行 DAG（如果有）
  if (result.executedDAG) {
    sections.push('## 执行 DAG');
    for (const task of result.executedDAG.tasks) {
      sections.push(`- ${task.id} (${task.type}): ${task.status}`);
    }
    if (result.executedDAG.parallelGroups.length > 0) {
      sections.push(`并行组: ${result.executedDAG.parallelGroups.join(', ')}`);
    }
    sections.push('');
  }

  // 重规划历史（如果有）
  if (result.replanningHistory && result.replanningHistory.length > 0) {
    sections.push('## 重规划历史');
    for (const history of result.replanningHistory) {
      sections.push(`- Round ${history.round}: 触发原因 ${history.triggers.join(', ')}, 补充任务 ${history.supplementalTasks} 个`);
    }
    sections.push('');
  }

  // 执行统计
  sections.push('## Agent 执行统计');
  sections.push(`- 总任务数: ${result.stats.totalTasks}`);
  sections.push(`- 完成任务: ${result.stats.completedTasks}`);
  sections.push(`- 失败任务: ${result.stats.failedTasks}`);
  sections.push(`- 并行任务: ${result.stats.parallelTasks}`);
  sections.push(`- LLM 调用次数: ${result.stats.llmCallCount}`);
  sections.push(`- 重规划轮数: ${result.stats.replanningRounds}`);
  sections.push(`- 耗时: ${result.stats.totalDurationMs}ms`);

  return sections.join('\n');
}

/**
 * 获取所有 MCP 工具定义
 */
export function getMedicalAgentTools() {
  return [
    MEDICAL_AGENT_TOOL,
    MEDICAL_AGENT_PLAN_TOOL,
  ];
}