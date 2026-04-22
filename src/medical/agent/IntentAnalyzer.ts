/**
 * Intent Analyzer - 意图分析器
 *
 * 分析查询意图，确定检索策略
 */

import type { MedicalEntities } from '../types.js';
import type { IntentAnalysis, QueryType, RetrievalNeedLevel } from './ExecutionTypes.js';

/**
 * 意图分析 Prompt 模板
 */
export const INTENT_ANALYSIS_PROMPT = `你是一个医学查询意图分析专家。

根据以下信息分析查询意图：

## 实体信息
- 疾病: {diseases}
- 药物: {drugs}
- 指标: {indicators}
- 原始查询: {query}

## 分析任务

### 1. 查询类型分类
识别查询属于以下类型（可多选）：
- information_query: 信息查询（如"二甲双胍的作用机制"）
- decision_support: 决策支持（如"eGFR=35能否使用二甲双胍"）
- safety_check: 安全检查（如"二甲双胍禁忌症"）
- comparison: 对比查询（如"二甲双胍vs利拉鲁肽"）

### 2. 主要焦点实体
识别查询的核心关注点：
- primaryFocusEntity: 主要实体ID
- secondaryFocusEntities: 辅助实体ID列表

### 3. 检索需求预测
对每个实体标注检索需求级别：
- required: 必须检索
- recommended: 推荐检索
- optional: 可选检索

### 4. 特殊需求检测
判断是否需要以下特殊处理：
- calculateIndicator: 是否需要计算指标阈值
- checkInteraction: 是否需要检查药物相互作用
- checkContraindication: 是否需要检查禁忌
- requireYearFilter: 是否需要年份过滤

### 5. 预期答案格式
- direct: 直接回答
- comparison: 对比表格/分析
- recommendation: 推荐建议
- safety_warning: 安全警告

## 输出格式
{
  "queryTypes": ["type1", "type2"],
  "primaryFocusEntity": "entity_id",
  "secondaryFocusEntities": ["entity_id2"],
  "retrievalNeeds": {
    "entity_id1": "required",
    "entity_id2": "recommended"
  },
  "specialNeeds": {
    "calculateIndicator": false,
    "checkInteraction": true,
    "checkContraindication": false,
    "requireYearFilter": false
  },
  "expectedAnswerFormat": "direct"
}

请分析并输出结果。`;

/**
 * 分析查询意图
 */
export function analyzeIntent(entities: MedicalEntities, query: string): IntentAnalysis {
  // 1. 查询类型分类
  const queryTypes = classifyQueryTypes(query, entities);

  // 2. 焦点实体识别
  const primaryFocusEntity = identifyPrimaryFocus(entities, query);
  const secondaryFocusEntities = identifySecondaryFocus(entities, query, primaryFocusEntity);

  // 3. 检索需求预测
  const retrievalNeeds = predictRetrievalNeeds(entities, queryTypes);

  // 4. 特殊需求检测
  const specialNeeds = detectSpecialNeeds(entities, query);

  // 5. 预期答案格式
  const expectedAnswerFormat = predictAnswerFormat(queryTypes);

  return {
    queryTypes,
    primaryFocusEntity,
    secondaryFocusEntities,
    retrievalNeeds,
    specialNeeds,
    expectedAnswerFormat,
  };
}

/**
 * 查询类型分类
 */
function classifyQueryTypes(query: string, entities: MedicalEntities): QueryType[] {
  const types: QueryType[] = [];

  // 对比查询
  if (detectComparison(query)) {
    types.push('comparison');
  }

  // 安全检查
  if (detectSafetyCheck(query, entities)) {
    types.push('safety_check');
  }

  // 决策支持（有条件判断）
  if (detectDecisionSupport(query, entities)) {
    types.push('decision_support');
  }

  // 默认为信息查询
  if (types.length === 0) {
    types.push('information_query');
  }

  return types;
}

/**
 * 检测对比意图
 */
function detectComparison(query: string): boolean {
  const patterns = [
    /哪个/,
    /对比/,
    /比较/,
    /区别/,
    /差异/,
    /vs/,
    /versus/,
    /哪个更适合/,
    /哪个更好/,
    /which/,
    /compare/,
  ];
  return patterns.some(p => p.test(query));
}

/**
 * 检测安全检查
 */
function detectSafetyCheck(query: string, entities: MedicalEntities): boolean {
  const safetyPatterns = [
    /禁忌/,
    /副作用/,
    /不良反应/,
    /相互作用/,
    /合用/,
    /contraindication/,
    /interaction/,
    /safety/,
  ];

  // 或者有关系类型匹配
  const hasRelation = entities.relations.some(
    r => r.type === 'contraindication' || r.type === 'precaution' || r.type === 'interaction'
  );

  return safetyPatterns.some(p => p.test(query)) || hasRelation;
}

/**
 * 检测决策支持
 */
function detectDecisionSupport(query: string, entities: MedicalEntities): boolean {
  const decisionPatterns = [
    /能否/,
    /可以/,
    /能不能/,
    /是否/,
    /能不能用/,
    /可以使用/,
    /是否可以/,
    /适用/,
    /不适合/,
    /can I/,
    /should/,
    /whether/,
  ];

  // 或者有指标值（需要条件判断）
  const hasIndicatorValue = entities.indicators.some(i => i.value !== undefined);

  return decisionPatterns.some(p => p.test(query)) || hasIndicatorValue;
}

/**
 * 识别主要焦点实体
 */
function identifyPrimaryFocus(entities: MedicalEntities, query: string): string {
  // 优先级：药物 > 指标 > 疾病
  if (entities.drugs.length > 0) {
    // 找查询中最早出现的药物
    const firstDrug = findFirstMention(query, entities.drugs.map(d => d.matchedTerm));
    const matchedDrug = entities.drugs.find(d => d.matchedTerm === firstDrug);
    return matchedDrug?.id ?? entities.drugs[0]?.id ?? '';
  }

  if (entities.indicators.length > 0) {
    const firstIndicator = findFirstMention(query, entities.indicators.map(i => i.matchedTerm));
    const matchedIndicator = entities.indicators.find(i => i.matchedTerm === firstIndicator);
    return matchedIndicator?.id ?? entities.indicators[0]?.id ?? '';
  }

  if (entities.diseases.length > 0) {
    return entities.diseases[0]?.id ?? '';
  }

  return '';
}

/**
 * 识别次要焦点实体
 */
function identifySecondaryFocus(entities: MedicalEntities, query: string, primary: string): string[] {
  const allIds = [
    ...entities.diseases.map(d => d.id),
    ...entities.drugs.map(d => d.id),
    ...entities.indicators.map(i => i.id),
  ];

  return allIds.filter(id => id !== primary);
}

/**
 * 查找首次提及
 */
function findFirstMention(query: string, terms: string[]): string | undefined {
  const positions = terms
    .map(term => {
      const index = query.indexOf(term);
      return { term, index };
    })
    .filter(p => p.index >= 0)
    .sort((a, b) => a.index - b.index);

  return positions[0]?.term;
}

/**
 * 预测检索需求
 */
function predictRetrievalNeeds(entities: MedicalEntities, queryTypes: QueryType[]): Record<string, RetrievalNeedLevel> {
  const needs: Record<string, RetrievalNeedLevel> = {};

  // 对比查询：所有药物必须检索
  if (queryTypes.includes('comparison')) {
    for (const drug of entities.drugs) {
      needs[drug.id] = 'required';
    }
    for (const disease of entities.diseases) {
      needs[disease.id] = 'recommended';
    }
  }
  // 安全检查：药物和条件必须检索
  else if (queryTypes.includes('safety_check')) {
    for (const drug of entities.drugs) {
      needs[drug.id] = 'required';
    }
    for (const indicator of entities.indicators) {
      needs[indicator.id] = 'required';
    }
  }
  // 决策支持：主要实体必须
  else if (queryTypes.includes('decision_support')) {
    for (const drug of entities.drugs) {
      needs[drug.id] = 'required';
    }
    for (const indicator of entities.indicators) {
      needs[indicator.id] = 'required';
    }
    for (const disease of entities.diseases) {
      needs[disease.id] = 'recommended';
    }
  }
  // 信息查询：主要实体推荐
  else {
    const firstDrug = entities.drugs[0];
    if (firstDrug) {
      needs[firstDrug.id] = 'required';
      for (let i = 1; i < entities.drugs.length; i++) {
        const drug = entities.drugs[i];
        if (drug) {
          needs[drug.id] = 'optional';
        }
      }
    }
    for (const disease of entities.diseases) {
      needs[disease.id] = 'recommended';
    }
    for (const indicator of entities.indicators) {
      needs[indicator.id] = 'optional';
    }
  }

  return needs;
}

/**
 * 检测特殊需求
 */
function detectSpecialNeeds(
  entities: MedicalEntities,
  query: string
): IntentAnalysis['specialNeeds'] {
  const yearValue = extractYearValue(query);
  return {
    calculateIndicator: entities.indicators.some(i => i.value !== undefined),
    checkInteraction: entities.drugs.length >= 2 || /相互作用|合用/.test(query),
    checkContraindication: /禁忌/.test(query) || entities.relations.some(r => r.type === 'contraindication'),
    requireYearFilter: detectYearFilter(query),
    yearValue: yearValue ?? undefined,
  };
}

/**
 * 检测年份过滤
 */
function detectYearFilter(query: string): boolean {
  const patterns = [
    /(\d{4})年/,
    /(\d{4})版/,
    /最近(\d+)年/,
    /latest/,
    /after (\d{4})/,
    /since (\d{4})/,
  ];
  return patterns.some(p => p.test(query));
}

/**
 * 提取年份值
 */
function extractYearValue(query: string): number | undefined {
  const yearMatch = query.match(/(\d{4})年|(\d{4})版/);
  if (yearMatch) {
    const year = yearMatch[1] ?? yearMatch[2];
    return year ? parseInt(year) : undefined;
  }
  return undefined;
}

/**
 * 预测答案格式
 */
function predictAnswerFormat(queryTypes: QueryType[]): IntentAnalysis['expectedAnswerFormat'] {
  if (queryTypes.includes('comparison')) {
    return 'comparison';
  }
  if (queryTypes.includes('safety_check')) {
    return 'safety_warning';
  }
  if (queryTypes.includes('decision_support')) {
    return 'recommendation';
  }
  return 'direct';
}

/**
 * 创建意图分析器
 */
export function createIntentAnalyzer(): {
  analyze: (entities: MedicalEntities, query: string) => IntentAnalysis;
} {
  return {
    analyze: analyzeIntent,
  };
}