/**
 * Entity Recognizer - 实体识别器
 *
 * 从用户查询中提取医学实体
 */

import {
  ALL_DISEASES,
  getDiseaseById,
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
import {
  ALL_INDICATORS,
  getIndicatorById,
} from './dictionaries/indicators.js';
import {
  findByAlias,
  getAllAliases,
} from './dictionaries/aliases.js';
import { RELATION_KEYWORDS } from './config.js';
import type {
  MedicalEntities,
  DiseaseMatch,
  DrugMatch,
  IndicatorMatch,
  RelationMatch,
  DrugEntity,
} from './types.js';

/**
 * 全部药物词典
 */
const ALL_DRUGS: DrugEntity[] = [
  ...ALL_ANTIDIABETIC_DRUGS,
  ...ALL_ANTIHYPERTENSIVE_DRUGS,
  ...ALL_THYROID_DRUGS,
];

/**
 * 词典匹配结果
 */
interface MatchResult {
  matchedTerm: string;
  entityId: string;
  entityType: 'disease' | 'drug' | 'indicator';
  startPos: number;
  endPos: number;
}

/**
 * 在文本中匹配词典项
 *
 * @param text - 输入文本
 * @param dictionary - 词典项列表
 * @param aliasField - 别名字段名
 * @returns 匹配结果列表
 */
function matchDictionary(
  text: string,
  dictionary: { id: string; canonicalName: string; aliases: string[] }[],
): MatchResult[] {
  const matches: MatchResult[] = [];
  const textLower = text.toLowerCase();

  for (const entity of dictionary) {
    // 检查标准名称
    const canonicalLower = entity.canonicalName.toLowerCase();
    const canonicalIndex = textLower.indexOf(canonicalLower);
    if (canonicalIndex !== -1) {
      matches.push({
        matchedTerm: entity.canonicalName,
        entityId: entity.id,
        entityType: 'disease' as 'disease' | 'drug' | 'indicator',
        startPos: canonicalIndex,
        endPos: canonicalIndex + entity.canonicalName.length,
      });
    }

    // 检查所有别名
    for (const alias of entity.aliases) {
      const aliasLower = alias.toLowerCase();
      const aliasIndex = textLower.indexOf(aliasLower);

      // 跳过太短的别名（避免误匹配）
      if (alias.length < 2) continue;

      if (aliasIndex !== -1) {
        // 检查是否已存在相同位置的匹配（避免重复）
        const existingMatch = matches.find(
          m => m.entityId === entity.id &&
               m.startPos === aliasIndex &&
               m.endPos === aliasIndex + alias.length
        );

        if (!existingMatch) {
          matches.push({
            matchedTerm: alias,
            entityId: entity.id,
            entityType: 'disease' as 'disease' | 'drug' | 'indicator',
            startPos: aliasIndex,
            endPos: aliasIndex + alias.length,
          });
        }
      }
    }
  }

  return matches;
}

/**
 * 匹配疾病词典
 */
export function matchDiseases(text: string): MatchResult[] {
  return matchDictionary(text, ALL_DISEASES);
}

/**
 * 匹配药物词典
 */
export function matchDrugs(text: string): MatchResult[] {
  const results: MatchResult[] = [];

  for (const drug of ALL_DRUGS) {
    const textLower = text.toLowerCase();

    // 检查标准名称
    const canonicalLower = drug.canonicalName.toLowerCase();
    const canonicalIndex = textLower.indexOf(canonicalLower);
    if (canonicalIndex !== -1) {
      results.push({
        matchedTerm: drug.canonicalName,
        entityId: drug.id,
        entityType: 'drug',
        startPos: canonicalIndex,
        endPos: canonicalIndex + drug.canonicalName.length,
      });
    }

    // 检查别名
    for (const alias of drug.aliases) {
      if (alias.length < 2) continue;
      const aliasLower = alias.toLowerCase();
      const aliasIndex = textLower.indexOf(aliasLower);
      if (aliasIndex !== -1) {
        const existingMatch = results.find(
          m => m.entityId === drug.id &&
               m.startPos === aliasIndex &&
               m.endPos === aliasIndex + alias.length
        );
        if (!existingMatch) {
          results.push({
            matchedTerm: alias,
            entityId: drug.id,
            entityType: 'drug',
            startPos: aliasIndex,
            endPos: aliasIndex + alias.length,
          });
        }
      }
    }

    // 检查品牌名
    for (const brand of drug.brands) {
      if (brand.length < 2) continue;
      const brandLower = brand.toLowerCase();
      const brandIndex = textLower.indexOf(brandLower);
      if (brandIndex !== -1) {
        const existingMatch = results.find(
          m => m.entityId === drug.id &&
               m.startPos === brandIndex &&
               m.endPos === brandIndex + brand.length
        );
        if (!existingMatch) {
          results.push({
            matchedTerm: brand,
            entityId: drug.id,
            entityType: 'drug',
            startPos: brandIndex,
            endPos: brandIndex + brand.length,
          });
        }
      }
    }
  }

  return results;
}

/**
 * 匹配指标词典
 */
export function matchIndicators(text: string): MatchResult[] {
  return matchDictionary(text, ALL_INDICATORS);
}

/**
 * 匹配关系关键词
 */
export function matchRelations(text: string): RelationMatch[] {
  const matches: RelationMatch[] = [];
  const textLower = text.toLowerCase();

  for (const [type, keywords] of Object.entries(RELATION_KEYWORDS)) {
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      if (textLower.includes(keywordLower)) {
        matches.push({
          type: type as 'contraindication' | 'precaution' | 'interaction' | 'indication',
          matchedTerm: keyword,
        });
      }
    }
  }

  return matches;
}

/**
 * 从文本中提取数值（用于指标值识别）
 */
function extractIndicatorValue(text: string, indicatorMatch: MatchResult): number | undefined {
  // 查找匹配位置附近的数值
  const nearText = text.slice(Math.max(0, indicatorMatch.startPos - 20), indicatorMatch.endPos + 20);

  // 匹配数值模式
  const numberPattern = /(\d+\.?\d*)/;
  const match = nearText.match(numberPattern);

  if (match && match[1] !== undefined) {
    return parseFloat(match[1]);
  }

  return undefined;
}

/**
 * 扩展实体别名
 *
 * @param entityId - 实体ID
 * @returns 完整别名列表
 */
export function expandAliases(entityId: string): string[] {
  return getAllAliases(entityId);
}

/**
 * 标准化实体
 *
 * 将匹配结果转换为标准化的Match对象
 */
export function normalizeMatch(match: MatchResult): DiseaseMatch | DrugMatch | IndicatorMatch | null {
  const mapping = findByAlias(match.matchedTerm);
  if (!mapping) return null;

  if (mapping.entityType === 'disease') {
    const disease = getDiseaseById(mapping.standardId);
    if (!disease) return null;

    return {
      id: disease.id,
      canonicalName: disease.canonicalName,
      matchedTerm: match.matchedTerm,
      aliases: disease.aliases,
    };
  }

  if (mapping.entityType === 'drug') {
    const drug = ALL_DRUGS.find(d => d.id === mapping.standardId);
    if (!drug) return null;

    return {
      id: drug.id,
      canonicalName: drug.canonicalName,
      matchedTerm: match.matchedTerm,
      aliases: drug.aliases,
      classification: drug.classification,
    };
  }

  if (mapping.entityType === 'indicator') {
    const indicator = getIndicatorById(mapping.standardId);
    if (!indicator) return null;

    // 尝试提取数值
    const value = extractIndicatorValue(match.matchedTerm, match);

    return {
      id: indicator.id,
      canonicalName: indicator.canonicalName,
      matchedTerm: match.matchedTerm,
      unit: indicator.unit,
      value,
    };
  }

  return null;
}

/**
 * 计算置信度
 *
 * 基于匹配数量和质量计算整体置信度
 */
function calculateConfidence(
  diseaseMatches: MatchResult[],
  drugMatches: MatchResult[],
  indicatorMatches: MatchResult[],
  relationMatches: RelationMatch[],
): number {
  // 匹配到的实体数量
  const entityCount = diseaseMatches.length + drugMatches.length + indicatorMatches.length;

  // 有关系关键词加分
  const hasRelations = relationMatches.length > 0;

  // 基础置信度
  let confidence = 0;

  if (entityCount >= 3) {
    confidence = 0.9;
  } else if (entityCount >= 2) {
    confidence = 0.7;
  } else if (entityCount === 1) {
    confidence = 0.5;
  } else {
    confidence = 0.2;
  }

  // 有关系关键词时提升置信度
  if (hasRelations && entityCount >= 1) {
    confidence = Math.min(confidence + 0.1, 0.95);
  }

  return confidence;
}

/**
 * 提取医学实体
 *
 * @param query - 用户查询文本
 * @returns 医学实体识别结果
 */
export function extractMedicalEntities(query: string): MedicalEntities {
  // 并行匹配各词典
  const diseaseMatches = matchDiseases(query);
  const drugMatches = matchDrugs(query);
  const indicatorMatches = matchIndicators(query);
  const relationMatches = matchRelations(query);

  // 标准化匹配结果
  const diseases: DiseaseMatch[] = [];
  const drugs: DrugMatch[] = [];
  const indicators: IndicatorMatch[] = [];

  // 处理疾病匹配
  for (const match of diseaseMatches) {
    const normalized = normalizeMatch(match);
    if (normalized && 'aliases' in normalized && !('classification' in normalized)) {
      // 避免重复
      if (!diseases.find(d => d.id === normalized.id)) {
        diseases.push(normalized as DiseaseMatch);
      }
    }
  }

  // 处理药物匹配
  for (const match of drugMatches) {
    const normalized = normalizeMatch(match);
    if (normalized && 'classification' in normalized) {
      // 避免重复
      if (!drugs.find(d => d.id === normalized.id)) {
        drugs.push(normalized as DrugMatch);
      }
    }
  }

  // 处理指标匹配
  for (const match of indicatorMatches) {
    const normalized = normalizeMatch(match);
    if (normalized && 'unit' in normalized) {
      // 避免重复
      if (!indicators.find(i => i.id === normalized.id)) {
        indicators.push(normalized as IndicatorMatch);
      }
    }
  }

  // 计算置信度
  const confidence = calculateConfidence(
    diseaseMatches,
    drugMatches,
    indicatorMatches,
    relationMatches,
  );

  return {
    diseases,
    drugs,
    indicators,
    relations: relationMatches,
    rawQuery: query,
    confidence,
  };
}

/**
 * 扩展实体查询词
 *
 * @param entities - 医学实体
 * @returns 扩展后的查询词列表
 */
export function expandEntityTerms(entities: MedicalEntities): string[] {
  const expandedTerms: string[] = [];

  // 扩展疾病别名
  for (const disease of entities.diseases) {
    expandedTerms.push(...disease.aliases);
  }

  // 扩展药物别名
  for (const drug of entities.drugs) {
    expandedTerms.push(...drug.aliases);
  }

  // 扩展指标别名
  for (const indicator of entities.indicators) {
    expandedTerms.push(...(findByAlias(indicator.canonicalName)?.alias ? [indicator.canonicalName] : []));
    // 添加指标单位相关词
    if (indicator.value !== undefined) {
      expandedTerms.push(`${indicator.canonicalName} ${indicator.value}`);
    }
  }

  // 去重
  return [...new Set(expandedTerms)];
}