---
capability: safety-layer
version: 1.0
created: 2026-04-21
---

# Spec: Safety Layer

## 概述

Safety Layer 是 Medical Agent 的安全防护层，负责阈值提取、禁忌检查、证据评估集成和三层答案合成，确保医学回答的安全性和准确性。

## 功能需求

### FR-1: Threshold Extraction

系统能从用户查询中提取完整的临床阈值条件，包含指标、运算符、数值和单位。

```typescript
interface ThresholdCondition {
  indicator: string;      // 指标ID，如 "indicator_egfr"
  operator: string;       // 运算符："<", ">", "=", ">=", "<="
  value: number;         // 数值
  unit?: string;          // 单位，如 "mmol/L"
  isValidUnit?: boolean; // 单位是否有效
}
```

**场景覆盖：**

| 场景 | 输入 | 期望输出 |
|------|------|----------|
| 简单阈值 | "eGFR < 30 禁用二甲双胍" | ThresholdCondition = { indicator: "indicator_egfr", operator: "<", value: 30 } |
| 带单位阈值 | "血糖 > 7.8 mmol/L" | ThresholdCondition = { indicator: "indicator_glucose", operator: ">", value: 7.8, unit: "mmol/L", isValidUnit: true } |
| 多阈值提取 | "eGFR=45，HbA1c 8.5%" | 两个 ThresholdCondition |

### FR-2: Safety Pre-Check

在 Agent 循环开始前，系统执行禁忌阈值匹配和药物相互作用检测。

```typescript
interface SafetyAssessment {
  severity: 'absolute' | 'relative' | 'safe' | 'interaction';
  recommendation?: string;
  interactions?: DrugInteraction[];
}

interface DrugInteraction {
  drugs: string[];
  description: string;
  severity: 'major' | 'moderate' | 'minor';
}
```

**场景覆盖：**

| 场景 | 条件 | 期望输出 |
|------|------|----------|
| 绝对禁忌匹配 | 患者指标 eGFR=25，查询 "二甲双胍用法" | severity = "absolute"，recommendation = "禁用二甲双胍" |
| 相对禁忌匹配 | 患者指标 eGFR=40，查询 "二甲双胍用法" | severity = "relative"，recommendation = "慎用，需减量" |
| 无禁忌 | 患者指标 eGFR=60，查询 "二甲双胍用法" | severity = "safe" |
| 药物相互作用 | 查询包含 "二甲双胍 + 西咪替丁" | severity = "interaction"，interactions 包含相互作用详情 |

### FR-3: Evidence Evaluation Integration

OBSERVE 阶段调用 EvidenceEvaluator，输出证据质量评估。

```typescript
interface EvidenceEvaluation {
  sourceId: string;
  evidenceType: 'RCT' | 'guideline' | 'expert_opinion' | 'observational';
  grade: 'A' | 'B' | 'C' | 'D';
  isTimely: boolean;      // 5年内为 true
  reliability: number;    // 0-1 可靠性分数
}

interface EvidenceEvaluationResult {
  evaluations: EvidenceEvaluation[];
  overallGrade: 'A' | 'B' | 'C' | 'D';
}
```

**场景覆盖：**

| 场景 | 条件 | 期望输出 |
|------|------|----------|
| 多源证据评估 | 检索返回 3 条结果（RCT、指南、专家意见） | evidenceEvaluation 包含 3 个 EvidenceEvaluation，overallGrade = "A" |
| 指南时效性检查 | 检索结果包含 2020 年 ADA 指南 | EvidenceEvaluation.isTimely = true（5年内） |

### FR-4: Three-Layer Answer Synthesis

答案生成综合 SafetyAssessment、RetrievalResults、EvidenceEvaluation 三层信息。

```typescript
interface SynthesizedAnswer {
  conclusion: string;
  evidenceGrade: {
    grade: 'A' | 'B' | 'C' | 'D';
    sourceType: string;
  };
  safetyWarning?: string;
  details: string[];
}
```

**场景覆盖：**

| 场景 | 条件 | 期望输出 |
|------|------|----------|
| 禁忌优先 | SafetyAssessment.severity = "absolute" | conclusion 使用 SafetyAssessment.recommendation，不再引用检索的用药建议 |
| GRADE 从计算获得 | evidenceEvaluation 存在 | evidenceGrade.grade = calculateOverallGrade(evidenceEvaluation)，不从 LLM 输出提取 |
| 相对禁忌综合 | SafetyAssessment.severity = "relative" | conclusion = "慎用"，details 包含阈值说明 + 检索的调整建议 |

## 非功能需求

### NFR-1: 安全性优先

- 绝对禁忌场景必须阻止继续执行
- 相对禁忌场景必须明确警告用户

### NFR-2: 响应速度

- Safety Pre-Check 耗时 < 50ms
- 不影响整体检索流程性能

### NFR-3: 证据透明

- 所有结论必须附带证据等级
- 证据等级必须来自计算而非 LLM 猜测

## 输入输出规范

### 输入

```typescript
interface SafetyLayerInput {
  query: string;
  patientIndicators?: {
    [indicatorId: string]: number;
  };
  retrievedDrugs: string[];
}
```

### 输出

```typescript
interface SafetyLayerOutput {
  thresholdConditions: ThresholdCondition[];
  safetyAssessment: SafetyAssessment;
  evidenceEvaluation?: EvidenceEvaluationResult;
  synthesizedAnswer: SynthesizedAnswer;
}
```

## 禁止行为

| 禁止 | 原因 |
|------|------|
| 跳过 Safety Pre-Check | 安全风险 |
| 忽略绝对禁忌 | 可能导致严重医疗事故 |
| 伪造证据等级 | 误导用户 |

## 测试场景

| 场景 | 输入 | 验证点 |
|------|------|--------|
| eGFR 禁忌检测 | eGFR=25, 二甲双胍查询 | severity="absolute" |
| 多药物相互作用 | "二甲双胍 + 西咪替丁" | interactions 非空 |
| 证据等级计算 | 3个高质量来源 | overallGrade="A" |
| 答案综合 | 相对禁忌场景 | conclusion 包含慎用提示 |