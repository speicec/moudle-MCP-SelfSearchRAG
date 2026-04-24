---
capability: medical-rag-evaluation
version: 2.0
created: 2026-04-23
---

# Spec: Medical RAG Evaluation Pipeline (扩展版)

## 概述

医疗领域扩展的 RAGAS 评估流水线，新增医疗特有的评估维度，支持异步执行不阻塞主进程。

## 评估维度总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    评估维度分层                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Layer 1: 基础 RAGAS 指标 (通用)                                             │
│  ────────────────────────────────────────────────────────────────────────  │
│  • Faithfulness        权重: 0.15   答案忠实于检索内容                        │
│  • Context Relevance   权重: 0.10   检索内容与问题相关                        │
│  • Answer Relevance    权重: 0.10   答案回答了问题                            │
│                                                                             │
│  Layer 2: 医疗核心指标 (关键)                                                 │
│  ────────────────────────────────────────────────────────────────────────  │
│  • Medical Accuracy    权重: 0.25   是否符合医学知识/指南                     │
│  • Safety Assessment   权重: 0.20   是否可能造成误导/危险建议                 │
│                                                                             │
│  Layer 3: 医疗增强指标 (补充)                                                 │
│  ────────────────────────────────────────────────────────────────────────  │
│  • Evidence Traceability 权重: 0.10  能追溯到原始文献/指南                    │
│  • Completeness         权重: 0.05  覆盖问题的所有方面                        │
│  • Terminology Accuracy 权重: 0.05  医学术语使用正确                          │
│                                                                             │
│  总权重: 1.0                                                                │
│  医疗核心指标权重: 0.45 (超过 50%)                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 2: 医疗核心指标

### Requirement: Medical Accuracy 评估
系统 SHALL 评估答案的医学准确性。

#### Scenario: 医学知识一致性
- **WHEN** 评估 Medical Accuracy
- **THEN** 检查答案是否与医学知识库一致
- **AND** 使用医学词典验证

#### Scenario: 指南符合度
- **WHEN** 答案涉及指南推荐
- **THEN** 检查是否与 ADA/KDIGO/ESC/ATA 指南一致
- **AND** 识别指南来源

#### Scenario: 错误检测
- **WHEN** 答案包含医学错误
- **THEN** 标记具体错误内容
- **AND** 降低 Medical Accuracy 分数

#### Scenario: 分数计算
- **WHEN** 完成医学准确性检查
- **THEN** score = 正确声称数 / 总声称数
- **AND** 需要医学词典支持

### Requirement: Safety Assessment 评估
系统 SHALL 评估答案的安全性。

#### Scenario: 复用 Safety Layer
- **WHEN** 评估 Safety Assessment
- **THEN** 使用现有 safety-layer 的 performSafetyCheck
- **AND** 检查禁忌和相互作用

#### Scenario: 禁忌检测
- **WHEN** 答案涉及药物禁忌
- **THEN** 检查是否正确标注禁忌条件
- **AND** severity 包含 absolute/relative

#### Scenario: 相互作用检测
- **WHEN** 答案涉及多药联用
- **THEN** 检查是否提及药物相互作用
- **AND** 提供相互作用风险等级

#### Scenario: 危险建议检测
- **WHEN** 答案可能导致危险行为
- **THEN** 标记为 unsafe
- **AND** 生成警告文本

#### Scenario: 分数计算
- **WHEN** 完成安全评估
- **THEN** score 根据 severity 计算
  - safe: 1.0
  - interaction: 0.8
  - relative: 0.5
  - absolute: 0.0

---

## Layer 3: 医疗增强指标

### Requirement: Evidence Traceability 评估
系统 SHALL 评估答案的证据溯源能力。

#### Scenario: 来源标注
- **WHEN** 评估 Evidence Traceability
- **THEN** 检查答案是否标注来源
- **AND** 来源格式应为 [指南名 年份]

#### Scenario: 引用验证
- **WHEN** 答案有引用
- **THEN** 验证引用是否存在于检索内容中
- **AND** chunkId 关联正确

#### Scenario: 无来源检测
- **WHEN** 答案没有标注来源
- **THEN** 降低分数
- **AND** 标记为 "缺乏证据溯源"

### Requirement: Completeness 评估
系统 SHALL 评估答案的完整性。

#### Scenario: 问题分解
- **WHEN** 评估 Completeness
- **THEN** 将用户问题分解为子问题
- **AND** 每个子问题检查是否有回答

#### Scenario: 覆盖率计算
- **WHEN** 完成子问题检查
- **THEN** score = 已回答子问题数 / 总子问题数
- **AND** 识别缺失的方面

#### Scenario: 实体覆盖
- **WHEN** 问题涉及多种实体
- **THEN** 检查答案是否覆盖所有实体
- **AND** diseases/drugs/indicators 都有涉及

### Requirement: Terminology Accuracy 评估
系统 SHALL 评估医学术语准确性。

#### Scenario: 术语匹配
- **WHEN** 评估 Terminology Accuracy
- **THEN** 检查答案中的医学术语
- **AND** 与医学词典匹配

#### Scenario: 缩写解释
- **WHEN** 答案使用缩写
- **THEN** 检查是否有解释
- **AND** 如无解释，降低分数

#### Scenario: 术语错误检测
- **WHEN** 术语使用错误
- **THEN** 标记具体错误
- **AND** 建议正确术语

---

## 评估维度权重配置

```typescript
interface EvaluationWeights {
  // Layer 1: 基础 RAGAS (通用)
  faithfulness: number;          // 默认: 0.15
  contextRelevance: number;      // 默认: 0.10
  answerRelevance: number;       // 默认: 0.10
  
  // Layer 2: 医疗核心 (关键)
  medicalAccuracy: number;       // 默认: 0.25
  safetyAssessment: number;      // 默认: 0.20
  
  // Layer 3: 医疗增强 (补充)
  evidenceTraceability: number;  // 默认: 0.10
  completeness: number;          // 默认: 0.05
  terminologyAccuracy: number;   // 默认: 0.05
  
  // 验证: 权重总和 = 1.0
}

const DEFAULT_MEDICAL_WEIGHTS: EvaluationWeights = {
  faithfulness: 0.15,
  contextRelevance: 0.10,
  answerRelevance: 0.10,
  medicalAccuracy: 0.25,
  safetyAssessment: 0.20,
  evidenceTraceability: 0.10,
  completeness: 0.05,
  terminologyAccuracy: 0.05,
};

// 不同场景的权重预设
const WEIGHT_PRESETS = {
  // 严格模式: 安全最重要
  strict: {
    safetyAssessment: 0.35,
    medicalAccuracy: 0.30,
    faithfulness: 0.15,
    contextRelevance: 0.05,
    answerRelevance: 0.05,
    evidenceTraceability: 0.05,
    completeness: 0.03,
    terminologyAccuracy: 0.02,
  },
  
  // 平衡模式: 默认权重
  balanced: DEFAULT_MEDICAL_WEIGHTS,
  
  // 宽松模式: 通用指标权重提高
  relaxed: {
    faithfulness: 0.25,
    contextRelevance: 0.20,
    answerRelevance: 0.20,
    medicalAccuracy: 0.15,
    safetyAssessment: 0.10,
    evidenceTraceability: 0.05,
    completeness: 0.03,
    terminologyAccuracy: 0.02,
  },
};
```

---

## 扩展的数据模型

```typescript
interface ExtendedEvaluationResult extends EvaluationResult {
  evaluationId: string;
  traceId: string;
  timestamp: string;
  
  metrics: {
    // Layer 1: 基础
    faithfulness: FaithfulnessResult;
    contextRelevance: ContextRelevanceResult;
    answerRelevance: AnswerRelevanceResult;
    
    // Layer 2: 医疗核心
    medicalAccuracy: MedicalAccuracyResult;
    safetyAssessment: SafetyAssessmentResult;
    
    // Layer 3: 医疗增强
    evidenceTraceability: EvidenceTraceabilityResult;
    completeness: CompletenessResult;
    terminologyAccuracy: TerminologyAccuracyResult;
  };
  
  overallScore: number;
  
  // 新增: 基于权重计算的分层分数
  layerScores: {
    layer1_basic: number;        // 基础 RAGAS 分数
    layer2_medicalCore: number;  // 医疗核心分数
    layer3_medicalEnhanced: number; // 医疗增强分数
  };
  
  // 新增: 风险等级
  riskLevel: 'safe' | 'caution' | 'warning' | 'danger';
  
  metadata: {
    weights: EvaluationWeights;
    preset: string;
    evaluatorModel: string;
    evaluationDurationMs: number;
    retryCount: number;
  };
}

interface MedicalAccuracyResult {
  score: number;
  correctClaims: string[];
  incorrectClaims: IncorrectClaim[];
  guidelineMatches: GuidelineMatch[];
}

interface IncorrectClaim {
  claim: string;
  errorType: 'contradiction' | 'outdated' | 'misinterpretation';
  correction: string;
  source?: string;
}

interface GuidelineMatch {
  guideline: string;      // ADA, KDIGO, ESC, ATA
  year: number;
  matchedSection: string;
  consistency: 'consistent' | 'partial' | 'contradictory';
}

interface SafetyAssessmentResult {
  score: number;
  severity: 'safe' | 'interaction' | 'relative' | 'absolute';
  contraindicationMatches: ContraindicationMatch[];
  interactions: DrugInteractionRelation[];
  warnings: string[];
  recommendation: string;
}

interface EvidenceTraceabilityResult {
  score: number;
  citedSources: CitedSource[];
  uncitedClaims: string[];
  citationAccuracy: number;
}

interface CitedSource {
  source: string;
  chunkId: string;
  correctlyCited: boolean;
}

interface CompletenessResult {
  score: number;
  subQuestions: SubQuestionCoverage[];
  entityCoverage: EntityCoverage;
  missingAspects: string[];
}

interface SubQuestionCoverage {
  question: string;
  answered: boolean;
  answerPreview?: string;
}

interface TerminologyAccuracyResult {
  score: number;
  correctTerms: string[];
  incorrectTerms: IncorrectTerm[];
  unexplainedAbbreviations: string[];
}

interface IncorrectTerm {
  term: string;
  error: string;
  correction: string;
}
```

---

## 风险等级计算

```typescript
function calculateRiskLevel(result: ExtendedEvaluationResult): RiskLevel {
  // 安全性直接决定风险等级
  const safetySeverity = result.metrics.safetyAssessment.severity;
  
  if (safetySeverity === 'absolute') {
    return 'danger';
  }
  
  if (safetySeverity === 'relative') {
    return 'warning';
  }
  
  // 医学准确性低于阈值
  if (result.metrics.medicalAccuracy.score < 0.6) {
    return 'warning';
  }
  
  // 综合分数低于阈值
  if (result.overallScore < 0.5) {
    return 'caution';
  }
  
  // 基础指标低于阈值但不影响医疗核心
  if (result.layerScores.layer1_basic < 0.5 && result.layerScores.layer2_medicalCore >= 0.7) {
    return 'caution';
  }
  
  return 'safe';
}
```

---

## API

```typescript
class MedicalEvaluationPipeline {
  constructor(
    llmCaller: LLMCaller,
    medicalDictionaries: MedicalDictionaries,
    safetyLayer: SafetyLayer,
    weights?: EvaluationWeights
  );
  
  // 设置权重预设
  setWeightPreset(preset: 'strict' | 'balanced' | 'relaxed'): void;
  setCustomWeights(weights: EvaluationWeights): void;
  
  // 主评估方法
  evaluate(trace: TraceContextData): Promise<ExtendedEvaluationResult>;
  
  // Layer 1: 基础评估
  evaluateFaithfulness(answer: string, contexts: string[]): Promise<FaithfulnessResult>;
  evaluateContextRelevance(query: string, contexts: string[]): Promise<ContextRelevanceResult>;
  evaluateAnswerRelevance(query: string, answer: string): Promise<AnswerRelevanceResult>;
  
  // Layer 2: 医疗核心评估
  evaluateMedicalAccuracy(answer: string, entities: MedicalEntities, contexts: string[]): Promise<MedicalAccuracyResult>;
  evaluateSafetyAssessment(entities: MedicalEntities, thresholds: ExtractedThreshold[]): Promise<SafetyAssessmentResult>;
  
  // Layer 3: 医疗增强评估
  evaluateEvidenceTraceability(answer: string, chunks: RetrievedChunk[]): Promise<EvidenceTraceabilityResult>;
  evaluateCompleteness(query: string, answer: string, entities: MedicalEntities): Promise<CompletenessResult>;
  evaluateTerminologyAccuracy(answer: string, entities: MedicalEntities): Promise<TerminologyAccuracyResult>;
  
  // 综合计算
  calculateOverallScore(metrics: AllMetrics): number;
  calculateLayerScores(metrics: AllMetrics): LayerScores;
  determineRiskLevel(result: ExtendedEvaluationResult): RiskLevel;
}
```

---

## Testing Criteria

- Medical Accuracy 指南符合度测试
- Medical Accuracy 错误检测测试
- Safety Assessment 禁忌检测测试
- Safety Assessment 相互作用检测测试
- Safety Assessment 危险建议检测测试
- Evidence Traceability 来源标注测试
- Evidence Traceability 引用验证测试
- Completeness 问题分解测试
- Completeness 实体覆盖测试
- Terminology Accuracy 术语匹配测试
- Terminology Accuracy 缩写解释测试
- 权重配置验证测试
- 分层分数计算测试
- 风险等级计算测试
- 不同 preset 下的评估测试