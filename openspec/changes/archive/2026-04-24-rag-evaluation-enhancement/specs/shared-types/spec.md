---
capability: shared-types
version: 1.0
created: 2026-04-24
---

# Spec: Shared Types

## 概述

跨多个 spec 共享的数据类型定义，避免重复定义和循环依赖。

## ADDED Requirements

### Requirement: AlertType Complete Enumeration

系统 SHALL 使用统一的告警类型枚举，覆盖所有模块的告警需求。

```typescript
type AlertType =
  // Evaluation alerts (from evaluation-alerts)
  | 'SAFETY_CRITICAL'
  | 'FAITHFULNESS_LOW'
  | 'MEDICAL_ACCURACY'
  | 'CONTEXT_IRRELEVANT'
  // Queue alerts (from queue-health-monitor)
  | 'QUEUE_BACKLOG'
  | 'QUEUE_BACKLOG_TREND'
  | 'HIGH_FAILURE_RATE'
  | 'FAILURE_SPIKE'
  | 'NO_ACTIVE_WORKERS'
  | 'LOW_WORKER_ACTIVITY'
  | 'HIGH_PROCESSING_TIME'
  | 'PROCESSING_TIME_TREND'
  // Review alerts (from human-review-queue)
  | 'REVIEW_SLA_BREACH'
  | 'REVIEW_CRITICAL_SLA'
  // System alerts (from evaluation-autoscaler, safety-layer)
  | 'SCALE_FAILURE'
  | 'DRUG_INTERACTION'
  | 'COST_THRESHOLD_EXCEEDED';
```

### Requirement: AlertSeverity Levels

系统 SHALL 使用统一的告警严重程度级别。

```typescript
type AlertSeverity = 'critical' | 'warning' | 'info';
```

### Requirement: AlertStatus States

系统 SHALL 使用统一的告警状态流转。

```typescript
type AlertStatus = 'active' | 'acknowledged' | 'resolved';
```

### Requirement: AlertEvent Base Structure

系统 SHALL 使用统一的告警事件基础结构。

```typescript
interface AlertEventBase {
  alertId: string;
  timestamp: string;
  type: AlertType;
  severity: AlertSeverity;
  traceId?: string;
  evaluationId?: string;
  status: AlertStatus;
  acknowledgedBy?: string;
  resolvedAt?: string;
}
```

### Requirement: AlertDetails Type-Specific Structure

系统 SHALL 为每种 AlertType 定义具体的 details 结构。

```typescript
interface AlertDetailsMap {
  // Evaluation alerts
  SAFETY_CRITICAL: {
    safetyScore: number;
    threshold: number;
    delta: number;
    contraindication?: string;
    dangerousAdvice?: string[];
  };
  FAITHFULNESS_LOW: {
    metric: 'faithfulness';
    value: number;
    threshold: number;
    delta: number;
    unsupportedCount?: number;
    hallucinationRisk?: boolean;
  };
  MEDICAL_ACCURACY: {
    metric: 'medicalAccuracy';
    value: number;
    terminologyErrors?: string[];
    guidelineViolations?: string[];
  };
  CONTEXT_IRRELEVANT: {
    metric: 'contextRelevance';
    value: number;
    threshold: number;
    avgChunkScore?: number;
    suggestedTopK?: number;
  };
  // Queue alerts
  QUEUE_BACKLOG: {
    waiting: number;
    threshold: number;
    active?: number;
  };
  QUEUE_BACKLOG_TREND: {
    waiting: number;
    growthRate: number;
    trendDirection: 'increasing' | 'stable' | 'decreasing';
  };
  HIGH_FAILURE_RATE: {
    failureRate: number;
    failed: number;
    completed: number;
    threshold: number;
  };
  FAILURE_SPIKE: {
    recentFailures: number;
    timeWindow: string;
    failureDetails?: string[];
  };
  NO_ACTIVE_WORKERS: {
    waiting: number;
    active: number;
    expectedReplicas?: number;
  };
  LOW_WORKER_ACTIVITY: {
    active: number;
    expected: number;
    delta: number;
  };
  HIGH_PROCESSING_TIME: {
    avgProcessingTime: number;
    threshold: number;
    unit: 'ms';
  };
  PROCESSING_TIME_TREND: {
    avgProcessingTime: number;
    trendDirection: 'increasing' | 'stable' | 'decreasing';
    rate: number;
  };
  // Review alerts
  REVIEW_SLA_BREACH: {
    reviewId: string;
    pendingDuration: number; // hours
    slaThreshold: number;
    priority: string;
  };
  REVIEW_CRITICAL_SLA: {
    reviewId: string;
    pendingDuration: number; // hours
    slaThreshold: number;
    urgency: 'critical';
  };
  // System alerts
  SCALE_FAILURE: {
    targetReplicas: number;
    error: string;
    dockerResponse?: string;
  };
  DRUG_INTERACTION: {
    drugs: string[];
    interactionType: string;
    severity: 'major' | 'moderate' | 'minor';
    description: string;
  };
  COST_THRESHOLD_EXCEEDED: {
    dailyCost: number;
    threshold: number;
    currency: 'USD';
    tokenCount?: number;
  };
}
```

### Requirement: SuggestedActions Mapping

系统 SHALL 为每种 AlertType 提供标准建议操作。

```typescript
interface SuggestedActionsMap {
  SAFETY_CRITICAL: ['阻止答案发布', '立即人工审核', '检查禁忌阈值'];
  FAITHFULNESS_LOW: ['触发二次检索', '标记需要验证', '检查幻觉'];
  MEDICAL_ACCURACY: ['标记术语错误', '建议修正'];
  CONTEXT_IRRELEVANT: ['建议增加 topK', '调整 threshold', '优化检索策略'];
  QUEUE_BACKLOG: ['增加 Worker replicas', '检查 LLM API 延迟'];
  QUEUE_BACKLOG_TREND: ['监控增长趋势', '提前扩容'];
  HIGH_FAILURE_RATE: ['检查 Redis 连接', '检查 LLM API 状态', '暂停新任务'];
  FAILURE_SPIKE: ['查看失败详情', '重启 Worker 服务'];
  NO_ACTIVE_WORKERS: ['检查 Worker 进程状态', '重启 Worker 服务'];
  LOW_WORKER_ACTIVITY: ['检查 Worker 健康', '调整 expectedReplicas'];
  HIGH_PROCESSING_TIME: ['检查 LLM API 延迟', '优化 Prompt 长度'];
  PROCESSING_TIME_TREND: ['监控趋势', '优化评估流程'];
  REVIEW_SLA_BREACH: ['分配审核人员', '升级优先级'];
  REVIEW_CRITICAL_SLA: ['立即分配审核', '通知 Ops 团队'];
  SCALE_FAILURE: ['检查 Docker 状态', '手动扩容'];
  DRUG_INTERACTION: ['标注相互作用', '建议替代方案'];
  COST_THRESHOLD_EXCEEDED: ['检查调用频率', '启用条件触发', '优化 Prompt'];
}
```

### Requirement: SeverityThresholds Configuration

系统 SHALL 定义统一的告警阈值配置。

```typescript
interface SeverityThresholds {
  // Safety thresholds
  safetyCriticalThreshold: 0.5;
  safetyWarningThreshold: 0.7;
  
  // Faithfulness thresholds
  faithfulnessWarningThreshold: 0.5;
  faithfulnessMonitorThreshold: 0.7;
  
  // Queue thresholds
  queueBacklogWarningThreshold: 50;
  queueBacklogCriticalThreshold: 100;
  failureRateWarningThreshold: 0.1;  // 10%
  failureRateCriticalThreshold: 0.3; // 30%
  
  // Processing time thresholds
  processingTimeWarningThreshold: 60000; // 60s
  
  // Review SLA thresholds
  reviewSlaWarningThreshold: 24;   // hours
  reviewCriticalSlaThreshold: 4;   // hours
  
  // Cost threshold
  costThresholdExceeded: 50; // USD per day
  
  // Rate limiting
  alertRateLimitPerMinute: 10;
  alertAggregationWindowMs: 300000; // 5 minutes
}
```

### Requirement: FlagToAlert Mapping

系统 SHALL 定义 FeedbackAnalyzer Flag 与 Alert 的映射关系。

```typescript
interface FlagToAlertMapping {
  HUMAN_REVIEW_REQUIRED: {
    alertType: 'SAFETY_CRITICAL';
    severity: 'critical';
    action: 'create_review_item';
  };
  ATTENTION_REQUIRED: {
    alertType: null; // No alert, only flag/warning badge
    severity: 'warning';
    action: 'add_warning_badge';
  };
  GUIDELINE_VIOLATION: {
    alertType: 'MEDICAL_ACCURACY';
    severity: 'warning';
    action: 'suggest_review';
  };
  SYSTEM_DEGRADATION: {
    alertType: 'QUEUE_BACKLOG_TREND';
    severity: 'warning';
    action: 'notify_ops';
  };
  SUDDEN_DROP: {
    alertType: 'HIGH_FAILURE_RATE';
    severity: 'critical';
    action: 'immediate_investigation';
  };
}
```

### Requirement: ReviewStatus Flow

系统 SHALL 定义清晰的审核状态流转。

```typescript
type ReviewStatus = 'pending' | 'assigned' | 'reviewed' | 'resolved';

// State flow:
// pending → assigned → reviewed → resolved (via approve/reject)
// pending → SLA_BREACH → priority upgrade (status remains pending)
// assigned → reviewed (after review notes added)
// reviewed → resolved (via approve or reject action)

interface ReviewStatusFlow {
  transitions: [
    { from: 'pending', to: 'assigned', trigger: 'assign' },
    { from: 'assigned', to: 'reviewed', trigger: 'add_notes' },
    { from: 'reviewed', to: 'resolved', trigger: 'approve_or_reject' },
    { from: 'pending', to: 'pending', trigger: 'sla_breach', effect: 'priority_upgrade' },
  ];
}
```

### Requirement: SessionConfigStore Strategy

系统 SHALL 定义 SessionConfigStore 存储选择策略。

```typescript
interface SessionConfigStoreStrategy {
  // Primary: Redis (when available)
  redis: {
    keyPrefix: 'session:';
    ttl: 3600000; // 1 hour
    enabled: process.env.REDIS_HOST !== undefined;
  };
  
  // Fallback: In-memory Map (when Redis unavailable)
  inMemory: {
    enabled: process.env.REDIS_HOST === undefined;
    cleanupInterval: 300000; // 5 minutes
    maxEntries: 1000;
  };
  
  // Selection logic:
  // if Redis available → use Redis with TTL
  // if Redis unavailable → use in-memory Map with setTimeout cleanup
}
```

### Requirement: Layer3 Naming Convention

系统 SHALL 统一 Layer3 LLM Response 和 System Result 的命名。

```typescript
// LLM Response naming (from LLM)
interface Layer3LLMResponse {
  evidence: {
    citationAnalysis: Array<{ claim, needsCitation, hasCitation, valid }>;
    // ...
  };
  completeness: {
    covered: Array<{ question, covered, depth }>;
    // ...
  };
}

// System Result naming (standardized output)
interface Layer3SystemResult {
  evidence: {
    citationAccuracy: number; // derived from citationAnalysis
    // ...
  };
  completeness: {
    coveredSubQuestions: string[]; // derived from covered
    // ...
  };
}

// Mapping: Response → Result
// citationAnalysis[].valid → citationAccuracy = valid_count / total
// covered[].covered=true → coveredSubQuestions.push(question)
```

## 类型导入指引

各 spec 应从 shared-types 导入以下类型：

```typescript
// evaluation-alerts/spec.md
import { AlertType, AlertSeverity, AlertStatus, AlertEventBase, AlertDetailsMap } from './shared-types/spec.md';

// queue-health-monitor/spec.md
import { AlertType, AlertEventBase } from './shared-types/spec.md';

// human-review-queue/spec.md
import { ReviewStatus, ReviewStatusFlow } from './shared-types/spec.md';

// feedback-analyzer/spec.md
import { FlagToAlertMapping, SeverityThresholds } from './shared-types/spec.md';

// layer3-llm-evaluation/spec.md
import { Layer3LLMResponse, Layer3SystemResult } from './shared-types/spec.md';
```

## 测试场景

| 场景 | 输入 | 验证点 |
|------|------|--------|
| AlertType complete | 所有spec引用 | 无遗漏类型 |
| AlertDetails valid | type=SAFETY_CRITICAL | details 匹配 AlertDetailsMap |
| Flag mapping | HUMAN_REVIEW_REQUIRED | mapped to SAFETY_CRITICAL |
| Review flow | pending→assigned→resolved | transitions valid |