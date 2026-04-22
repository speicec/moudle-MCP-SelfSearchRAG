/**
 * Threshold Extractor - 阈值条件提取器
 *
 * 从用户查询中提取完整的临床阈值条件（指标+运算符+数值+单位）
 */

import type { ThresholdCondition, IndicatorEntity } from './types.js';
import { ALL_INDICATORS, getIndicatorById } from './dictionaries/indicators.js';
import { matchIndicators } from './entity-recognizer.js';

/**
 * 扩展的阈值条件（包含单位和验证状态）
 */
export interface ExtractedThreshold {
  indicator: string;
  indicatorName: string;
  operator: '<' | '>' | '=' | '<=' | '>=';
  value: number;
  unit?: string | undefined;
  isValidUnit: boolean;
  sourceText: string;
}

/**
 * 运算符正则（含 Unicode ≤≥）
 */
const OPERATOR_PATTERN = /[<>=≤≥]/;

/**
 * 运算符标准化映射
 */
const OPERATOR_NORMALIZE: Record<string, ThresholdCondition['operator']> = {
  '<': '<',
  '>': '>',
  '=': '=',
  '≤': '<=',
  '≥': '>=',
};

/**
 * 数值正则
 */
const VALUE_PATTERN = /(\d+\.?\d*)/;

/**
 * 单位正则
 */
const UNIT_PATTERN = /(mL\/min(?:\/1\.73m²)?|mmol\/L|mg\/dL|%|mmHg|mIU\/L|pmol\/L|μmol\/L|mg\/g|IU\/mL|kg(?:\/m²)?|次\/分)/i;

/**
 * 从文本中提取阈值条件
 *
 * @param text - 输入文本（如 "eGFR < 30 禁用二甲双胍"）
 * @returns 提取的阈值条件数组
 */
export function extractThresholds(text: string): ExtractedThreshold[] {
  const thresholds: ExtractedThreshold[] = [];

  // 先匹配指标名
  const indicatorMatches = matchIndicators(text);

  for (const match of indicatorMatches) {
    // 在指标附近 ±30 字符查找阈值条件
    const startPos = Math.max(0, match.startPos - 30);
    const endPos = Math.min(text.length, match.endPos + 30);
    const nearText = text.slice(startPos, endPos);

    // 查找运算符
    const operatorMatch = nearText.match(OPERATOR_PATTERN);
    if (!operatorMatch || operatorMatch[0] === undefined) continue;

    const operator = OPERATOR_NORMALIZE[operatorMatch[0]] ?? '=';

    // 查找数值
    const valueMatch = nearText.match(VALUE_PATTERN);
    if (!valueMatch || valueMatch[1] === undefined) continue;

    const value = parseFloat(valueMatch[1]);

    // 查找单位
    const unitMatch = nearText.match(UNIT_PATTERN);
    const unit = unitMatch?.[0];

    // 获取指标实体以验证单位
    const indicator = getIndicatorById(match.entityId);

    // 单位验证
    let isValidUnit = false;
    if (unit !== undefined && indicator !== undefined) {
      isValidUnit = validateUnit(unit, indicator);
    } else if (unit === undefined && indicator !== undefined) {
      // 无单位时，假设使用标准单位（部分匹配）
      isValidUnit = true;
    }

    thresholds.push({
      indicator: match.entityId,
      indicatorName: match.matchedTerm,
      operator,
      value,
      unit,
      isValidUnit,
      sourceText: nearText.trim(),
    });
  }

  // 去重（同一指标可能多次匹配）
  return deduplicateThresholds(thresholds);
}

/**
 * 验证单位是否与指标匹配
 */
function validateUnit(unit: string, indicator: IndicatorEntity): boolean {
  const normalizedUnit = unit.toLowerCase().replace(/\s+/g, '');
  const expectedUnit = indicator.unit.toLowerCase().replace(/\s+/g, '');

  // 精确匹配
  if (normalizedUnit === expectedUnit) return true;

  // 单位别名匹配（常见单位变体）
  const unitAliases: Record<string, string[]> = {
    'mL/min/1.73m²': ['ml/min', 'ml/min/1.73', 'ml/min/1.73m2'],
    'mmol/L': ['mmol', 'mmol/l'],
    'mg/dL': ['mg', 'mg/dl'],
    'mmHg': ['mmhg', 'mmhg'],
    '%': ['percent', '百分比'],
  };

  const aliases = unitAliases[expectedUnit] ?? [];
  return aliases.includes(normalizedUnit);
}

/**
 * 去重阈值
 */
function deduplicateThresholds(thresholds: ExtractedThreshold[]): ExtractedThreshold[] {
  const seen = new Set<string>();
  const result: ExtractedThreshold[] = [];

  for (const t of thresholds) {
    const key = `${t.indicator}:${t.operator}:${t.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }

  return result;
}

/**
 * 将 ExtractedThreshold 转换为 ThresholdCondition（用于禁忌匹配）
 */
export function toThresholdCondition(extracted: ExtractedThreshold): ThresholdCondition {
  return {
    indicator: extracted.indicator,
    operator: extracted.operator,
    value: extracted.value,
  };
}

/**
 * 检查阈值条件是否匹配
 *
 * @param patientValue - 患者指标值
 * @param threshold - 禁忌阈值条件
 * @returns 是否匹配
 */
export function matchesThreshold(patientValue: number, threshold: ThresholdCondition): boolean {
  switch (threshold.operator) {
    case '<':
      return patientValue < threshold.value;
    case '>':
      return patientValue > threshold.value;
    case '=':
      return patientValue === threshold.value;
    case '<=':
      return patientValue <= threshold.value;
    case '>=':
      return patientValue >= threshold.value;
    default:
      return false;
  }
}

/**
 * 从查询中提取患者指标值
 *
 * 当用户输入明确指标值时（如 "我的eGFR是35"），提取用于禁忌匹配
 */
export function extractPatientIndicatorValues(query: string): Map<string, number> {
  const values = new Map<string, number>();

  const thresholds = extractThresholds(query);
  for (const t of thresholds) {
    // 假设用户提供的值是当前状态，用于判断禁忌
    values.set(t.indicator, t.value);
  }

  return values;
}