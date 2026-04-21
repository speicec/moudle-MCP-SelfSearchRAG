/**
 * Evidence Evaluator - 证据评估器
 *
 * 评估检索结果的证据等级
 */

import type {
  EvidenceEvaluation,
  LiteratureType,
  GradeLevel,
  SourceCitation,
} from './types.js';
import {
  GRADE_DESCRIPTIONS,
  LITERATURE_TYPE_LABELS,
  DEFAULT_MEDICAL_CONFIG,
} from './config.js';
import {
  getGuidelineById,
  checkGuidelineTimeliness,
} from './dictionaries/guidelines.js';

/**
 * 文献类型关键词映射
 */
const LITERATURE_TYPE_KEYWORDS: Record<LiteratureType, string[]> = {
  rct: ['RCT', 'Randomized Controlled Trial', '随机对照试验', '双盲', '随机分组', '对照组'],
  meta_analysis: ['Meta', 'Meta分析', '荟萃分析', '系统评价', 'Systematic Review', '荟萃'],
  guideline: ['指南', 'Guideline', 'Guidelines', '标准', 'Standards', '共识', 'Consensus', '建议', 'Recommendation'],
  observational: ['观察', 'Observational', '队列研究', 'Cohort', '回顾性', '前瞻性', '横断面'],
  case_report: ['病例报告', 'Case Report', '病例', '个案'],
  expert_opinion: ['专家', 'Expert', '意见', 'Opinion', '观点', 'Viewpoint', '综述', 'Review'],
};

/**
 * 识别文献类型
 *
 * @param text - 文本内容或标题
 * @returns 识别的文献类型
 */
export function classifyLiteratureType(text: string): LiteratureType {
  const textLower = text.toLowerCase();

  // 按优先级检查关键词
  // RCT最高优先级
  for (const keyword of LITERATURE_TYPE_KEYWORDS.rct) {
    if (textLower.includes(keyword.toLowerCase())) {
      return 'rct';
    }
  }

  // Meta分析
  for (const keyword of LITERATURE_TYPE_KEYWORDS.meta_analysis) {
    if (textLower.includes(keyword.toLowerCase())) {
      return 'meta_analysis';
    }
  }

  // 指南
  for (const keyword of LITERATURE_TYPE_KEYWORDS.guideline) {
    if (textLower.includes(keyword.toLowerCase())) {
      return 'guideline';
    }
  }

  // 观察研究
  for (const keyword of LITERATURE_TYPE_KEYWORDS.observational) {
    if (textLower.includes(keyword.toLowerCase())) {
      return 'observational';
    }
  }

  // 病例报告
  for (const keyword of LITERATURE_TYPE_KEYWORDS.case_report) {
    if (textLower.includes(keyword.toLowerCase())) {
      return 'case_report';
    }
  }

  // 默认专家意见
  return 'expert_opinion';
}

/**
 * GRADE等级映射
 *
 * @param literatureType - 文献类型
 * @returns GRADE等级
 */
export function mapEvidenceGrade(literatureType: LiteratureType): GradeLevel {
  switch (literatureType) {
    case 'rct':
    case 'meta_analysis':
      return 'A';
    case 'guideline':
      return 'B';
    case 'observational':
      return 'C';
    case 'case_report':
    case 'expert_opinion':
      return 'D';
    default:
      return 'D';
  }
}

/**
 * 检查时效性
 *
 * @param year - 文献年份
 * @param guidelineId - 指南ID（可选）
 * @returns 时效性检查结果
 */
export function checkTimeliness(
  year: number,
  guidelineId?: string,
): { isCurrent: boolean; expirationWarning?: string } {
  const currentYear = new Date().getFullYear();
  const yearsSincePublication = currentYear - year;

  // 如果有指南ID，使用指南时效性检查
  if (guidelineId) {
    const guideline = getGuidelineById(guidelineId);
    if (guideline) {
      return checkGuidelineTimeliness(guideline);
    }
  }

  // 默认时效性检查
  if (yearsSincePublication > DEFAULT_MEDICAL_CONFIG.guidelineExpirationYears) {
    return {
      isCurrent: false,
      expirationWarning: `该文献发布于${year}年，可能已过期，建议查阅最新版`,
    };
  }

  if (yearsSincePublication > 3) {
    return {
      isCurrent: true,
      expirationWarning: `该文献发布于${year}年，建议确认是否有更新版`,
    };
  }

  return { isCurrent: true };
}

/**
 * 评估证据
 *
 * @param source - 来源信息
 * @returns 证据评估结果
 */
export function evaluateEvidence(source: {
  documentName: string;
  year: number;
  content?: string;
}): EvidenceEvaluation {
  // 识别文献类型
  const textToAnalyze = source.content || source.documentName;
  const literatureType = classifyLiteratureType(textToAnalyze);

  // 映射GRADE等级
  const grade = mapEvidenceGrade(literatureType);

  // 检查时效性
  const timeliness = checkTimeliness(source.year);

  return {
    literatureType,
    grade,
    isCurrent: timeliness.isCurrent,
    year: source.year,
    expirationWarning: timeliness.expirationWarning,
  };
}

/**
 * 从来源名称提取指南ID
 *
 * @param documentName - 文档名称
 * @returns 指南ID（可选）
 */
function extractGuidelineId(documentName: string): string | undefined {
  const nameLower = documentName.toLowerCase();

  if (nameLower.includes('ada') || nameLower.includes('american diabetes')) {
    return 'guideline_ada';
  }
  if (nameLower.includes('cds') || nameLower.includes('中国糖尿病')) {
    return 'guideline_cds';
  }
  if (nameLower.includes('kdigo') || nameLower.includes('kidney disease')) {
    return 'guideline_kdigo';
  }
  if (nameLower.includes('esc') || nameLower.includes('european society')) {
    return 'guideline_esc';
  }
  if (nameLower.includes('ata') || nameLower.includes('american thyroid')) {
    return 'guideline_ata';
  }
  if (nameLower.includes('acc') || nameLower.includes('aha')) {
    return 'guideline_acc';
  }

  return undefined;
}

/**
 * 评估多个来源
 *
 * @param sources - 来源列表
 * @returns 证据评估列表
 */
export function evaluateMultipleSources(
  sources: SourceCitation[],
): EvidenceEvaluation[] {
  return sources.map(source => {
    const guidelineId = extractGuidelineId(source.documentName);
    const literatureType = classifyLiteratureType(source.documentName);

    return {
      literatureType,
      grade: mapEvidenceGrade(literatureType),
      isCurrent: checkTimeliness(source.year, guidelineId).isCurrent,
      year: source.year,
      sourceGuideline: guidelineId,
      expirationWarning: checkTimeliness(source.year, guidelineId).expirationWarning,
    };
  });
}

/**
 * 计算综合证据等级
 *
 * @param evaluations - 证据评估列表
 * @returns 综合GRADE等级
 */
export function calculateOverallGrade(evaluations: EvidenceEvaluation[]): GradeLevel {
  if (evaluations.length === 0) return 'D';

  // 取最高等级
  const grades = evaluations.map(e => e.grade);
  const gradeOrder: GradeLevel[] = ['A', 'B', 'C', 'D'];

  for (const grade of gradeOrder) {
    if (grades.includes(grade)) {
      return grade;
    }
  }

  return 'D';
}

/**
 * 获取GRADE描述
 *
 * @param grade - GRADE等级
 * @returns 描述文本
 */
export function getGradeDescription(grade: GradeLevel): string {
  return GRADE_DESCRIPTIONS[grade];
}

/**
 * 获取文献类型中文描述
 *
 * @param type - 文献类型
 * @returns 中文描述
 */
export function getLiteratureTypeLabel(type: LiteratureType): string {
  return LITERATURE_TYPE_LABELS[type] || type;
}