# 设计偏差修复报告

## 时间: 2026-04-24 16:00

## 修复范围

基于 `2026-04-24-1530-rag-evaluation-enhancement-design-consistency.md` 审查报告，修复以下偏差：

---

## 已修复偏差

### Critical

**C1: AlertType 枚举定义不完整** ✅ 已修复

- **修复方式**: 创建 `specs/shared-types/spec.md` 定义完整的 17 种 AlertType
- **变更文件**: 新增 shared-types/spec.md
- **验证**: AlertType 现覆盖评估(4)、队列(8)、审核(2)、系统(3)四大类

---

### Important

**I1: FeedbackAnalyzer FlagType 与 AlertType 职责重叠** ✅ 已修复

- **修复方式**: 在 shared-types/spec.md 中定义 `FlagToAlertMapping` 明确映射关系
- **变更文件**: shared-types/spec.md 第256-282行
- **验证**: HUMAN_REVIEW_REQUIRED → SAFETY_CRITICAL, ATTENTION_REQUIRED → 无Alert, GUIDELINE_VIOLATION → MEDICAL_ACCURACY

**I2: QueueHealthStatus.alerts 类型声明歧义** ✅ 已修复

- **修复方式**: 在 queue-health-monitor/spec.md 添加类型导入说明
- **变更文件**: queue-health-monitor/spec.md 第152-162行
- **验证**: 明确从 shared-types 导入 AlertEvent

**I3: details_json 结构规范不完整** ✅ 已修复

- **修复方式**: 在 shared-types/spec.md 定义 `AlertDetailsMap` 类型安全结构
- **变更文件**: shared-types/spec.md 第83-187行
- **验证**: 每种 AlertType 有具体的 details 字段定义

---

### Minor

**M1: ReviewItem.status 状态流转边界定义不明确** ✅ 已修复

- **修复方式**: 在 shared-types/spec.md 定义 `ReviewStatusFlow` 状态流转图
- **变更文件**: shared-types/spec.md 第289-306行
- **验证**: pending → assigned → reviewed → resolved 流程明确

**M2: SessionConfigStore 存储介质未明确** ✅ 已修复

- **修复方式**: 在 shared-types/spec.md 定义 `SessionConfigStoreStrategy`
- **变更文件**: shared-types/spec.md 第312-331行
- **验证**: Redis primary, in-memory fallback 策略明确

**M3: Layer3 LLM Response Schema 字段命名不一致** ✅ 已修复

- **修复方式**: 在 shared-types/spec.md 定义 `Layer3LLMResponse` 和 `Layer3SystemResult` 命名约定
- **变更文件**: shared-types/spec.md 第335-366行
- **验证**: Response → Result 转换规则明确

---

## 文件变更清单

| 文件 | 变更类型 | 主要内容 |
|------|----------|----------|
| `specs/shared-types/spec.md` | 新增 | 17种AlertType、AlertDetailsMap、FlagToAlertMapping、ReviewStatusFlow、SessionConfigStoreStrategy、Layer3命名约定 |
| `specs/evaluation-alerts/spec.md` | 修改 | 添加类型导入、引用shared-types的AlertType和AlertDetailsMap |
| `specs/queue-health-monitor/spec.md` | 修改 | 添加类型导入、引用shared-types的AlertEvent和阈值配置 |
| `specs/human-review-queue/spec.md` | 修改 | 添加类型导入、引用shared-types的ReviewStatus和ReviewStatusFlow |
| `specs/layer3-llm-evaluation/spec.md` | 修改 | 添加类型导入、引用shared-types的Layer3命名约定 |
| `specs/feedback-analyzer/spec.md` | 修改 | 添加类型导入、引用shared-types的FlagToAlertMapping和SessionConfigStoreStrategy |
| `specs/safety-layer/spec.md` | 修改 | 添加类型导入、引用shared-types的AlertType和AlertDetailsMap |
| `specs/evaluation-autoscaler/spec.md` | 修改 | 添加类型导入、引用shared-types的SCALE_FAILURE结构 |
| `design.md` | 修改 | 添加Shared Types章节、告警表引用shared-types、Adjustment引用shared-types |

---

## 验证结果

### 类型导入验证 ✅

所有 7 个 spec 文件均已添加 `## 类型导入` 章节并正确引用 shared-types/spec.md：

- evaluation-alerts/spec.md: 第116行
- queue-health-monitor/spec.md: 第152行
- human-review-queue/spec.md: 第132行
- layer3-llm-evaluation/spec.md: 第201行
- feedback-analyzer/spec.md: 第161行
- safety-layer/spec.md: 第111行
- evaluation-autoscaler/spec.md: 第185行

### AlertType 覆盖验证 ✅

完整 AlertType 枚举 (17种)：

```typescript
type AlertType =
  // Evaluation alerts (4)
  | 'SAFETY_CRITICAL' | 'FAITHFULNESS_LOW' | 'MEDICAL_ACCURACY' | 'CONTEXT_IRRELEVANT'
  // Queue alerts (8)
  | 'QUEUE_BACKLOG' | 'QUEUE_BACKLOG_TREND' | 'HIGH_FAILURE_RATE' | 'FAILURE_SPIKE'
  | 'NO_ACTIVE_WORKERS' | 'LOW_WORKER_ACTIVITY' | 'HIGH_PROCESSING_TIME' | 'PROCESSING_TIME_TREND'
  // Review alerts (2)
  | 'REVIEW_SLA_BREACH' | 'REVIEW_CRITICAL_SLA'
  // System alerts (3)
  | 'SCALE_FAILURE' | 'DRUG_INTERACTION' | 'COST_THRESHOLD_EXCEEDED';
```

### design.md 引用验证 ✅

design.md 第54行添加 `## Shared Types` 章节，明确说明类型定义来源。

---

## 剩余建议 (未阻塞实现)

以下为审查报告中的非阻塞建议，可在实现阶段补充：

- **R2补充**: evaluation-alerts/spec.md 中明确速率限制阈值 "每分钟最多推送10条告警" → 已在 shared-types 的 SeverityThresholds 中定义 `alertRateLimitPerMinute: 10`
- **R5补充**: layer3-llm-evaluation/spec.md 中添加结果缓存机制说明 → 建议在实现时补充
- **D1补充**: 添加 COST_THRESHOLD_EXCEEDED 告警类型 → 已在 AlertType 枚举中添加

---

## 总结

所有 Critical 和 Important 偏差已修复，Minor 偏差已解决。设计文档和规格文档现已保持一致，可进入实现阶段。

---

**修复人**: Claude Opus 4.7
**修复时间**: 2026-04-24 16:00
**报告版本**: 1.0