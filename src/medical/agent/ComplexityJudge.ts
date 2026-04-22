/**
 * Complexity Judge - 复杂度判断器
 *
 * 基于规则判断查询复杂度，决定是否启用 Planning
 */

import type { MedicalEntities } from '../types.js';
import type { ComplexityLevel, IntentAnalysis } from './ExecutionTypes.js';

/**
 * 复杂度评估结果
 */
export interface ComplexityAssessment {
  level: ComplexityLevel;
  entityCount: number;
  hasComparison: boolean;
  hasConditions: boolean;
  hasInteraction: boolean;
  needsPlanning: boolean;
  reason: string;
}

/**
 * 评估查询复杂度
 */
export function assessComplexity(entities: MedicalEntities, query: string): ComplexityAssessment {
  const entityCount = countEntities(entities);
  const hasComparison = detectComparisonIntent(query);
  const hasConditions = detectConditions(entities);
  const hasInteraction = entities.drugs.length >= 2;

  // 规则判断
  let level: ComplexityLevel;
  let needsPlanning: boolean;
  let reason: string;

  // 规则 1: 明确年份过滤 → structured，使用模板（优先检查）
  if (detectYearFilter(query)) {
    level = 'structured';
    needsPlanning = true;
    reason = 'Explicit year filter condition detected';
  }
  // 规则 1.5: 禁忌/安全检查 → structured，使用模板
  else if (detectSafetyIntent(query)) {
    level = 'structured';
    needsPlanning = true;
    reason = 'Safety/contraindication intent detected';
  }
  // 规则 1.6: 用药建议 → moderate，启用 Planning（疾病+用药建议需检索多个药物）
  else if (detectDrugRecommendationIntent(query)) {
    level = 'moderate';
    needsPlanning = true;
    reason = 'Drug recommendation intent detected, requires multi-drug retrieval';
  }
  // 规则 2: 单实体 → simple，跳过 Planning
  else if (entityCount <= 1 && !hasComparison && !hasConditions) {
    level = 'simple';
    needsPlanning = false;
    reason = 'Single entity, no complex intent detected';
  }
  // 规则 3: 对比查询 → complex，启用多阶段 Planning
  else if (hasComparison) {
    level = 'complex';
    needsPlanning = true;
    reason = 'Comparison intent detected, requires multi-stage planning';
  }
  // 规则 4: 2-3实体单意图 → moderate，启用单次 Planning
  else if (entityCount >= 2 && entityCount <= 3) {
    level = 'moderate';
    needsPlanning = true;
    reason = 'Multiple entities detected, single-pass planning recommended';
  }
  // 规则 5: 多实体或复杂条件 → complex
  else {
    level = 'complex';
    needsPlanning = true;
    reason = 'Complex query with multiple entities or conditions';
  }

  return {
    level,
    entityCount,
    hasComparison,
    hasConditions,
    hasInteraction,
    needsPlanning,
    reason,
  };
}

/**
 * 计算实体数量
 */
function countEntities(entities: MedicalEntities): number {
  return entities.diseases.length + entities.drugs.length + entities.indicators.length;
}

/**
 * 检测对比意图
 */
function detectComparisonIntent(query: string): boolean {
  const comparisonPatterns = [
    /哪个更适合/,
    /哪个更好/,
    /对比/,
    /比较/,
    /区别/,
    /差异/,
    /哪个/,
    /或/,
    /versus/,
    /vs/,
    /which/,
    /compare/,
  ];

  return comparisonPatterns.some(pattern => pattern.test(query));
}

/**
 * 检测条件（指标值）
 */
function detectConditions(entities: MedicalEntities): boolean {
  // 检查是否有带值的指标
  return entities.indicators.some(ind => {
    // 检查是否在原始查询中包含数值
    const valueMatch = entities.rawQuery.match(new RegExp(`${ind.matchedTerm}[=<>]?(\\d+)`, 'i'));
    return valueMatch !== null || ind.value !== undefined;
  });
}

/**
 * 检测年份过滤条件
 */
function detectYearFilter(query: string): boolean {
  const yearPatterns = [
    /(\d{4})年/,
    /(\d{4})版/,
    /最近(\d+)年/,
    /latest/,
    /recent/,
    /after (\d{4})/,
    /since (\d{4})/,
  ];

  return yearPatterns.some(pattern => pattern.test(query));
}

/**
 * 检测用药建议意图
 */
function detectDrugRecommendationIntent(query: string): boolean {
  const drugRecommendationPatterns = [
    /用什么药/,
    /用什么/,
    /怎么治/,
    /治疗方案/,
    /治疗药物/,
    /推荐药物/,
    /用药建议/,
    /药物选择/,
    /用药/,
  ];

  return drugRecommendationPatterns.some(pattern => pattern.test(query));
}

/**
 * 检测安全/禁忌检查意图
 */
function detectSafetyIntent(query: string): boolean {
  const safetyPatterns = [
    /禁忌/,
    /禁忌症/,
    /禁忌证/,
    /能否使用/,
    /能否用/,
    /能不能用/,
    /可以使用/,
    /副作用/,
    /不良反应/,
    /相互作用/,
    /更安全/,
    /安全性/,
    /contraindication/,
    /safety/,
  ];

  return safetyPatterns.some(pattern => pattern.test(query));
}

/**
 * 检测结构化查询模式
 */
export function detectStructuredPattern(
  entities: MedicalEntities,
  intentAnalysis: IntentAnalysis
): string | null {
  const { specialNeeds } = intentAnalysis;

  // 模式 1: 禁忌检查 + 单药 + 无指标值
  if (
    specialNeeds.checkContraindication &&
    entities.drugs.length === 1 &&
    entities.indicators.length === 0
  ) {
    return 'drug_contraindication';
  }

  // 模式 2: 禁忌检查 + 药物 + 指标值
  if (
    specialNeeds.checkContraindication &&
    entities.drugs.length >= 1 &&
    entities.indicators.length >= 1 &&
    entities.indicators.some(i => i.value !== undefined)
  ) {
    return 'indicator_drug_query';
  }

  // 模式 3: 对比 + 多药
  if (
    intentAnalysis.queryTypes.includes('comparison') &&
    entities.drugs.length >= 2
  ) {
    return 'drug_comparison';
  }

  // 模式 4: 年份过滤
  if (specialNeeds.requireYearFilter) {
    return 'guideline_year_filter';
  }

  return null;
}

// ==================== LLM Fallback for Ambiguous Cases ====================

/**
 * 复杂度评估 Prompt 模板（用于模糊情况）
 */
export const COMPLEXITY_ASSESSMENT_PROMPT = `你是一个医学查询复杂度评估专家。

根据以下信息判断查询的复杂度级别：

## 实体信息
- 疾病: {diseases}
- 药物: {drugs}
- 指标: {indicators}
- 原始查询: {query}

## 复杂度级别定义
- simple: 单实体查询，无需 Planning
- moderate: 2-3实体，单意图，需要单次 Planning
- complex: 多实体/对比/综合意图，需要多阶段 Planning + Replanning
- structured: 明确条件过滤，使用模板 DAG

## 判断标准
1. 实体数量: 单实体 → simple
2. 查询意图: 对比 → complex
3. 条件过滤: 年份/来源 → structured
4. 指标值: 带数值 → moderate/complex

## 输出格式
{
  "level": "simple|moderate|complex|structured",
  "reason": "判断理由",
  "needsPlanning": true|false,
  "estimatedTasks": 数量估计
}

请分析并输出结果。`;

/**
 * 复杂度缓存
 */
const complexityCache = new Map<string, ComplexityAssessment>();

/**
 * 获取缓存的复杂度评估
 */
export function getCachedComplexity(queryHash: string): ComplexityAssessment | undefined {
  return complexityCache.get(queryHash);
}

/**
 * 缓存复杂度评估结果
 */
export function cacheComplexity(queryHash: string, assessment: ComplexityAssessment): void {
  complexityCache.set(queryHash, assessment);
}

/**
 * 生成查询哈希（用于缓存）
 */
export function generateQueryHash(query: string, entities: MedicalEntities): string {
  const entityIds = [
    ...entities.diseases.map(d => d.id),
    ...entities.drugs.map(d => d.id),
    ...entities.indicators.map(i => i.id),
  ].sort();

  return `${query}|${entityIds.join(',')}`;
}

/**
 * 创建复杂度判断器
 */
export function createComplexityJudge(): {
  assess: (entities: MedicalEntities, query: string) => ComplexityAssessment;
  detectPattern: (entities: MedicalEntities, intentAnalysis: IntentAnalysis) => string | null;
  cacheResult: (hash: string, assessment: ComplexityAssessment) => void;
  getCached: (hash: string) => ComplexityAssessment | undefined;
} {
  return {
    assess: assessComplexity,
    detectPattern: detectStructuredPattern,
    cacheResult: cacheComplexity,
    getCached: getCachedComplexity,
  };
}