---
capability: safety-layer
version: 1.1
created: 2026-04-24
delta: true
---

# Spec: Safety Layer (Delta)

## 概述

Safety Layer 与告警机制集成，在检测到绝对禁忌时触发 Critical Alert。

## MODIFIED Requirements

### Requirement: Safety Pre-Check

系统能从用户查询中提取完整的临床阈值条件，包含指标、运算符、数值和单位。

**新增**: 当 severity = 'absolute' 时，系统 SHALL 自动触发 SAFETY_CRITICAL 告警。

#### Scenario: 绝对禁忌匹配 (增强)
- **WHEN** 患者指标 eGFR=25，查询 "二甲双胍用法"
- **THEN** severity = "absolute"，recommendation = "禁用二甲双胍"
- **AND** SAFETY_CRITICAL alert 自动创建
- **AND** Human Review Queue 自动添加审核项
- **AND** priority = 'critical'

#### Scenario: 相对禁忌匹配 (增强)
- **WHEN** 患者指标 eGFR=40，查询 "二甲双胍用法"
- **THEN** severity = "relative"，recommendation = "慎用，需减量"
- **AND** ATTENTION_REQUIRED flag 生成
- **AND** priority = 'high'

#### Scenario: 药物相互作用 (增强)
- **WHEN** 查询包含 "二甲双胍 + 西咪替丁"
- **THEN** severity = "interaction"，interactions 包含相互作用详情
- **AND** DRUG_INTERACTION alert 创建
- **AND** severity = 'warning'

### Requirement: Three-Layer Answer Synthesis

答案生成综合 SafetyAssessment、RetrievalResults、EvidenceEvaluation 三层信息。

**新增**: 当 SafetyAssessment.severity = 'absolute' 时，系统 SHALL 阻止答案发布并等待人工审核。

#### Scenario: 禁忌优先 (增强)
- **WHEN** SafetyAssessment.severity = "absolute"
- **THEN** conclusion 使用 SafetyAssessment.recommendation
- **AND** 不再引用检索的用药建议
- **AND** answerStatus = 'blocked_pending_review'
- **AND** 用户看到 "答案需要人工审核" 提示

#### Scenario: 相对禁忌综合 (增强)
- **WHEN** SafetyAssessment.severity = "relative"
- **THEN** conclusion = "慎用"
- **AND** details 包含阈值说明 + 检索的调整建议
- **AND** answerStatus = 'warning'
- **AND** 用户看到安全警告徽章

## ADDED Requirements

### Requirement: Alert Integration

系统 SHALL 与 AlertHandler 模块集成，自动触发安全告警。

#### Scenario: Absolute contraindication alert
- **WHEN** SafetyAssessment.severity = 'absolute'
- **THEN** AlertHandler.createSafetyAlert() called
- **AND** alert includes traceId, evaluationId
- **AND** suggestedActions = ['阻止答案发布', '立即人工审核', '检查禁忌阈值']

#### Scenario: Relative contraindication alert
- **WHEN** SafetyAssessment.severity = 'relative'
- **THEN** AlertHandler.createAttentionAlert() called
- **AND** severity = 'warning'
- **AND** suggestedActions = ['添加警告徽章', '建议用户咨询医生']

### Requirement: Human Review Trigger

系统 SHALL 在绝对禁忌时自动触发人工审核流程。

#### Scenario: Auto-create review item
- **WHEN** SAFETY_CRITICAL alert created from Safety Layer
- **THEN** HumanReviewQueue.add() called automatically
- **AND** reason = 'Absolute contraindication detected'
- **AND** priority = 'critical'

#### Scenario: Review item includes safety details
- **WHEN** review item created from Safety Layer
- **THEN** reviewNotes includes SafetyAssessment details
- **AND** includes threshold conditions
- **AND** includes recommendation

### Requirement: Answer Blocking

系统 SHALL 在绝对禁忌时阻止答案发布。

#### Scenario: Block answer publication
- **WHEN** SafetyAssessment.severity = 'absolute'
- **THEN** answer publication blocked
- **AND** status = 'blocked_pending_review'
- **AND** WebSocket notifies frontend with block status

#### Scenario: Unblock after review approval
- **WHEN** Human Review resolves with 'approve'
- **THEN** answer unblocked
- **AND** status updated to 'approved'
- **AND** WebSocket notifies frontend

## 类型导入

本 spec 使用 `shared-types/spec.md` 中定义的类型：

```typescript
import {
  AlertType,
  AlertSeverity,
  AlertEventBase,
  AlertDetailsMap
} from './shared-types/spec.md';
```

## 数据模型变更

```typescript
interface SafetyLayerOutput {
  thresholdConditions: ThresholdCondition[];
  safetyAssessment: SafetyAssessment;
  evidenceEvaluation?: EvidenceEvaluationResult;
  synthesizedAnswer: SynthesizedAnswer;
  // 新增字段
  alertTriggered?: AlertEvent;
  reviewItemId?: string;
  answerStatus?: 'approved' | 'blocked_pending_review' | 'warning';
}
```

## 测试场景变更

| 场景 | 输入 | 验证点 |
|------|------|--------|
| eGFR 禁忌检测 | eGFR=25, 二甲双胍查询 | severity="absolute", SAFETY_CRITICAL alert, review item created |
| 相对禁忌 | eGFR=40 | severity="relative", ATTENTION_REQUIRED flag |
| 答案阻止 | absolute severity | answerStatus='blocked_pending_review' |
| 审核后解锁 | review approved | answerStatus='approved' |