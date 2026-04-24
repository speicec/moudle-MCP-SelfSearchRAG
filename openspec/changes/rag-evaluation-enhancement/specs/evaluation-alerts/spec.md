---
capability: evaluation-alerts
version: 1.0
created: 2026-04-24
---

# Spec: Evaluation Alerts

## 概述

告警机制负责检测评估结果中的异常情况，实时通知相关人员，并记录告警历史。

## ADDED Requirements

### Requirement: Safety Critical Alert

系统 SHALL 在 Safety Assessment 低于危险阈值时立即触发告警。

#### Scenario: Safety below 0.5 triggers critical alert
- **WHEN** evaluation result has safetyAssessment < 0.5
- **THEN** system creates SAFETY_CRITICAL alert with severity = 'critical'
- **AND** alert includes traceId, evaluationId, suggestedActions
- **AND** WebSocket broadcasts alert immediately
- **AND** alert stored in SQLite alerts table

#### Scenario: Dangerous advice detected
- **WHEN** evaluation result has dangerousAdvice array non-empty
- **THEN** system creates SAFETY_CRITICAL alert
- **AND** suggestedActions includes '阻止答案发布', '立即人工审核'

### Requirement: Faithfulness Low Alert

系统 SHALL 在 Faithfulness 低于阈值时触发警告告警。

#### Scenario: Faithfulness below 0.5 triggers warning
- **WHEN** evaluation result has faithfulness < 0.5
- **THEN** system creates FAITHFULNESS_LOW alert with severity = 'warning'
- **AND** suggestedActions includes '触发二次检索', '标记需要验证'

#### Scenario: Hallucination verdicts detected
- **WHEN** faithfulness verdicts contain multiple 'unsupported' claims
- **THEN** system marks alert with hallucination risk flag
- **AND** alert details include unsupported claims count

### Requirement: Medical Accuracy Alert

系统 SHALL 在 Medical Accuracy 低于阈值时触发信息告警。

#### Scenario: Terminology errors detected
- **WHEN** medicalAccuracy.terminologyErrors array non-empty
- **THEN** system creates MEDICAL_ACCURACY alert with severity = 'info'
- **AND** alert details include terminologyErrors list

### Requirement: Context Irrelevance Alert

系统 SHALL 在 Context Relevance 低于阈值时触发调整建议。

#### Scenario: Low context relevance suggests parameter adjustment
- **WHEN** contextRelevance < 0.4
- **THEN** system creates CONTEXT_IRRELEVANT alert
- **AND** suggestedActions includes '建议增加 topK', '调整 threshold'

### Requirement: Alert Storage

系统 SHALL 持久化所有告警事件到 SQLite。

#### Scenario: Alert persisted to database
- **WHEN** alert created
- **THEN** alert stored in alerts table
- **AND** status field initialized as 'active'
- **AND** timestamp recorded

#### Scenario: Alert status management
- **WHEN** alert acknowledged by user
- **THEN** status updated to 'acknowledged'
- **AND** acknowledged_by field set

#### Scenario: Alert resolved
- **WHEN** underlying issue fixed
- **THEN** status updated to 'resolved'
- **AND** resolved_at timestamp recorded

### Requirement: WebSocket Broadcast

系统 SHALL 实时推送告警到连接的客户端。

#### Scenario: Critical alert broadcast immediately
- **WHEN** critical severity alert created
- **THEN** WebSocket broadcasts 'alert:new' event within 1 second
- **AND** event includes full alert details

#### Scenario: Alert aggregation for high frequency
- **WHEN** more than 10 alerts within 5 minutes of same type
- **THEN** system aggregates alerts into single broadcast
- **AND** broadcast includes count of aggregated alerts

### Requirement: Alert Query API

系统 SHALL 提供 REST API 查询告警。

#### Scenario: Get active alerts
- **WHEN** GET /api/alerts?status=active called
- **THEN** returns list of active alerts sorted by timestamp desc
- **AND** includes pagination support

#### Scenario: Get alert details
- **WHEN** GET /api/alerts/:id called
- **THEN** returns full alert details
- **AND** includes suggestedActions

#### Scenario: Acknowledge alert
- **WHEN** POST /api/alerts/:id/acknowledge called with userId
- **THEN** alert status updated to 'acknowledged'
- **AND** acknowledged_by set to userId

## 类型导入

本 spec 使用 `shared-types/spec.md` 中定义的类型：

```typescript
import {
  AlertType,
  AlertSeverity,
  AlertStatus,
  AlertEventBase,
  AlertDetailsMap,
  SeverityThresholds
} from './shared-types/spec.md';
```

## 数据模型

系统使用 `shared-types/spec.md` 中定义的统一告警类型。完整 AlertType 枚举包含 17 种类型，覆盖评估、队列、审核、系统四大类告警。

AlertEvent 继承 AlertEventBase，details 字段根据 AlertType 使用 AlertDetailsMap 中定义的具体结构：

```typescript
interface AlertEvent extends AlertEventBase {
  details: AlertDetailsMap[this.type];  // 类型安全的 details
  suggestedActions: string[];
}

// 示例：SAFETY_CRITICAL 告警的 details 结构
// {
//   safetyScore: number;
//   threshold: number;
//   delta: number;
//   contraindication?: string;
//   dangerousAdvice?: string[];
// }
```

阈值配置使用 SeverityThresholds：
- safetyCriticalThreshold: 0.5
- faithfulnessWarningThreshold: 0.5
- alertRateLimitPerMinute: 10
- alertAggregationWindowMs: 300000 (5分钟)

## 测试场景

| 场景 | 输入 | 验证点 |
|------|------|--------|
| Safety critical | safety=0.4 | alert type=SAFETY_CRITICAL, severity=critical |
| Faithfulness low | faithfulness=0.45 | alert type=FAITHFULNESS_LOW, severity=warning |
| Alert persistence | 创建告警 | SQLite alerts 表有记录 |
| WebSocket push | critical alert | 1s 内收到 'alert:new' 事件 |
| Alert acknowledge | POST acknowledge | status=acknowledged |