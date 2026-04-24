---
capability: layer3-llm-evaluation
version: 1.0
created: 2026-04-24
---

# Spec: Layer 3 LLM Evaluation

## 概述

Layer 3 评估增强，使用 LLM 驱动替代规则驱动，真正验证 Evidence Traceability、Completeness、Terminology Accuracy。

## ADDED Requirements

### Requirement: Batch LLM Evaluation

系统 SHALL 使用单次 LLM 调用同时评估 Layer 3 三个指标。

#### Scenario: Batch prompt generates all three scores
- **WHEN** Layer3Evaluator.evaluate called with traceData
- **THEN** single LLM API call made with batch prompt
- **AND** response parsed to extract:
  - evidence.score (0.0-1.0)
  - completeness.score (0.0-1.0)
  - terminology.score (0.0-1.0)

#### Scenario: Batch prompt includes full context
- **WHEN** constructing batch prompt
- **THEN** prompt includes:
  - query.raw
  - answer.text (truncated to 2000 chars)
  - chunks summary (truncated to 1500 chars)
  - entities if available

### Requirement: Evidence Traceability LLM Evaluation

系统 SHALL 使用 LLM 验证每个声称的引用有效性。

#### Scenario: Claims need citation check
- **WHEN** LLM evaluates evidence traceability
- **THEN** for each claim in answer:
  - checks if claim needs citation (事实性 vs 解释性)
  - checks if citation provided
  - checks if citation source exists in chunks
  - checks if citation content matches claim

#### Scenario: Evidence score calculation
- **WHEN** all claims evaluated
- **THEN** score = valid_citations / claims_needing_citation
- **AND** citationAnalysis array populated with per-claim results

#### Scenario: Missing citations identified
- **WHEN** claims needing citation but no citation
- **THEN** missingCitations array populated
- **AND** sourceQuality assessed from chunks

### Requirement: Completeness LLM Evaluation

系统 SHALL 使用 LLM 判断是否回答了问题的所有方面。

#### Scenario: Sub-questions extraction
- **WHEN** LLM evaluates completeness
- **THEN** implicit sub-questions extracted from query
- **AND** subQuestions array populated

#### Scenario: Sub-question coverage check
- **WHEN** checking sub-question coverage
- **THEN** for each sub-question:
  - checks if covered by answer
  - assesses coverage depth (full/partial/missing)

#### Scenario: Completeness score calculation
- **WHEN** all sub-questions checked
- **THEN** score = covered_sub_questions / total_sub_questions
- **AND** covered array populated with coverage details

#### Scenario: Missing information identified
- **WHEN** important information missing from answer
- **THEN** missingInfo array populated
- **AND** used for feedback suggestions

### Requirement: Terminology Accuracy LLM Evaluation

系统 SHALL 使用 LLM 判断术语在上下文中是否正确使用。

#### Scenario: Medical terms extraction
- **WHEN** LLM evaluates terminology
- **THEN** all medical terms and abbreviations extracted from answer
- **AND** terms array populated

#### Scenario: Term usage validation
- **WHEN** validating each term
- **THEN** checks:
  - usage_correct in context
  - context_appropriate for medical scenario
  - abbreviation_explained if first use

#### Scenario: Terminology score calculation
- **WHEN** all terms validated
- **THEN** score = correct_terms / total_terms
- **AND** errors array populated with incorrect term details

### Requirement: Conditional Trigger

系统 SHALL 支持条件触发，只在需要时启用 LLM 评估。

#### Scenario: High faithfulness triggers evidence check
- **WHEN** faithfulness < 0.7 from Layer 1
- **THEN** Evidence Traceability LLM evaluation enabled
- **AND** other Layer 3 metrics may use rule-based fallback

#### Scenario: Multi-entity query triggers completeness check
- **WHEN** query has > 1 disease entities
- **THEN** Completeness LLM evaluation enabled

#### Scenario: Medical terms presence triggers terminology check
- **WHEN** answer contains medical terminology patterns
- **THEN** Terminology LLM evaluation enabled

#### Scenario: All conditions satisfied enables full batch
- **WHEN** multiple triggers satisfied
- **THEN** full batch LLM evaluation enabled

#### Scenario: No triggers use rule-based fallback
- **WHEN** no triggers satisfied
- **THEN** Layer 3 uses rule-based evaluation (current implementation)
- **AND** cost saved

### Requirement: JSON Response Parsing

系统 SHALL 正确解析 LLM 返回的 JSON。

#### Scenario: Successful JSON parse
- **WHEN** LLM returns valid JSON matching expected schema
- **THEN** all three scores extracted
- **AND** detailed analysis populated

#### Scenario: JSON parse failure fallback
- **WHEN** LLM returns invalid JSON or unexpected format
- **THEN** fallback to rule-based evaluation
- **AND** retryCount incremented
- **AND** evaluation metadata records fallback used

#### Scenario: Partial JSON parse
- **WHEN** JSON valid but some fields missing
- **THEN** available fields used
- **AND** missing fields use default values

### Requirement: Response Schema

系统 SHALL 验证 LLM 响应符合预期 schema。

#### Scenario: Validate response schema
- **WHEN** LLM response received
- **THEN** response validated against schema:
```typescript
interface Layer3Response {
  evidence: {
    score: number;
    citationAnalysis: Array<{
      claim: string;
      needsCitation: boolean;
      hasCitation: boolean;
      valid: boolean;
    }>;
    missingCitations: string[];
    sourceQuality: {
      hasGuideline: boolean;
      hasRecentSource: boolean;
      hasAuthoritativeSource: boolean;
    };
  };
  completeness: {
    score: number;
    subQuestions: string[];
    covered: Array<{
      question: string;
      covered: boolean;
      depth: 'full' | 'partial' | 'missing';
    }>;
    missingInfo: string[];
  };
  terminology: {
    score: number;
    terms: Array<{
      term: string;
      correct: boolean;
      contextAppropriate: boolean;
      abbreviationExplained: boolean | 'na';
    }>;
    errors: Array<{
      term: string;
      errorType: 'misuse' | 'confusion' | 'missing_explanation' | 'typo';
      correction?: string;
    }>;
    missingExplanations: string[];
  };
}
```

## 类型导入

本 spec 使用 `shared-types/spec.md` 中定义的类型：

```typescript
import {
  Layer3LLMResponse,
  Layer3SystemResult
} from './shared-types/spec.md';
```

## 数据模型

Layer3Response (LLM 输出) 使用 shared-types 中定义的 Layer3LLMResponse 接口。系统处理后的结果转换为 Layer3SystemResult，遵循 shared-types 中的命名约定：

- `citationAnalysis[].valid` → `citationAccuracy = valid_count / total`
- `covered[].covered=true` → `coveredSubQuestions.push(question)`
- `terms[].correct` → `correctUsageCount`, `errorCount`

```typescript
// Layer3Result 继承 Layer3SystemResult 的标准化命名
interface Layer3Result extends Layer3SystemResult {
  // Evidence traceability 结果
  evidence: {
    score: number;
    citationAccuracy: number;     // 从 citationAnalysis 计算
    missingCitations: string[];
    invalidCitations: string[];
    sourceQuality: {
      hasGuideline: boolean;
      hasRecentSource: boolean;
      hasAuthoritativeSource: boolean;
    };
  };
  // Completeness 结果
  completeness: {
    score: number;
    coveredSubQuestions: string[];  // 从 covered 提取
    missingSubQuestions: string[];
    entityCoverage: number;
    topicCoverage: number;
  };
  // Terminology 结果
  terminology: {
    score: number;
    terminologyErrors: string[];   // 从 errors 提取
    missingAbbreviationExplanations: string[];
    correctUsageCount: number;     // 从 terms 计算
    errorCount: number;
  };
}

interface TriggerAnalysis {
  faithfulnessTrigger: boolean;
  multiEntityTrigger: boolean;
  terminologyTrigger: boolean;
  needsLLM: boolean;
}
```

## 测试场景

| 场景 | 输入 | 验证点 |
|------|------|--------|
| Batch prompt | traceData | 单次 LLM 调用，返回三个分数 |
| Evidence evaluation | answer with claims | citationAnalysis populated |
| Completeness evaluation | multi-entity query | subQuestions extracted |
| Terminology evaluation | medical terms in answer | terms array populated |
| Conditional trigger | faithfulness=0.6 | Evidence LLM enabled |
| JSON parse failure | invalid JSON | fallback to rule-based |
| No triggers | simple query | rule-based used, cost saved |