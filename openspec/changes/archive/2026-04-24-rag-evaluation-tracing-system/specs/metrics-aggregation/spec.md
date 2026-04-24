---
capability: metrics-aggregation
version: 1.0
created: 2026-04-23
---

# Spec: Metrics Aggregation

## 概述

整合追踪指标和评估分数，推送到 StatsDashboard 和 WebSocket 客户端。

## Requirements

### Requirement: 评估指标聚合
系统 SHALL 聚合评估指标。

#### Scenario: 平均分数计算
- **WHEN** 调用 getEvaluationMetrics
- **THEN** 返回平均评估分数
- **AND** 包含 Faithfulness, Context Relevance, Answer Relevance

#### Scenario: 趋势数据
- **WHEN** 获取评估指标
- **THEN** 包含最近 7 天的评估趋势
- **AND** 每天一条数据

#### Scenario: 总计数
- **WHEN** 获取评估指标
- **THEN** 返回总评估次数
- **AND** 用于显示统计

### Requirement: 追踪指标聚合
系统 SHALL 聚合追踪指标。

#### Scenario: 平均耗时
- **WHEN** 调用 getTraceMetrics
- **THEN** 返回平均追踪耗时
- **AND** 按阶段分解

#### Scenario: LLM 调用统计
- **WHEN** 获取追踪指标
- **THEN** 返回平均 LLM 调用次数
- **AND** 按模型分解

#### Scenario: 成功率
- **WHEN** 获取追踪指标
- **THEN** 返回追踪成功率
- **AND** 区分 completed 和 failed

### Requirement: 实时推送
系统 SHALL 推送实时更新。

#### Scenario: WebSocket 广播
- **WHEN** 设置 broadcast 函数
- **THEN** 可推送实时更新到前端
- **AND** 使用 WebSocket

#### Scenario: 评估更新
- **WHEN** 评估完成
- **THEN** 推送 evaluation 分数
- **AND** 包含 traceId 关联

#### Scenario: 追踪更新
- **WHEN** 追踪完成
- **THEN** 推送追踪状态
- **AND** 包含耗时和调用次数

### Requirement: 告警机制
系统 SHALL 支持评估告警。

#### Scenario: 阈值告警
- **WHEN** 评估分数低于阈值
- **THEN** 触发告警事件
- **AND** 推送到 WebSocket

#### Scenario: 告警内容
- **WHEN** 触发告警
- **THEN** 包含指标名称、分数、阈值
- **AND** 建议 action

### Requirement: 与 StatsDashboard 集成
系统 SHALL 与现有 StatsDashboard 集成。

#### Scenario: 数据结构兼容
- **WHEN** 推送数据
- **THEN** 格式与 statsStore 兼容
- **AND** 前端可直接使用

#### Scenario: WebSocket 事件类型
- **WHEN** 推送事件
- **THEN** 使用 'metrics:update' 事件类型
- **AND** 前端可识别处理

## API

```typescript
class MetricsAggregator {
  constructor(storage: TraceStorage);
  
  setBroadcast(fn: (event: AggregationEvent) => void): void;
  
  getEvaluationMetrics(): EvaluationMetrics;
  getTraceMetrics(): TraceMetrics;
  
  broadcastUpdate(trace: TraceContextData, evaluation?: EvaluationResult): void;
  
  checkThresholds(evaluation: EvaluationResult): AlertEvent[];
}

interface AggregationEvent {
  type: 'metrics:update' | 'metrics:alert';
  traceId: string;
  evaluation?: EvaluationScores;
  trace?: TraceSummary;
  alerts?: AlertEvent[];
  timestamp: number;
}
```

## Testing Criteria

- 评估指标聚合测试
- 追踪指标聚合测试
- WebSocket 广播测试
- 阈值告警测试
- 与 statsStore 集成测试