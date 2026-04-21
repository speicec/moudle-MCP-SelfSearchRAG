/**
 * Medical MCP Tool - 医学查询工具
 *
 * 提供内分泌领域医学知识检索的 MCP 工具
 */

import type {
  MedicalQueryInput,
  MedicalQueryOutput,
  MedicalEntities,
  QueryStrategy,
  MedicalAnswer,
  SourceCitation,
} from './types.js';
import {
  extractMedicalEntities,
} from './entity-recognizer.js';
import {
  buildQueryStrategy,
} from './query-planner.js';
import {
  generateMedicalAnswer,
  formatAnswerAsMarkdown,
} from './answer-generator.js';

/**
 * Medical Query Tool 定义
 */
export const MEDICAL_QUERY_TOOL = {
  name: 'medical_query',
  description: '内分泌领域医学知识检索，支持药物、疾病、指标的智能查询。可识别医学实体并返回结构化医学回答。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: '医学查询问题，如"糖尿病患者合并肾功能不全，二甲双胍是否还能用"',
      },
      domain: {
        type: 'string',
        description: '领域范围',
        enum: ['diabetes', 'hypertension', 'thyroid', 'all'],
        default: 'all',
      },
      include_guidelines: {
        type: 'boolean',
        description: '是否优先检索指南',
        default: true,
      },
      year_range: {
        type: 'array',
        description: '年份范围 [start, end]',
        items: { type: 'number' },
        minItems: 2,
        maxItems: 2,
      },
    },
    required: ['query'],
  },
};

/**
 * Medical Query Tool 输入验证器
 */
export function validateMedicalQueryInput(input: unknown): {
  valid: boolean;
  errors: string[];
  data?: MedicalQueryInput;
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

  // 可选参数：include_guidelines
  if (args.include_guidelines !== undefined && typeof args.include_guidelines !== 'boolean') {
    errors.push('include_guidelines must be a boolean');
  }

  // 可选参数：year_range
  if (args.year_range !== undefined) {
    if (!Array.isArray(args.year_range) || args.year_range.length !== 2) {
      errors.push('year_range must be an array of 2 numbers');
    } else {
      const [start, end] = args.year_range as number[];
      if (typeof start !== 'number' || typeof end !== 'number') {
        errors.push('year_range elements must be numbers');
      }
      if (start > end) {
        errors.push('year_range start must be less than or equal to end');
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 构建有效的输入
  const data: MedicalQueryInput = {
    query: args.query as string,
    domain: (args.domain as MedicalQueryInput['domain']) ?? 'all',
    include_guidelines: (args.include_guidelines as boolean) ?? true,
    year_range: args.year_range as [number, number] | undefined,
  };

  return { valid: true, errors: [], data };
}

/**
 * 处理医学查询
 *
 * @param input - 医学查询输入
 * @returns 医学查询输出
 */
export function processMedicalQuery(input: MedicalQueryInput): MedicalQueryOutput {
  // 1. 提取医学实体
  const entities = extractMedicalEntities(input.query);

  // 2. 构建查询策略
  const strategy = buildQueryStrategy(input);

  // 3. 生成医学回答（不含实际检索结果）
  const answer = generateMedicalAnswer(entities);

  return {
    entities,
    strategy,
    answer,
    retrievalResults: undefined, // 实际检索结果需要外部服务
  };
}

/**
 * 处理医学查询（带检索结果）
 *
 * @param input - 医学查询输入
 * @param retrievalResults - 检索结果
 * @returns 医学查询输出
 */
export function processMedicalQueryWithResults(
  input: MedicalQueryInput,
  retrievalResults: Array<{
    content: string;
    source: SourceCitation;
  }>,
): MedicalQueryOutput {
  // 1. 提取医学实体
  const entities = extractMedicalEntities(input.query);

  // 2. 构建查询策略
  const strategy = buildQueryStrategy(input);

  // 3. 生成医学回答（含检索结果）
  const answer = generateMedicalAnswer(entities, retrievalResults);

  return {
    entities,
    strategy,
    answer,
    retrievalResults,
  };
}

/**
 * Medical Query Tool Handler
 *
 * 用于集成到 MCP handlers
 */
export async function handleMedicalQuery(args: unknown): Promise<{
  success: boolean;
  data?: MedicalQueryOutput;
  error?: string;
  markdown?: string;
}> {
  const validation = validateMedicalQueryInput(args);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors.join('; '),
    };
  }

  try {
    const result = processMedicalQuery(validation.data!);

    return {
      success: true,
      data: result,
      markdown: formatAnswerAsMarkdown(result.answer),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error processing medical query',
    };
  }
}

/**
 * 获取 Medical Tool 列表
 *
 * 用于注册到 MCP Server
 */
export function getMedicalToolList() {
  return [MEDICAL_QUERY_TOOL];
}

/**
 * 注册 Medical Tool 到现有工具列表
 */
export function registerMedicalTool(existingTools: unknown[]): unknown[] {
  return [...existingTools, MEDICAL_QUERY_TOOL];
}