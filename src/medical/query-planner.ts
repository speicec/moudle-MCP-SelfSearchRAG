/**
 * Query Planner - 查询规划器
 *
 * 基于医学实体构建检索策略
 */

import type {
  MedicalEntities,
  QueryStrategy,
  MedicalQueryInput,
} from './types.js';
import {
  DEFAULT_MEDICAL_CONFIG,
} from './config.js';
import {
  expandEntityTerms,
  extractMedicalEntities,
} from './entity-recognizer.js';
import {
  getContraindicationsByDrug,
} from './dictionaries/relations.js';
import {
  ALL_DISEASES,
} from './dictionaries/diseases.js';
import {
  ALL_ANTIDIABETIC_DRUGS,
} from './dictionaries/drugs/antidiabetic.js';
import {
  ALL_ANTIHYPERTENSIVE_DRUGS,
} from './dictionaries/drugs/antihypertensive.js';
import {
  ALL_THYROID_DRUGS,
} from './dictionaries/drugs/thyroid.js';
import type { DrugEntity, DiseaseEntity } from './types.js';

/**
 * 全部药物词典（合并）
 */
const ALL_DRUGS: DrugEntity[] = [
  ...ALL_ANTIDIABETIC_DRUGS,
  ...ALL_ANTIHYPERTENSIVE_DRUGS,
  ...ALL_THYROID_DRUGS,
];

/**
 * 构建主查询语句
 *
 * 将实体名称和关键词组合成查询语句
 */
function buildPrimaryQuery(entities: MedicalEntities): string {
  const terms: string[] = [];

  // 添加疾病名称
  for (const disease of entities.diseases) {
    terms.push(disease.canonicalName);
  }

  // 添加药物名称
  for (const drug of entities.drugs) {
    terms.push(drug.canonicalName);
  }

  // 添加指标名称
  for (const indicator of entities.indicators) {
    terms.push(indicator.canonicalName);
    // 如果有数值，添加阈值相关词
    if (indicator.value !== undefined) {
      terms.push(`${indicator.canonicalName} 阈值`);
    }
  }

  // 添加关系关键词
  for (const relation of entities.relations) {
    terms.push(relation.matchedTerm);
  }

  return terms.join(' ');
}

/**
 * 构建扩展术语列表
 *
 * 从别名和关联词构建扩展查询词
 */
export function expandTerms(entities: MedicalEntities): string[] {
  const expandedTerms: string[] = [];

  // 从实体别名扩展
  expandedTerms.push(...expandEntityTerms(entities));

  // 添加药物相关关键词
  for (const drug of entities.drugs) {
    const drugEntity = ALL_DRUGS.find(d => d.id === drug.id);
    if (drugEntity?.keywords) {
      expandedTerms.push(...drugEntity.keywords);
    }
  }

  // 添加疾病相关关键词
  for (const disease of entities.diseases) {
    const diseaseEntity = ALL_DISEASES.find(d => d.id === disease.id);
    if (diseaseEntity?.keywords) {
      expandedTerms.push(...diseaseEntity.keywords);
    }
  }

  // 去重
  return [...new Set(expandedTerms)];
}

/**
 * 构建过滤条件
 *
 * 根据用户配置和实体特性构建检索过滤条件
 */
export function buildFilters(
  entities: MedicalEntities,
  input: MedicalQueryInput,
): QueryStrategy['filters'] {
  const yearRange = input.year_range ?? DEFAULT_MEDICAL_CONFIG.defaultYearRange;

  // 确定领域，选择对应指南来源
  const domain = input.domain ?? DEFAULT_MEDICAL_CONFIG.defaultDomain;
  const guidelineSources: string[] = [];

  if (domain === 'diabetes' || domain === 'all') {
    guidelineSources.push('ada', 'cds', 'kdigo');
  }
  if (domain === 'hypertension' || domain === 'all') {
    guidelineSources.push('esc', 'acc');
  }
  if (domain === 'thyroid' || domain === 'all') {
    guidelineSources.push('ata');
  }

  return {
    yearRange,
    guidelineSources: guidelineSources.length > 0 ? guidelineSources : undefined,
  };
}

/**
 * 构建优先来源列表
 *
 * 基于实体和指南权威性确定检索优先级
 */
export function prioritizeSources(
  entities: MedicalEntities,
  yearRange: [number, number],
): string[] {
  const prioritySources: string[] = [];

  // 根据药物类型确定优先指南
  for (const drug of entities.drugs) {
    if (drug.classification.category === '降糖药') {
      prioritySources.push(`ADA ${yearRange[1]}`, `CDS ${yearRange[1]}`);
    }
    if (drug.classification.category === '降压药') {
      prioritySources.push(`ESC/ESH ${yearRange[1]}`);
    }
    if (drug.classification.category === '甲状腺药物') {
      prioritySources.push(`ATA ${yearRange[1]}`);
    }
  }

  // 根据疾病确定优先指南
  for (const disease of entities.diseases) {
    if (disease.id.includes('diabetes') || disease.id.includes('nephropathy')) {
      prioritySources.push(`ADA ${yearRange[1]}`, `KDIGO ${yearRange[1]}`);
    }
    if (disease.id.includes('hypertension')) {
      prioritySources.push(`ESC/ESH ${yearRange[1]}`);
    }
    if (disease.id.includes('thyroid')) {
      prioritySources.push(`ATA ${yearRange[1]}`);
    }
    if (disease.id.includes('ckd')) {
      prioritySources.push(`KDIGO ${yearRange[1]}`);
    }
  }

  // 去重并保持顺序
  return [...new Set(prioritySources)];
}

/**
 * 构建子查询
 *
 * 针对特定关系（禁忌、慎用）构建专门的查询
 */
function buildSubQueries(entities: MedicalEntities): string[] {
  const subQueries: string[] = [];

  // 如果有禁忌/慎用关系，添加专门查询
  const hasContraindication = entities.relations.some(
    r => r.type === 'contraindication' || r.type === 'precaution'
  );

  if (hasContraindication) {
    for (const drug of entities.drugs) {
      // 查找该药物的禁忌关系
      const contraindications = getContraindicationsByDrug(drug.id);

      for (const contra of contraindications) {
        subQueries.push(
          `${drug.canonicalName} ${contra.condition} ${contra.severity === 'absolute' ? '禁忌' : '慎用'}`
        );

        // 如果有阈值，添加阈值查询
        if (contra.threshold) {
          subQueries.push(
            `${drug.canonicalName} ${contra.threshold.indicator.replace('indicator_', '')} 阈值 ${contra.threshold.value}`
          );
        }
      }
    }
  }

  // 如果有相互作用关系，添加相互作用查询
  const hasInteraction = entities.relations.some(r => r.type === 'interaction');
  if (hasInteraction && entities.drugs.length >= 2) {
    const drugNames = entities.drugs.map(d => d.canonicalName).join(' ');
    subQueries.push(`${drugNames} 药物相互作用`);
  }

  return subQueries;
}

/**
 * 构建查询策略
 *
 * @param input - 医学查询输入
 * @returns 查询策略
 */
export function buildQueryStrategy(input: MedicalQueryInput): QueryStrategy {
  // 提取实体
  const entities = extractMedicalEntities(input.query);

  // 构建主查询
  const primaryQuery = buildPrimaryQuery(entities);

  // 构建扩展术语
  const expandedTerms = DEFAULT_MEDICAL_CONFIG.enableTermExpansion
    ? expandTerms(entities)
    : [];

  // 构建过滤条件
  const filters = buildFilters(entities, input);

  // 构建优先来源
  const prioritySources = prioritizeSources(entities, filters.yearRange ?? DEFAULT_MEDICAL_CONFIG.defaultYearRange);

  // 构建子查询
  const subQueries = buildSubQueries(entities);

  // 将子查询合并到扩展术语中
  if (subQueries.length > 0) {
    expandedTerms.push(...subQueries);
  }

  return {
    primaryQuery,
    expandedTerms: [...new Set(expandedTerms)],
    filters,
    prioritySources,
  };
}

/**
 * 从实体直接构建查询策略
 *
 * @param entities - 已提取的医学实体
 * @param input - 原始输入（可选）
 * @returns 查询策略
 */
export function buildStrategyFromEntities(
  entities: MedicalEntities,
  input?: MedicalQueryInput,
): QueryStrategy {
  const defaultInput: MedicalQueryInput = {
    query: entities.rawQuery,
    domain: 'all',
    include_guidelines: true,
  };

  const mergedInput = input ? { ...defaultInput, ...input } : defaultInput;

  return buildQueryStrategy(mergedInput);
}

/**
 * 获取与查询相关的阈值信息
 *
 * @param entities - 医学实体
 * @returns 阈值描述列表
 */
export function getThresholdInfo(entities: MedicalEntities): string[] {
  const thresholdInfo: string[] = [];

  for (const drug of entities.drugs) {
    const contraindications = getContraindicationsByDrug(drug.id);

    for (const contra of contraindications) {
      if (contra.threshold) {
        thresholdInfo.push(
          `${drug.canonicalName}: ${contra.threshold.indicator.replace('indicator_', '')} ${contra.threshold.operator}${contra.threshold.value} ${contra.severity === 'absolute' ? '禁用' : '慎用'}`
        );
      }
    }
  }

  return thresholdInfo;
}