# 设计一致性检查报告

## 时间: 2026-04-24 15:30

## 检查范围
- **设计文档:** `openspec/changes/rag-evaluation-enhancement/design.md`
- **规格文档:** 7个spec文件
  - `specs/evaluation-alerts/spec.md`
  - `specs/human-review-queue/spec.md`
  - `specs/layer3-llm-evaluation/spec.md`
  - `specs/queue-health-monitor/spec.md`
  - `specs/evaluation-autoscaler/spec.md`
  - `specs/feedback-analyzer/spec.md`
  - `specs/safety-layer/spec.md`
- **检查类型:** Design-Specs一致性 + Specs内部一致性 + 系统兼容性

## 契约一致性状态: ⚠ 存在偏差

---

## 一致项

✓ **AlertEvent 数据模型核心字段** - evaluation-alerts/spec.md 与 design.md D2 告警表设计一致
  - alertId, timestamp, type, severity, traceId, evaluationId 均匹配
  - status 字段 (active/acknowledged/resolved) 一致

✓ **Human Review API 端点** - human-review-queue/spec.md 与 design.md D3 API设计一致
  - GET /api/review/pending
  - POST /api/review/:id/assign
  - POST /api/review/:id/approve
  - POST /api/review/:id/reject

✓ **AutoscalerConfig 配置参数** - evaluation-autoscaler/spec.md 与 design.md D4一致
  - minReplicas: 1, maxReplicas: 10
  - scaleUpThreshold: 50, scaleDownThreshold: 5
  - cooldownPeriod: 300000ms, checkInterval: 60000ms

✓ **Adjustment 数据模型** - feedback-analyzer/spec.md 与 design.md D5一致
  - target, change, reason, expiresAt 字段完整
  - 会话级作用域设计一致

✓ **Layer 3 批量评估方案** - layer3-llm-evaluation/spec.md 与 design.md D1一致
  - 单次LLM调用评估三个指标
  - 条件触发机制完整定义

✓ **Safety Layer 增强集成** - safety-layer/spec.md (delta) 与 design.md架构一致
  - AlertHandler集成正确
  - HumanReviewQueue触发流程正确

✓ **SafetyAssessment severity 映射** - safety-layer/spec.md 与 evaluation-alerts/spec.md一致
  - 'absolute' → SAFETY_CRITICAL + critical severity
  - 'relative' → ATTENTION_REQUIRED + warning severity

---

## 偏差列表

### Critical

**C1: AlertType 枚举定义不完整**
- **位置**: evaluation-alerts/spec.md 第139-145行
- **问题**: AlertType 仅定义6种类型，但其他spec引用了更多类型:
  - queue-health-monitor 使用: `NO_ACTIVE_WORKERS`, `FAILURE_SPIKE`, `HIGH_PROCESSING_TIME`, `PROCESSING_TIME_TREND`, `QUEUE_BACKLOG_TREND`
  - human-review-queue 使用: `REVIEW_SLA_BREACH`, `REVIEW_CRITICAL_SLA`
  - evaluation-autoscaler 使用: `SCALE_FAILURE`
  - safety-layer (delta) 使用: `DRUG_INTERACTION`
- **影响**: 类型定义不完整会导致实现时类型检查失败或遗漏告警处理逻辑
- **修复建议**: 扩展 AlertType 为完整枚举:
```typescript
type AlertType =
  // Evaluation alerts
  | 'SAFETY_CRITICAL'
  | 'FAITHFULNESS_LOW'
  | 'MEDICAL_ACCURACY'
  | 'CONTEXT_IRRELEVANT'
  // Queue alerts
  | 'QUEUE_BACKLOG'
  | 'QUEUE_BACKLOG_TREND'
  | 'HIGH_FAILURE_RATE'
  | 'FAILURE_SPIKE'
  | 'NO_ACTIVE_WORKERS'
  | 'LOW_WORKER_ACTIVITY'
  | 'HIGH_PROCESSING_TIME'
  | 'PROCESSING_TIME_TREND'
  // Review alerts
  | 'REVIEW_SLA_BREACH'
  | 'REVIEW_CRITICAL_SLA'
  // System alerts
  | 'SCALE_FAILURE'
  | 'DRUG_INTERACTION';
```

---

### Important

**I1: FeedbackAnalyzer FlagType 与 AlertType 职责重叠**
- **位置**: feedback-analyzer/spec.md 第186-191行
- **问题**: FlagType 定义与 AlertType 部分重叠但不完全一致:
  - `HUMAN_REVIEW_REQUIRED` vs `SAFETY_CRITICAL`
  - `ATTENTION_REQUIRED` vs 无对应AlertType
  - `GUIDELINE_VIOLATION` vs `MEDICAL_ACCURACY`
- **影响**: FeedbackAnalyzer生成的Flag与Alert系统之间映射关系不明确
- **修复建议**: 明确Flag与Alert的映射关系，或在FeedbackAnalyzer中直接引用AlertType:
```typescript
// Option A: 统一使用AlertType
interface Flag {
  alertType: AlertType;
  reason: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

// Option B: 明确映射文档
// HUMAN_REVIEW_REQUIRED → triggers SAFETY_CRITICAL alert creation
// ATTENTION_REQUIRED → triggers warning severity behavior
```

**I2: QueueHealthStatus.alerts 类型声明歧义**
- **位置**: queue-health-monitor/spec.md 第156行
- **问题**: `alerts: AlertEvent[]` 声明使用了AlertEvent类型，但:
  - AlertEvent 定义在 evaluation-alerts/spec.md 中
  - queue-health-monitor 应明确依赖 AlertEvent 类型定义
- **影响**: 实现时需要跨spec导入类型定义，可能导致循环依赖
- **修复建议**: 在 specs 目录创建共享类型文件 `specs/shared-types.md` 或在各spec中明确标注类型来源

**I3: details_json 结构规范不完整**
- **位置**: design.md 第94行 vs evaluation-alerts/spec.md 第127-130行
- **问题**: Design中 `details_json TEXT` 的结构定义为 `{ metric, value, threshold, delta }`
  - 但 AlertEvent.details 使用了更具体的对象结构
  - 不同告警类型的details可能需要不同字段
- **影响**: 不同类型告警的details字段实现可能不一致
- **修复建议**: 为每种AlertType定义具体的details结构:
```typescript
interface AlertDetailsMap {
  SAFETY_CRITICAL: { safetyScore: number; threshold: number; contraindication: string };
  FAITHFULNESS_LOW: { metric: 'faithfulness'; value: number; threshold: number; delta: number };
  QUEUE_BACKLOG: { waiting: number; threshold: number; growthRate: number };
  // ...
}
```

---

### Minor

**M1: ReviewItem.status 状态流转边界定义不明确**
- **位置**: human-review-queue/spec.md 第141行
- **问题**: status 定义为 `'pending' | 'assigned' | 'reviewed' | 'resolved'`
  - 'reviewed' 状态与 approve/reject 操作的关系不清晰
  - 应该是 pending → assigned → reviewed → resolved 还是 pending → assigned → resolved?
- **影响**: 审核流程实现可能有歧义
- **修复建议**: 明确状态流转图:
```
pending → assigned → reviewed → resolved (approve/reject)
      ↓
  SLA breach → priority upgrade
```

**M2: SessionConfigStore 存储介质未明确**
- **位置**: feedback-analyzer/spec.md 第208-217行 & design.md 第158行
- **问题**: Design说"Redis 或内存存储"，spec说"Redis or in-memory"
  - Redis依赖已在docker-compose中配置，但内存存储作为备选方案未说明触发条件
- **影响**: 部署配置不明确
- **修复建议**: 明确存储选择策略:
```typescript
// When Redis available: use Redis with TTL
// When Redis unavailable: use in-memory Map with setTimeout cleanup
```

**M3: Layer3 LLM Response Schema 字段命名不一致**
- **位置**: layer3-llm-evaluation/spec.md 第156-199行 vs 第203-238行
- **问题**: Layer3Response (LLM输出) 与 Layer3Result (系统输出) 字段命名不完全一致:
  - Response.evidence.citationAnalysis vs Result.evidence.citationAccuracy
  - Response.completeness.covered vs Result.completeness.coveredSubQuestions
- **影响**: JSON解析后的数据映射实现可能有混淆
- **修复建议**: 统一命名或添加明确的转换注释

---

## 与现有系统兼容性

### TraceStorage 兼容性: ✓ 兼容

**分析结果**:
- 现有表结构 (traces, spans, llm_calls, evaluations) 无需修改
- 新增 alerts 和 human_review_queue 表可通过扩展 SCHEMA_SQL 实现
- 建议添加新索引:
```sql
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_review_status ON human_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_priority ON human_review_queue(priority);
```

### MetricsAggregator 兼容性: ⚠ 需扩展

**分析结果**:
- 现有 `broadcastFn` 和 `broadcastUpdate` 方法可复用
- 需新增告警专用广播方法:
```typescript
// 建议新增
broadcastAlert(alert: AlertEvent): void {
  this.broadcastFn({
    type: 'alert:new',
    alertId: alert.alertId,
    severity: alert.severity,
    details: alert,
    timestamp: Date.now(),
  });
}
```
- `AggregationEvent` 类型需扩展以支持告警事件

### MedicalEvaluationPipeline 兼容性: ✓ 兼容

**分析结果**:
- ExtendedEvaluationResult 已包含 `riskLevel`, `layerScores` 字段
- 新设计可直接使用这些字段触发告警
- Layer3Evaluator 可替换现有的规则实现:
  - `evaluateEvidenceTraceability`: 从规则 → LLM批量评估
  - `evaluateCompleteness`: 从规则 → LLM批量评估
  - `evaluateTerminologyAccuracy`: 从规则 → LLM批量评估
- 条件触发机制可通过 Pipeline 配置注入

### Safety Layer 兼容性: ✓ 兼容

**分析结果**:
- SafetyLayerOutput 已定义，新增字段不影响现有流程
- 新增字段可作为可选扩展:
```typescript
interface SafetyLayerOutput {
  // 现有字段
  thresholdConditions: ThresholdCondition[];
  safetyAssessment: SafetyAssessment;
  evidenceEvaluation?: EvidenceEvaluationResult;
  synthesizedAnswer: SynthesizedAnswer;
  // 新增可选字段 (不影响现有实现)
  alertTriggered?: AlertEvent;
  reviewItemId?: string;
  answerStatus?: 'approved' | 'blocked_pending_review' | 'warning';
}
```

---

## 关键决策验证

### D1: Layer 3 批量 Prompt vs 单独调用

**验证结果**: ✓ 完整实现

| 冺策要点 | Spec覆盖 | 验证状态 |
|---------|---------|---------|
| 单次LLM调用三个指标 | Batch LLM Evaluation Requirement | ✓ |
| 条件触发机制 | Conditional Trigger Requirement | ✓ |
| Prompt截断控制 | Batch prompt includes full context (2000 chars) | ✓ |
| JSON解析fallback | JSON Response Parsing Requirement | ✓ |
| 成本监控 | metadata记录retryCount | ✓ |

**遗漏**: 成本阈值告警 (Design提到"每日成本 > $50 时告警") 未在spec中定义告警类型

---

### D2: 告警机制存储 vs 仅 WebSocket 推送

**验证结果**: ✓ 完整实现

| 冺策要点 | Spec覆盖 | 验证状态 |
|---------|---------|---------|
| SQLite存储 | Alert Storage Requirement | ✓ |
| WebSocket推送 | WebSocket Broadcast Requirement | ✓ |
| 告警聚合 (5min) | Alert aggregation for high frequency | ✓ |
| 速率限制 (10/min) | 未明确 | ⚠ 需补充 |
| 优先级过滤 | Critical alert broadcast immediately | ✓ |

---

### D3: Human Review Queue MVP 设计

**验证结果**: ✓ 完整实现

| 冺策要点 | Spec覆盖 | 验证状态 |
|---------|---------|---------|
| SQLite存储 | Review Item Storage Requirement | ✓ |
| REST API | 8个API端点定义 | ✓ |
| 审核流程 | Assign → Approve/Reject scenarios | ✓ |
| SLA监控 | Review SLA Monitoring Requirement | ✓ |
| Audit Log | resolutionAction, reviewNotes记录 | ✓ |

---

### D4: 自定义 Autoscaler vs Kubernetes HPA

**验证结果**: ✓ 完整实现

| 冺策要点 | Spec覆盖 | 验证状态 |
|---------|---------|---------|
| Docker Compose集成 | Docker API Integration Requirement | ✓ |
| 扩缩容策略 | Scale Up/Down Decision Requirements | ✓ |
| 冷却期 | Cooldown Period Requirement | ✓ |
| 手动干预 | Manual Override Requirement | ✓ |
| 事件日志 | Scale Event Logging Requirement | ✓ |

---

### D5: FeedbackAnalyzer Adjustment 作用域

**验证结果**: ✓ 完整实现

| 冺策要点 | Spec覆盖 | 验证状态 |
|---------|---------|---------|
| 会话级作用域 | Adjustment Scope Requirement | ✓ |
| 1小时过期 | Adjustment expires after 1 hour | ✓ |
| 不持久化全局 | No global impact scenario | ✓ |
| SessionConfigStore | Signal Storage Requirement | ✓ |

---

## 风险缓解验证

| 风险 | 缓解措施 | Spec覆盖 | 状态 |
|-----|---------|---------|------|
| R1: LLM成本上升 | 条件触发 + Prompt截断 + 成本监控 | layer3-llm-evaluation | ✓ |
| R2: 告警风暴 | 告警聚合 + 速率限制 + 优先级过滤 | evaluation-alerts | ⚠ 速率限制未明确阈值 |
| R3: Review积压 | 优先级分级 + SLA监控 + 自动升级 | human-review-queue | ✓ |
| R4: 过度扩缩容 | 冷却期 + maxReplicas + 手动干预 | evaluation-autoscaler | ✓ |
| R5: LLM结果不稳定 | JSON fallback + retry + 缓存 | layer3-llm-evaluation | ✓ 缓存未明确 |

---

## 建议

→ **C1修复**: 扩展 `evaluation-alerts/spec.md` 的 AlertType 枚举，包含所有系统告警类型，确保类型定义完整覆盖

→ **I1修复**: 在 `feedback-analyzer/spec.md` 中明确 Flag 与 Alert 的关系，考虑统一使用 AlertType 或定义显式映射

→ **I2修复**: 创建 `specs/shared-types.md` 定义跨spec共享的数据类型，避免重复定义和循环依赖

→ **I3修复**: 为每种 AlertType 定义具体的 details 结构模板，在 design.md 或 shared-types.md 中规范

→ **R2补充**: 在 `evaluation-alerts/spec.md` 中明确速率限制阈值: "每分钟最多推送10条告警"

→ **R5补充**: 在 `layer3-llm-evaluation/spec.md` 中添加结果缓存机制说明

→ **D1补充**: 添加 `COST_THRESHOLD_EXCEEDED` 告警类型，每日LLM成本超过阈值时触发

---

## 总结

本次设计一致性检查发现 **1个Critical偏差**、**3个Important偏差**、**3个Minor偏差**。

主要问题集中在 **类型定义不完整** 和 **跨spec数据模型协调不足**。建议在实现前:

1. 扩展 AlertType 枚举定义
2. 创建共享类型定义文件
3. 明确各告警类型的 details 结构
4. 补充速率限制和缓存机制的规格说明

设计整体架构合理，与现有系统兼容性良好，修复上述偏差后可进入实现阶段。

---

**检查人**: Claude Opus 4.7
**检查时间**: 2026-04-24 15:30
**报告版本**: 1.0