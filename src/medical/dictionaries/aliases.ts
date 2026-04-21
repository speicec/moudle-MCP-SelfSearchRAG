/**
 * Alias Mapping Table - 别名映射表
 *
 * 将各种别名统一映射到标准ID
 */

import { ALL_DISEASES } from './diseases.js';
import { ALL_ANTIDIABETIC_DRUGS } from './drugs/antidiabetic.js';
import { ALL_ANTIHYPERTENSIVE_DRUGS } from './drugs/antihypertensive.js';
import { ALL_THYROID_DRUGS } from './drugs/thyroid.js';
import { ALL_INDICATORS } from './indicators.js';
import type { DiseaseEntity, DrugEntity, IndicatorEntity } from '../types.js';

/**
 * 别名映射条目
 */
interface AliasMapping {
  alias: string;
  standardId: string;
  entityType: 'disease' | 'drug' | 'indicator';
  canonicalName: string;
}

/**
 * 构建别名映射表
 */
function buildAliasMappings(): AliasMapping[] {
  const mappings: AliasMapping[] = [];

  // 疾病别名映射
  for (const disease of ALL_DISEASES) {
    for (const alias of disease.aliases) {
      mappings.push({
        alias,
        standardId: disease.id,
        entityType: 'disease',
        canonicalName: disease.canonicalName,
      });
    }
    // 添加标准名称本身
    mappings.push({
      alias: disease.canonicalName,
      standardId: disease.id,
      entityType: 'disease',
      canonicalName: disease.canonicalName,
    });
  }

  // 药物别名映射
  const allDrugs = [
    ...ALL_ANTIDIABETIC_DRUGS,
    ...ALL_ANTIHYPERTENSIVE_DRUGS,
    ...ALL_THYROID_DRUGS,
  ];

  for (const drug of allDrugs) {
    for (const alias of drug.aliases) {
      mappings.push({
        alias,
        standardId: drug.id,
        entityType: 'drug',
        canonicalName: drug.canonicalName,
      });
    }
    // 添加品牌名映射
    for (const brand of drug.brands) {
      mappings.push({
        alias: brand,
        standardId: drug.id,
        entityType: 'drug',
        canonicalName: drug.canonicalName,
      });
    }
    // 添加标准名称
    mappings.push({
      alias: drug.canonicalName,
      standardId: drug.id,
      entityType: 'drug',
      canonicalName: drug.canonicalName,
    });
  }

  // 指标别名映射
  for (const indicator of ALL_INDICATORS) {
    for (const alias of indicator.aliases) {
      mappings.push({
        alias,
        standardId: indicator.id,
        entityType: 'indicator',
        canonicalName: indicator.canonicalName,
      });
    }
    // 添加标准名称
    mappings.push({
      alias: indicator.canonicalName,
      standardId: indicator.id,
      entityType: 'indicator',
      canonicalName: indicator.canonicalName,
    });
  }

  return mappings;
}

/**
 * 全部别名映射表
 */
export const ALIAS_MAPPINGS = buildAliasMappings();

/**
 * 别名查找索引（快速查找）
 */
export const ALIAS_INDEX: Map<string, AliasMapping> = new Map(
  ALIAS_MAPPINGS.map(m => [m.alias.toLowerCase(), m])
);

/**
 * 根据别名查找标准实体
 */
export function findByAlias(alias: string): AliasMapping | undefined {
  return ALIAS_INDEX.get(alias.toLowerCase());
}

/**
 * 获取实体的所有别名
 */
export function getAllAliases(standardId: string): string[] {
  return ALIAS_MAPPINGS
    .filter(m => m.standardId === standardId)
    .map(m => m.alias);
}

/**
 * 扩展别名列表（用于检索）
 */
export function expandAliasesForSearch(aliases: string[]): string[] {
  const expanded = new Set<string>();

  for (const alias of aliases) {
    expanded.add(alias);
    const mapping = findByAlias(alias);
    if (mapping) {
      const allAliases = getAllAliases(mapping.standardId);
      for (const a of allAliases) {
        expanded.add(a);
      }
    }
  }

  return Array.from(expanded);
}

/**
 * 获取疾病实体（通过别名）
 */
export function getDiseaseEntityByAlias(alias: string): DiseaseEntity | undefined {
  const mapping = findByAlias(alias);
  if (mapping && mapping.entityType === 'disease') {
    return ALL_DISEASES.find(d => d.id === mapping.standardId);
  }
  return undefined;
}

/**
 * 获取药物实体（通过别名）
 */
export function getDrugEntityByAlias(alias: string): DrugEntity | undefined {
  const mapping = findByAlias(alias);
  if (mapping && mapping.entityType === 'drug') {
    const allDrugs = [
      ...ALL_ANTIDIABETIC_DRUGS,
      ...ALL_ANTIHYPERTENSIVE_DRUGS,
      ...ALL_THYROID_DRUGS,
    ];
    return allDrugs.find(d => d.id === mapping.standardId);
  }
  return undefined;
}

/**
 * 获取指标实体（通过别名）
 */
export function getIndicatorEntityByAlias(alias: string): IndicatorEntity | undefined {
  const mapping = findByAlias(alias);
  if (mapping && mapping.entityType === 'indicator') {
    return ALL_INDICATORS.find(i => i.id === mapping.standardId);
  }
  return undefined;
}