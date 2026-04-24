---
capability: feedback-analyzer
version: 1.0
created: 2026-04-24
---

# Spec: Feedback Analyzer

## 概述

反馈分析器分析评估结果，生成调整信号用于系统改进。

## ADDED Requirements

### Requirement: Evaluation Analysis

系统 SHALL 分析评估结果生成反馈信号。

#### Scenario: Analyze produces feedback signal
- **WHEN** analyze(result) called with ExtendedEvaluationResult
- **THEN** returns FeedbackSignal with:
  - traceId
  - adjustments: array of Adjustment
  - flags: array of Flag
  - suggestions: array of Suggestion

#### Scenario: Signal generation timing
- **WHEN** evaluation completed
- **THEN** FeedbackAnalyzer.analyze called
- **AND** signal generated within 10ms

### Requirement: Safety Feedback Generation

系统 SHALL 在 Safety Assessment 低时生成人工审核标记。

#### Scenario: Danger level triggers human review flag
- **WHEN** result.riskLevel === 'danger'
- **THEN** flag added: { type: 'HUMAN_REVIEW_REQUIRED', priority: 'critical' }
- **AND** suggestion added: { action: 'block_answer_publish', reason: 'Contains dangerous advice' }

#### Scenario: Warning level triggers attention
- **WHEN** result.riskLevel === 'warning'
- **THEN** flag added: { type: 'ATTENTION_REQUIRED', priority: 'high' }
- **AND** suggestion added: { action: 'add_warning_badge', reason: 'Safety concern detected' }

### Requirement: Faithfulness Feedback Generation

系统 SHALL 在 Faithfulness 低时生成检索调整信号。

#### Scenario: Low faithfulness triggers retrieval adjustment
- **WHEN** result.metrics.faithfulness.score < 0.5
- **THEN** adjustment added:
  - target: 'retrieval'
  - change: { topK: +5, verificationMode: true, rerankEnabled: true }
  - reason: 'Low faithfulness - potential hallucination'
  - expiresAt: 1 hour from now

#### Scenario: Moderate faithfulness triggers monitoring
- **WHEN** faithfulness between 0.5 and 0.7
- **THEN** adjustment added:
  - target: 'evaluation'
  - change: { enableLayer3LLM: true }
  - reason: 'Moderate faithfulness - enhanced evaluation needed'

### Requirement: Context Relevance Feedback Generation

系统 SHALL 在 Context Relevance 低时生成检索参数调整。

#### Scenario: Low context relevance adjustment
- **WHEN** result.metrics.contextRelevance.score < 0.5
- **THEN** adjustment added:
  - target: 'retrieval'
  - change: { threshold: -0.1, mode: 'hybrid_enhanced' }
  - reason: 'Low context relevance'

#### Scenario: Chunk scores analysis
- **WHEN** contextRelevance.chunkScores available
- **AND** some chunks score very low (< 0.3)
- **THEN** adjustment includes: { minChunkScore: 0.3 }

### Requirement: Medical Accuracy Feedback Generation

系统 SHALL 在 Medical Accuracy 低时生成术语检查建议。

#### Scenario: Terminology errors detected
- **WHEN** medicalAccuracy.terminologyErrors non-empty
- **THEN** suggestion added:
  - action: 'highlight_terminology_errors'
  - reason: terminologyErrors list

#### Scenario: Guideline violations detected
- **WHEN** medicalAccuracy.guidelineViolations non-empty
- **THEN** flag added: { type: 'GUIDELINE_VIOLATION', priority: 'high' }
- **AND** suggestion added: { action: 'suggest_review', reason: violations list }

### Requirement: Trend Analysis

系统 SHALL 分析近期评估趋势检测系统性问题。

#### Scenario: Degradation trend detection
- **WHEN** last 10 evaluations show decreasing overallScore trend
- **AND** degradationRate > 0.1 (10% drop)
- **THEN** flag added: { type: 'SYSTEM_DEGRADATION', priority: 'warning' }

#### Scenario: Sudden drop detection
- **WHEN** current overallScore 20% lower than recent average
- **THEN** flag added: { type: 'SUDDEN_DROP', priority: 'critical' }

#### Scenario: Recovery detection
- **WHEN** trend improving after degradation
- **THEN** previous degradation flag resolved
- **AND** SYSTEM_RECOVERY notification generated

### Requirement: Adjustment Scope

系统 SHALL 限制调整信号的作用域为会话级。

#### Scenario: Adjustment expires after 1 hour
- **WHEN** adjustment generated with expiresAt
- **THEN** adjustment only valid for 1 hour
- **AND** automatically removed after expiration

#### Scenario: Session-level scope
- **WHEN** adjustment generated
- **THEN** adjustment stored with sessionId key
- **AND** only affects queries within same session

#### Scenario: No global impact
- **WHEN** adjustment generated
- **THEN** adjustment NOT persisted to global config
- **AND** other sessions unaffected

### Requirement: Signal Storage

系统 SHALL 存储反馈信号供后续使用。

#### Scenario: Signal stored to session config
- **WHEN** signal with adjustments generated
- **THEN** adjustments stored in SessionConfigStore
- **AND** key: session:{sessionId}:adjustments

#### Scenario: Signal retrieval
- **WHEN** AgentExecutor starts new query in session
- **THEN** adjustments retrieved from SessionConfigStore
- **AND** applied to retrieval parameters

### Requirement: Signal Expiration

系统 SHALL 自动清理过期调整信号。

#### Scenario: Expired adjustment cleanup
- **WHEN** adjustment expiresAt elapsed
- **THEN** adjustment removed from SessionConfigStore
- **AND** default parameters restored

#### Scenario: Cleanup interval
- **WHEN** cleanup task runs (every 5 minutes)
- **THEN** all expired adjustments removed
- **AND** cleanup logged

## 类型导入

本 spec 使用 `shared-types/spec.md` 中定义的类型：

```typescript
import {
  FlagToAlertMapping,
  SeverityThresholds,
  SessionConfigStoreStrategy,
  AlertType
} from './shared-types/spec.md';
```

FlagType 与 AlertType 的映射关系定义在 shared-types 的 FlagToAlertMapping 中：

- `HUMAN_REVIEW_REQUIRED` → `SAFETY_CRITICAL` (critical severity, create_review_item action)
- `ATTENTION_REQUIRED` → 无对应 AlertType (warning severity, add_warning_badge action)
- `GUIDELINE_VIOLATION` → `MEDICAL_ACCURACY` (warning severity, suggest_review action)
- `SYSTEM_DEGRADATION` → `QUEUE_BACKLOG_TREND` (warning severity, notify_ops action)
- `SUDDEN_DROP` → `HIGH_FAILURE_RATE` (critical severity, immediate_investigation action)

SessionConfigStore 存储策略遵循 SessionConfigStoreStrategy：
- Redis 可用时：使用 Redis with TTL (1 hour)
- Redis 不可用时：使用 in-memory Map with setTimeout cleanup

## 数据模型

```typescript
interface FeedbackSignal {
  traceId: string;
  sessionId?: string;
  adjustments: Adjustment[];
  flags: Flag[];
  suggestions: Suggestion[];
  timestamp: string;
}

interface Adjustment {
  target: 'retrieval' | 'generation' | 'evaluation';
  change: Record<string, unknown>;
  reason: string;
  expiresAt: number;
}

interface Flag {
  type: FlagType;
  reason: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

type FlagType =
  | 'HUMAN_REVIEW_REQUIRED'
  | 'ATTENTION_REQUIRED'
  | 'GUIDELINE_VIOLATION'
  | 'SYSTEM_DEGRADATION'
  | 'SUDDEN_DROP';

interface Suggestion {
  action: string;
  reason: string;
}

interface TrendAnalysis {
  recentEvaluations: number;
  avgScore: number;
  degradationRate: number;
  trendDirection: 'improving' | 'stable' | 'degrading';
}
```

## 存储设计

SessionConfigStore (Redis or in-memory):
```
Key: session:{sessionId}:adjustments
Value: JSON array of Adjustment
TTL: 1 hour (auto-expiration)

Key: session:{sessionId}:config
Value: JSON of merged retrieval config
TTL: 1 hour
```

## 测试场景

| 场景 | 输入 | 验证点 |
|------|------|--------|
| Danger level | riskLevel='danger' | HUMAN_REVIEW_REQUIRED flag |
| Low faithfulness | faithfulness=0.4 | retrieval adjustment with topK+5 |
| Low context relevance | contextRelevance=0.4 | threshold adjustment |
| Degradation trend | 10 evaluations decreasing | SYSTEM_DEGRADATION flag |
| Session scope | adjustment generated | stored with sessionId key |
| Adjustment expiry | expiresAt elapsed | adjustment removed |