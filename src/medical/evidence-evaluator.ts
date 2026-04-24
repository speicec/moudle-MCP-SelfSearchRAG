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
  SourceAuthorityLevel,
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
  year: number | undefined,
  guidelineId?: string,
): { isCurrent: boolean; expirationWarning?: string } {
  // 如果年份未知，默认认为当前有效
  if (year === undefined) {
    return { isCurrent: true };
  }

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

// ==================== Enhanced Evidence Evaluation ====================

/**
 * 指南权威性映射
 *
 * International: ADA, KDIGO, ESC, ATA, EASD (权重 1.0)
 * National: CDS, CSH, CETA, 中国指南 (权重 0.8)
 * Local: 其他 (权重 0.6)
 */
export const GUIDELINE_AUTHORITY_MAPPING: Record<SourceAuthorityLevel, {
  keywords: string[];
  weight: number;
}> = {
  international: {
    keywords: ['ADA', 'KDIGO', 'ESC', 'ATA', 'EASD', 'American Diabetes', 'Kidney Disease', 'European Society', 'American Thyroid'],
    weight: 1.0,
  },
  national: {
    keywords: ['CDS', 'CSH', 'CETA', '中国', '中华', '国家', 'National'],
    weight: 0.8,
  },
  local: {
    keywords: [],  // 默认级别
    weight: 0.6,
  },
};

/**
 * GRADE 权重映射
 */
export const GRADE_WEIGHTS: Record<GradeLevel, number> = {
  A: 1.0,
  B: 0.8,
  C: 0.6,
  D: 0.4,
};

/**
 * 增强证据评估权重常量
 */
export const ENHANCED_EVALUATION_WEIGHTS = {
  GRADE: 0.4,
  AUTHORITY: 0.2,
  TIME: 0.2,
  CONSISTENCY: 0.1,
  APPLICABILITY: 0.1,  // 默认 1.0（内分泌领域适用）
};

/**
 * 冲突关键词检测映射
 */
const CONFLICT_KEYWORDS = {
  positive: ['可用', '可以使用', '推荐', '适合', '适应', '安全'],
  negative: ['禁用', '不能用', '禁忌', '禁止', '不推荐', '慎用', '危险'],
};

/**
 * 评估来源权威性
 *
 * @param documentName - 文档名称
 * @returns 权威性级别和权重
 */
export function evaluateSourceAuthority(documentName: string): {
  level: SourceAuthorityLevel;
  weight: number;
} {
  const nameLower = documentName.toLowerCase();

  // 检查国际级别关键词
  for (const keyword of GUIDELINE_AUTHORITY_MAPPING.international.keywords) {
    if (nameLower.includes(keyword.toLowerCase())) {
      return { level: 'international', weight: 1.0 };
    }
  }

  // 检查国家级别关键词
  for (const keyword of GUIDELINE_AUTHORITY_MAPPING.national.keywords) {
    if (nameLower.includes(keyword.toLowerCase())) {
      return { level: 'national', weight: 0.8 };
    }
  }

  // 默认本地级别
  return { level: 'local', weight: 0.6 };
}

/**
 * 评估来源权威性（直接使用 guidelineSource）
 *
 * 如果有预先识别的 guidelineSource，直接使用它确定权威级别。
 * 这是设计文档中推荐的"上游提取"方式。
 *
 * @param guidelineSource - 预先识别的指南来源（如 "ADA", "KDIGO", "CDS"）
 * @returns 权威性级别和权重
 */
export function evaluateSourceAuthorityBySource(guidelineSource: string): {
  level: SourceAuthorityLevel;
  weight: number;
} {
  // Check if guidelineSource matches international keywords
  const internationalSources = ['ADA', 'KDIGO', 'ESC', 'ATA', 'EASD'];
  if (internationalSources.includes(guidelineSource)) {
    return { level: 'international', weight: 1.0 };
  }

  // Check if guidelineSource matches national keywords
  const nationalSources = ['CDS', 'CSH', 'CETA'];
  if (nationalSources.includes(guidelineSource)) {
    return { level: 'national', weight: 0.8 };
  }

  // Unknown or local source
  return { level: 'local', weight: 0.6 };
}

/**
 * 计算时效权重
 *
 * 线性衰减：每年衰减 0.05，最低 0.5
 *
 * @param year - 文献年份
 * @returns 时效权重
 */
export function calculateTimeWeight(year: number | undefined): number {
  if (year === undefined) {
    return 0.7;  // 无年份信息，默认中等权重
  }

  const currentYear = new Date().getFullYear();
  const yearsSincePublication = currentYear - year;

  // 线性衰减：2024 → 1.0, 2023 → 0.95, ...
  const weight = 1.0 - yearsSincePublication * 0.05;

  // 最低权重 0.5
  return Math.max(weight, 0.5);
}

/**
 * 检查证据一致性（关键词版本）
 *
 * @param evidences - 证据评估列表（含来源内容）
 * @returns 一致性分数 (0-1)
 */
export function checkConsistency(
  evidences: Array<{ documentName: string; content?: string }>
): number {
  if (evidences.length <= 1) {
    return 1.0;  // 单一来源默认一致
  }

  // 提取冲突关键词匹配
  const positiveMatches: number[] = [];
  const negativeMatches: number[] = [];

  for (const evidence of evidences) {
    const contentLower = (evidence.content ?? evidence.documentName).toLowerCase();

    const positiveCount = CONFLICT_KEYWORDS.positive.filter(k => contentLower.includes(k)).length;
    const negativeCount = CONFLICT_KEYWORDS.negative.filter(k => contentLower.includes(k)).length;

    positiveMatches.push(positiveCount);
    negativeMatches.push(negativeCount);
  }

  // 检查是否有冲突：部分来源正，部分来源负
  const hasPositive = positiveMatches.some(c => c > 0);
  const hasNegative = negativeMatches.some(c => c > 0);

  if (hasPositive && hasNegative) {
    // 存在冲突，一致性降低
    const conflictRatio = Math.min(
      positiveMatches.filter(c => c > 0).length,
      negativeMatches.filter(c => c > 0).length
    ) / evidences.length;
    return 1.0 - conflictRatio * 0.5;  // 冲突降低一致性
  }

  // 无冲突，高一致性
  return 0.9;
}

/**
 * 计算增强综合评分
 *
 * compositeScore = GRADE * 0.4 + Authority * 0.2 + Time * 0.2 + Consistency * 0.1 + Applicability * 0.1
 *
 * @param grade - GRADE 等级
 * @param authorityWeight - 权威性权重
 * @param timeWeight - 时效权重
 * @param consistencyScore - 一致性分数
 * @returns 综合评分
 */
export function calculateEnhancedCompositeScore(
  grade: GradeLevel,
  authorityWeight: number,
  timeWeight: number,
  consistencyScore: number,
  applicabilityScore: number = 1.0  // 默认内分泌领域适用
): number {
  const gradeWeight = GRADE_WEIGHTS[grade];
  const weights = ENHANCED_EVALUATION_WEIGHTS;

  const compositeScore =
    gradeWeight * weights.GRADE +
    authorityWeight * weights.AUTHORITY +
    timeWeight * weights.TIME +
    consistencyScore * weights.CONSISTENCY +
    applicabilityScore * weights.APPLICABILITY;

  return compositeScore;
}

/**
 * 按质量排序证据
 *
 * @param evidences - 证据评估列表
 * @returns 排序后的证据列表（高质量优先）
 */
export function sortEvidenceByQuality(evidences: EvidenceEvaluation[]): EvidenceEvaluation[] {
  return [...evidences].sort((a, b) => {
    const scoreA = a.compositeScore ?? GRADE_WEIGHTS[a.grade];
    const scoreB = b.compositeScore ?? GRADE_WEIGHTS[b.grade];
    return scoreB - scoreA;  // 降序
  });
}

/**
 * 增强版多来源评估
 *
 * @param sources - 来源列表（含内容和元数据）
 * @returns 增强证据评估列表
 */
export function evaluateMultipleSourcesEnhanced(
  sources: Array<{
    documentName: string;
    year?: number;
    content?: string;
    guidelineSource?: string;  // Pre-identified guideline source from chunk metadata
  }>
): EvidenceEvaluation[] {
  // 计算一致性分数
  const consistencyScore = checkConsistency(sources);

  return sources.map(source => {
    // 基础评估
    const literatureType = classifyLiteratureType(source.content ?? source.documentName);
    const grade = mapEvidenceGrade(literatureType);
    // Use pre-identified guidelineSource if available, otherwise extract from documentName
    const guidelineId = source.guidelineSource ?? extractGuidelineId(source.documentName);
    const timeliness = checkTimeliness(source.year, guidelineId);

    // 增强评估 - use guidelineId for authority evaluation if available, fallback to documentName
    const authority = guidelineId
      ? evaluateSourceAuthorityBySource(guidelineId)
      : evaluateSourceAuthority(source.documentName);
    const timeWeight = calculateTimeWeight(source.year);
    const compositeScore = calculateEnhancedCompositeScore(
      grade,
      authority.weight,
      timeWeight,
      consistencyScore
    );

    return {
      literatureType,
      grade,
      isCurrent: timeliness.isCurrent,
      year: source.year ?? undefined,
      sourceGuideline: guidelineId,
      expirationWarning: timeliness.expirationWarning,

      // 增强字段
      sourceAuthority: authority.level,
      authorityWeight: authority.weight,
      timeWeight,
      consistencyScore,
      compositeScore,
    };
  });
}