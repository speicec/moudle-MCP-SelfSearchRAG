/**
 * Medical Agent Configuration
 */

import type { MedicalQueryInput, QueryStrategy } from './types.js';

/**
 * Medical Agent 配置
 */
export interface MedicalAgentConfig {
  /** 识别置信度阈值，低于此值时标注低置信 */
  recognitionConfidenceThreshold: number;

  /** 默认年份范围 [start, end] */
  defaultYearRange: [number, number];

  /** 指南时效性阈值（年），超过此值标注可能过期 */
  guidelineExpirationYears: number;

  /** 是否强制添加医嘱提醒 */
  forceMedicalWarning: boolean;

  /** 是否启用别名扩展 */
  enableAliasExpansion: boolean;

  /** 是否启用术语扩展检索 */
  enableTermExpansion: boolean;

  /** 优先指南来源 */
  priorityGuidelines: string[];

  /** 默认查询领域 */
  defaultDomain: 'diabetes' | 'hypertension' | 'thyroid' | 'all';
}

/**
 * 默认配置
 */
export const DEFAULT_MEDICAL_CONFIG: MedicalAgentConfig = {
  recognitionConfidenceThreshold: 0.6,
  defaultYearRange: [2020, 2024],
  guidelineExpirationYears: 5,
  forceMedicalWarning: true,
  enableAliasExpansion: true,
  enableTermExpansion: true,
  priorityGuidelines: ['ada', 'cds', 'kdigo', 'esc'],
  defaultDomain: 'all',
};

/**
 * 医嘱提醒文案
 */
export const MEDICAL_WARNINGS = [
  '本回答仅供参考，不能替代专业医疗建议',
  '请结合患者具体情况，遵医嘱用药',
  '如有疑问，请咨询专业医生或药师',
];

/**
 * 置信度文案映射
 */
export const CONFIDENCE_LABELS: Record<'high' | 'medium' | 'low', string> = {
  high: '置信度: 高',
  medium: '置信度: 中',
  low: '置信度: 低',
};

/**
 * GRADE等级描述
 */
export const GRADE_DESCRIPTIONS: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: '高质量证据',
  B: '中高质量证据',
  C: '中等质量证据',
  D: '低质量证据',
};

/**
 * 文献类型中文映射
 */
export const LITERATURE_TYPE_LABELS: Record<string, string> = {
  rct: '随机对照试验',
  meta_analysis: 'Meta分析',
  guideline: '临床指南',
  observational: '观察研究',
  case_report: '病例报告',
  expert_opinion: '专家意见',
};

/**
 * 关系类型关键词
 */
export const RELATION_KEYWORDS = {
  contraindication: ['禁用', '不能用', '绝对禁忌', '禁忌', '禁止', '禁止使用', 'contraindicated', 'contraindication'],
  precaution: ['慎用', '谨慎', '小心', '相对禁忌', '注意', 'precaution', 'caution', 'careful'],
  interaction: ['配伍', '合用', '同时使用', '联用', '联合用药', 'interaction', 'combine'],
  indication: ['可以用', '适合', '推荐', '适应', '适应症', 'indicated', 'indication', 'recommend'],
};

/**
 * 根据输入构建查询策略的默认参数
 */
export function buildDefaultStrategyParams(input: MedicalQueryInput): Partial<QueryStrategy> {
  const yearRange = input.year_range ?? DEFAULT_MEDICAL_CONFIG.defaultYearRange;

  return {
    filters: {
      yearRange,
      guidelineSources: DEFAULT_MEDICAL_CONFIG.priorityGuidelines,
    },
    prioritySources: DEFAULT_MEDICAL_CONFIG.priorityGuidelines.map(g => `${g.toUpperCase()} ${yearRange[1]}`),
  };
}