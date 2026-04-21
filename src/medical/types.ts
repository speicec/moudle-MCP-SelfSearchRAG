/**
 * Medical Agent Types for Endocrinology Domain
 */

// ==================== Entity Types ====================

/**
 * 疾病实体
 */
export interface DiseaseEntity {
  id: string;                    // "disease_diabetes_type2"
  canonicalName: string;         // "2型糖尿病"
  aliases: string[];             // ["糖尿病", "T2DM", "NIDDM"]
  icdCode?: string;              // "E11.9"
  category: string;              // "内分泌代谢"
  keywords: string[];            // 检索关键词
}

/**
 * 药物分类
 */
export interface DrugClassification {
  category: string;              // "降糖药"
  subcategory: string;           // "胰岛素增敏剂"
}

/**
 * 药物实体
 */
export interface DrugEntity {
  id: string;                    // "drug_metformin"
  canonicalName: string;         // "二甲双胍"
  aliases: string[];             // ["Metformin", "格华止", "美迪康"]
  englishName?: string;          // "Metformin"
  atcCode?: string;              // "A10BA02"
  classification: DrugClassification;
  brands: string[];              // ["格华止", "美迪康"]
  keywords: string[];            // 检索关键词
  relatedIndicators?: string[];  // 相关指标ID
  relatedDiseases?: string[];    // 相关疾病ID
}

/**
 * 临床阈值
 */
export interface ClinicalThresholds {
  normal: number[];              // 正常阈值
  caution: number[];             // 慎用阈值
  critical: number[];            // 禁用阈值
}

/**
 * 正常范围
 */
export interface NormalRange {
  min?: number;
  max?: number;
  description: string;
}

/**
 * 指标实体
 */
export interface IndicatorEntity {
  id: string;                    // "indicator_egfr"
  canonicalName: string;         // "肾小球滤过率"
  aliases: string[];             // ["eGFR", "GFR", "肾滤过率"]
  unit: string;                  // "mL/min/1.73m²"
  normalRange: NormalRange;
  clinicalThresholds: ClinicalThresholds;
  relatedDrugs?: string[];       // 相关药物ID
  relatedDiseases?: string[];    // 相关疾病ID
}

/**
 * 阈值条件
 */
export interface ThresholdCondition {
  indicator: string;             // "indicator_egfr"
  operator: '<' | '>' | '=' | '<=' | '>=';
  value: number;
}

/**
 * 禁忌/慎用关系
 */
export interface ContraindicationRelation {
  id: string;                    // "contra_metformin_egfr_30"
  drug: string;                  // "drug_metformin"
  condition: string;             // 指标或疾病ID
  threshold?: ThresholdCondition;
  severity: 'absolute' | 'relative';  // 绝对禁忌/相对禁忌(慎用)
  source: string;                // "ada"
  year: number;                  // 2024
  description: string;
}

/**
 * 药物相互作用
 */
export interface DrugInteractionRelation {
  id: string;
  drug1: string;
  drug2: string;
  type: 'major' | 'moderate' | 'minor';
  description: string;
  recommendation: string;
  source: string;
  year: number;
}

/**
 * 指南来源
 */
export interface GuidelineSource {
  id: string;                    // "guideline_ada"
  name: string;                  // "ADA Standards of Care"
  fullName: string;              // "American Diabetes Association Standards of Medical Care in Diabetes"
  shortName: string;             // "ADA"
  organization: string;          // "American Diabetes Association"
  country: string;               // "US"
  domain: string[];              // ["diabetes"]
  latestVersion: number;         // 2024
  updateCycle: string;           // "每年更新"
}

// ==================== Match Types (识别结果) ====================

/**
 * 疾病匹配结果
 */
export interface DiseaseMatch {
  id: string;
  canonicalName: string;
  matchedTerm: string;           // 匹配到的原文
  aliases: string[];             // 可扩展别名
}

/**
 * 药物匹配结果
 */
export interface DrugMatch {
  id: string;
  canonicalName: string;
  matchedTerm: string;
  aliases: string[];
  classification: DrugClassification;
}

/**
 * 指标匹配结果
 */
export interface IndicatorMatch {
  id: string;
  canonicalName: string;
  matchedTerm: string;
  unit?: string;
  value?: number;                // 如果查询包含数值
}

/**
 * 关系匹配结果
 */
export interface RelationMatch {
  type: 'contraindication' | 'precaution' | 'interaction' | 'indication';
  matchedTerm: string;
}

/**
 * 医学实体识别结果
 */
export interface MedicalEntities {
  diseases: DiseaseMatch[];
  drugs: DrugMatch[];
  indicators: IndicatorMatch[];
  relations: RelationMatch[];
  rawQuery: string;
  confidence: number;            // 整体置信度 0-1
}

// ==================== Query Types ====================

/**
 * 查询策略
 */
export interface QueryStrategy {
  primaryQuery: string;          // 主查询语句
  expandedTerms: string[];       // 扩展术语
  filters: {
    yearRange?: [number, number];
    guidelineSources?: string[];
  };
  prioritySources: string[];     // 优先来源
}

// ==================== Evidence Types ====================

/**
 * 文献类型
 */
export type LiteratureType = 'rct' | 'meta_analysis' | 'guideline' | 'observational' | 'case_report' | 'expert_opinion';

/**
 * GRADE等级
 */
export type GradeLevel = 'A' | 'B' | 'C' | 'D';

/**
 * 证据评估结果
 */
export interface EvidenceEvaluation {
  literatureType: LiteratureType;
  grade: GradeLevel;
  isCurrent: boolean;
  year: number;
  sourceGuideline?: string;
  expirationWarning?: string;
}

// ==================== Answer Types ====================

/**
 * 置信度级别
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * 来源引用
 */
export interface SourceCitation {
  documentName: string;          // "ADA Standards of Care 2024"
  year: number;                  // 2024
  section?: string;              // "Section 9"
  pageNumber?: number;           // 123
}

/**
 * 详细说明点
 */
export interface DetailPoint {
  text: string;
  sources: SourceCitation[];
}

/**
 * 结论部分
 */
export interface Conclusion {
  text: string;
  confidence: ConfidenceLevel;
}

/**
 * 证据等级部分
 */
export interface EvidenceGrade {
  grade: GradeLevel;
  sourceType: string;
}

/**
 * 医学回答
 */
export interface MedicalAnswer {
  conclusion: Conclusion;
  details: {
    points: DetailPoint[];
  };
  evidenceGrade: EvidenceGrade;
  sources: SourceCitation[];
  warnings: string[];
}

// ==================== MCP Tool Types ====================

/**
 * 医学查询输入
 */
export interface MedicalQueryInput {
  query: string;                 // 医学查询问题
  domain?: 'diabetes' | 'hypertension' | 'thyroid' | 'all';
  include_guidelines?: boolean;  // 是否优先检索指南
  year_range?: [number, number]; // 年份范围
}

/**
 * 医学查询输出
 */
export interface MedicalQueryOutput {
  entities: MedicalEntities;
  strategy: QueryStrategy;
  answer: MedicalAnswer;
  retrievalResults?: unknown[];
}