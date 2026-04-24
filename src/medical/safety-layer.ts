/**
 * Medical Safety Layer - 医学安全预检查层
 *
 * 在 Agent 循环开始前执行禁忌阈值匹配和药物相互作用检测
 */

import type {
  MedicalEntities,
  DrugMatch,
  ThresholdCondition,
  ContraindicationRelation,
  DrugInteractionRelation,
} from './types.js';
import {
  ALL_CONTRAINDICATIONS,
  DRUG_INTERACTIONS,
  getContraindicationsByDrug,
  getInteractionsByDrug,
} from './dictionaries/relations.js';
import {
  ExtractedThreshold,
  toThresholdCondition,
  matchesThreshold,
} from './threshold-extractor.js';

/**
 * 禁忌匹配结果
 */
export interface ContraindicationMatch {
  contraindication: ContraindicationRelation;
  matchedThreshold: ExtractedThreshold;
  severity: 'absolute' | 'relative';
}

/**
 * 安全评估结果
 *
 * 任务 4.1.1: 在 SafetyAssessment 输出中添加 alertTriggered 字段
 */
export interface SafetyAssessment {
  severity: 'absolute' | 'relative' | 'interaction' | 'safe';
  contraindicationMatches: ContraindicationMatch[];
  interactions: DrugInteractionRelation[];
  recommendation: string;
  sourceGlossary: string[];
  alertTriggered?: boolean; // 是否触发了告警
  alertId?: string; // 告警 ID（如果触发）
}

/**
 * Safety Layer 输出（包含答案状态）
 *
 * 任务 4.2.1: 在 SafetyLayerOutput 中添加 answerStatus 字段
 */
export interface SafetyLayerOutput {
  assessment: SafetyAssessment;
  answerStatus: 'normal' | 'blocked_pending_review' | 'attention_required';
  blockedReason?: string;
}

/**
 * 指南来源映射
 */
const GUIDELINE_SOURCE_NAMES: Record<string, string> = {
  ada: 'ADA Standards of Care',
  kdigo: 'KDIGO Guidelines',
  esc: 'ESC Guidelines',
  ata: 'ATA Guidelines',
};

/**
 * 检查禁忌阈值匹配
 *
 * @param drugs - 识别的药物列表
 * @param thresholds - 提取的阈值条件
 * @returns 禁忌匹配结果列表
 */
export function checkContraindications(
  drugs: DrugMatch[],
  thresholds: ExtractedThreshold[],
): ContraindicationMatch[] {
  const matches: ContraindicationMatch[] = [];

  for (const drug of drugs) {
    // 获取该药物的所有禁忌关系
    const contraindications = getContraindicationsByDrug(drug.id);

    for (const contra of contraindications) {
      // 只检查有明确阈值的禁忌
      if (contra.threshold === undefined) continue;

      // 查找匹配的阈值条件
      for (const extracted of thresholds) {
        if (extracted.indicator !== contra.threshold.indicator) continue;

        // 检查患者值是否满足禁忌条件
        const patientValue = extracted.value;
        const contraThreshold = contra.threshold;

        if (matchesThreshold(patientValue, contraThreshold)) {
          matches.push({
            contraindication: contra,
            matchedThreshold: extracted,
            severity: contra.severity,
          });
        }
      }
    }
  }

  // 按严重程度排序（absolute优先）
  return matches.sort((a, b) => {
    if (a.severity === 'absolute' && b.severity !== 'absolute') return -1;
    if (a.severity !== 'absolute' && b.severity === 'absolute') return 1;
    return 0;
  });
}

/**
 * 检查药物相互作用
 *
 * @param drugs - 识别的药物列表
 * @returns 相互作用列表
 */
export function checkInteractions(drugs: DrugMatch[]): DrugInteractionRelation[] {
  const interactions: DrugInteractionRelation[] = [];
  const drugIds = drugs.map(d => d.id);

  for (const drugId of drugIds) {
    const drugInteractions = getInteractionsByDrug(drugId);

    for (const interaction of drugInteractions) {
      // 检查另一个药物是否也在用户的药物列表中
      const otherDrugId = interaction.drug1 === drugId ? interaction.drug2 : interaction.drug1;
      if (drugIds.includes(otherDrugId)) {
        // 避免重复添加
        if (!interactions.find(i => i.id === interaction.id)) {
          interactions.push(interaction);
        }
      }
    }
  }

  // 按严重程度排序（major优先）
  return interactions.sort((a, b) => {
    if (a.type === 'major' && b.type !== 'major') return -1;
    if (a.type !== 'major' && b.type === 'major') return 1;
    return 0;
  });
}

/**
 * 执行完整的安全预检查
 *
 * @param entities - 医学实体识别结果
 * @param thresholds - 提取的阈值条件
 * @returns 安全评估结果
 */
export function performSafetyCheck(
  entities: MedicalEntities,
  thresholds: ExtractedThreshold[],
): SafetyAssessment {
  // 检查禁忌
  const contraindicationMatches = checkContraindications(entities.drugs, thresholds);

  // 检查相互作用
  const interactions = checkInteractions(entities.drugs);

  // 确定严重程度
  let severity: SafetyAssessment['severity'] = 'safe';

  if (contraindicationMatches.some(m => m.severity === 'absolute')) {
    severity = 'absolute';
  } else if (contraindicationMatches.some(m => m.severity === 'relative')) {
    severity = 'relative';
  } else if (interactions.length > 0) {
    severity = 'interaction';
  }

  // 生成推荐
  const recommendation = generateRecommendation(severity, contraindicationMatches, interactions);

  // 收集指南来源
  const sourceGlossary = collectSources(contraindicationMatches, interactions);

  return {
    severity,
    contraindicationMatches,
    interactions,
    recommendation,
    sourceGlossary,
  };
}

/**
 * 生成推荐文本
 */
function generateRecommendation(
  severity: SafetyAssessment['severity'],
  matches: ContraindicationMatch[],
  interactions: DrugInteractionRelation[],
): string {
  if (severity === 'safe') {
    return '无明显禁忌或相互作用风险';
  }

  const lines: string[] = [];

  if (severity === 'absolute') {
    const absoluteMatches = matches.filter(m => m.severity === 'absolute');
    for (const match of absoluteMatches) {
      lines.push(match.contraindication.description);
    }
  }

  if (severity === 'relative') {
    const relativeMatches = matches.filter(m => m.severity === 'relative');
    for (const match of relativeMatches) {
      lines.push(match.contraindication.description);
    }
  }

  if (severity === 'interaction') {
    for (const interaction of interactions) {
      lines.push(`${interaction.description}。建议：${interaction.recommendation}`);
    }
  }

  return lines.join('\n');
}

/**
 * 收集指南来源
 */
function collectSources(
  matches: ContraindicationMatch[],
  interactions: DrugInteractionRelation[],
): string[] {
  const sources = new Set<string>();

  for (const match of matches) {
    const sourceName = GUIDELINE_SOURCE_NAMES[match.contraindication.source];
    if (sourceName !== undefined) {
      sources.add(`${sourceName} ${match.contraindication.year}`);
    }
  }

  for (const interaction of interactions) {
    const sourceName = GUIDELINE_SOURCE_NAMES[interaction.source];
    if (sourceName !== undefined) {
      sources.add(`${sourceName} ${interaction.year}`);
    }
  }

  return [...sources];
}

/**
 * 创建默认的安全评估（无风险）
 */
export function createSafeAssessment(): SafetyAssessment {
  return {
    severity: 'safe',
    contraindicationMatches: [],
    interactions: [],
    recommendation: '无明显禁忌或相互作用风险',
    sourceGlossary: [],
    alertTriggered: false,
  };
}

/**
 * 创建 Safety Layer 输出
 *
 * 任务 4.2.2: severity='absolute' 时设置 answerStatus='blocked_pending_review'
 */
export function createSafetyLayerOutput(
  assessment: SafetyAssessment,
): SafetyLayerOutput {
  let answerStatus: SafetyLayerOutput['answerStatus'] = 'normal';
  let blockedReason: string | undefined;

  if (assessment.severity === 'absolute') {
    answerStatus = 'blocked_pending_review';
    blockedReason = '安全禁忌绝对禁忌，答案需要人工审核后才能发布';
  } else if (assessment.severity === 'relative') {
    answerStatus = 'attention_required';
    blockedReason = '安全禁忌相对禁忌，建议人工复核';
  }

  return {
    assessment,
    answerStatus,
    ...(blockedReason && { blockedReason }),
  };
}