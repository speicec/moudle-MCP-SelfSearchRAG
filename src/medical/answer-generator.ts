/**
 * Answer Generator - 回答生成器
 *
 * 生成结构化的医学回答
 */

import type {
  MedicalAnswer,
  MedicalEntities,
  SourceCitation,
  DetailPoint,
  ConfidenceLevel,
  GradeLevel,
  EvidenceEvaluation,
} from './types.js';
import {
  MEDICAL_WARNINGS,
  CONFIDENCE_LABELS,
  GRADE_DESCRIPTIONS,
  DEFAULT_MEDICAL_CONFIG,
} from './config.js';
import {
  calculateOverallGrade,
  evaluateMultipleSources,
  getGradeDescription,
} from './evidence-evaluator.js';
import {
  getThresholdInfo,
} from './query-planner.js';

/**
 * 格式化来源引用
 *
 * @param source - 来源信息
 * @returns 格式化的引用文本
 */
export function formatSourceCitation(source: SourceCitation): string {
  const parts: string[] = [source.documentName];

  if (source.year) {
    parts.push(`${source.year}`);
  }

  if (source.section) {
    parts.push(source.section);
  }

  if (source.pageNumber) {
    parts.push(`p.${source.pageNumber}`);
  }

  return parts.join(', ');
}

/**
 * 判断置信度级别
 *
 * @param evaluations - 证据评估列表
 * @param sources - 来源数量
 * @returns 置信度级别
 */
export function determineConfidence(
  evaluations: EvidenceEvaluation[],
  sources: SourceCitation[],
): ConfidenceLevel {
  // 无来源，低置信
  if (sources.length === 0) {
    return 'low';
  }

  // 多来源一致，高置信
  if (sources.length >= 2) {
    const grades = evaluations.map(e => e.grade);
    const hasGradeA = grades.includes('A');
    const hasGradeB = grades.includes('B');

    if (hasGradeA || hasGradeB) {
      return 'high';
    }
  }

  // 单一指南，中置信
  if (sources.length === 1) {
    const evaluation = evaluations[0];
    if (evaluation && (evaluation.grade === 'A' || evaluation.grade === 'B')) {
      return 'medium';
    }
  }

  // 默认低置信
  return 'low';
}

/**
 * 标注不确定性
 *
 * @param confidence - 置信度级别
 * @param grade - GRADE等级
 * @returns 不确定性标注文本
 */
export function annotateUncertainty(
  confidence: ConfidenceLevel,
  grade: GradeLevel,
): string {
  const confidenceLabel = CONFIDENCE_LABELS[confidence];
  const gradeDesc = GRADE_DESCRIPTIONS[grade];

  return `${confidenceLabel}，证据等级：${gradeDesc}`;
}

/**
 * 添加医嘱提醒
 *
 * @returns 医嘱提醒列表
 */
export function addMedicalWarning(): string[] {
  return DEFAULT_MEDICAL_CONFIG.forceMedicalWarning
    ? [...MEDICAL_WARNINGS]
    : [];
}

/**
 * 构建详细说明点
 *
 * @param content - 内容文本
 * @param sources - 相关来源
 * @returns 详细说明点
 */
export function buildDetailPoint(
  content: string,
  sources: SourceCitation[],
): DetailPoint {
  return {
    text: content,
    sources,
  };
}

/**
 * 生成医学回答模板
 *
 * @param entities - 医学实体
 * @param retrievalResults - 检索结果（简化版）
 * @returns 医学回答
 */
export function generateMedicalAnswer(
  entities: MedicalEntities,
  retrievalResults?: Array<{
    content: string;
    source: SourceCitation;
  }>,
): MedicalAnswer {
  // 处理来源
  const sources: SourceCitation[] = retrievalResults?.map(r => r.source) ?? [];

  // 评估证据
  const evaluations = evaluateMultipleSources(sources);

  // 计算综合等级
  const overallGrade = calculateOverallGrade(evaluations);

  // 确定置信度
  const confidence = determineConfidence(evaluations, sources);

  // 构建结论（简化版，实际应用中应由LLM生成）
  const conclusionText = buildConclusionText(entities, retrievalResults);

  // 构建详细说明点
  const detailPoints: DetailPoint[] = retrievalResults?.map(r =>
    buildDetailPoint(r.content, [r.source])
  ) ?? [];

  // 如果有阈值信息，添加到详细说明
  const thresholdInfo = getThresholdInfo(entities);
  if (thresholdInfo.length > 0) {
    detailPoints.push(
      buildDetailPoint(
        `相关阈值信息：\n${thresholdInfo.join('\n')}`,
        []
      )
    );
  }

  // 构建警告列表
  const warnings: string[] = [
    annotateUncertainty(confidence, overallGrade),
  ];

  // 添加时效性警告
  for (const evaluation of evaluations) {
    if (evaluation.expirationWarning) {
      warnings.push(evaluation.expirationWarning);
    }
  }

  // 添加医嘱提醒
  warnings.push(...addMedicalWarning());

  return {
    conclusion: {
      text: conclusionText,
      confidence,
    },
    details: {
      points: detailPoints,
    },
    evidenceGrade: {
      grade: overallGrade,
      sourceType: getGradeDescription(overallGrade),
    },
    sources,
    warnings,
  };
}

/**
 * 构建结论文本（辅助函数）
 */
function buildConclusionText(
  entities: MedicalEntities,
  retrievalResults?: Array<{
    content: string;
    source: SourceCitation;
  }>,
): string {
  // 如果没有检索结果，返回实体信息
  if (!retrievalResults || retrievalResults.length === 0) {
    const entityInfo: string[] = [];

    if (entities.drugs.length > 0) {
      entityInfo.push(`涉及药物：${entities.drugs.map(d => d.canonicalName).join('、')}`);
    }
    if (entities.diseases.length > 0) {
      entityInfo.push(`涉及疾病：${entities.diseases.map(d => d.canonicalName).join('、')}`);
    }
    if (entities.indicators.length > 0) {
      entityInfo.push(`涉及指标：${entities.indicators.map(i => i.canonicalName).join('、')}`);
    }

    return entityInfo.length > 0
      ? `识别到医学实体：${entityInfo.join('；')}。暂无相关文献信息，请上传相关医学文献后再查询。`
      : '未识别到明确的医学实体，请提供更具体的查询内容。';
  }

  // 有检索结果时，返回基于实体的结论提示
  const hasContraindication = entities.relations.some(
    r => r.type === 'contraindication'
  );

  if (hasContraindication && entities.drugs.length > 0) {
    return `关于${entities.drugs.map(d => d.canonicalName).join('、')}的禁忌/慎用问题，请参考以下详细信息。`;
  }

  return `针对您的问题，找到${retrievalResults.length}条相关文献信息。`;
}

/**
 * 格式化回答为Markdown
 *
 * @param answer - 医学回答
 * @returns Markdown格式文本
 */
export function formatAnswerAsMarkdown(answer: MedicalAnswer): string {
  const sections: string[] = [];

  // 结论
  sections.push('## 结论');
  sections.push(`${answer.conclusion.text}`);
  sections.push(`[${CONFIDENCE_LABELS[answer.conclusion.confidence]}]`);
  sections.push('');

  // 详细说明
  sections.push('## 详细说明');
  for (const point of answer.details.points) {
    sections.push(point.text);
    if (point.sources.length > 0) {
      sections.push(`> 来源：${point.sources.map(formatSourceCitation).join('; ')}`);
    }
  }
  sections.push('');

  // 证据等级
  sections.push('## 证据等级');
  sections.push(`Grade ${answer.evidenceGrade.grade} - ${answer.evidenceGrade.sourceType}`);
  sections.push('');

  // 来源引用
  if (answer.sources.length > 0) {
    sections.push('## 来源引用');
    for (let i = 0; i < answer.sources.length; i++) {
      sections.push(`${i + 1}. ${formatSourceCitation(answer.sources[i])}`);
    }
    sections.push('');
  }

  // 注意事项
  sections.push('## 注意事项');
  for (const warning of answer.warnings) {
    sections.push(`- ${warning}`);
  }

  return sections.join('\n');
}