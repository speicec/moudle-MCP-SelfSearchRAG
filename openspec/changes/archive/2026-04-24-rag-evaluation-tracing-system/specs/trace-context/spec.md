---
capability: trace-context
version: 1.0
created: 2026-04-23
---

# Spec: Trace Context

## 概述

统一的追踪上下文容器，整合 TraceVisualizer 和 EvaluationCollector 的数据。

## Requirements

### Requirement: 统一的追踪标识
系统 SHALL 为每次 Agent 执行生成唯一的追踪 ID。

#### Scenario: 生成追踪 ID
- **WHEN** 创建新的 TraceContext
- **THEN** 自动生成 UUID 作为 traceId
- **AND** traceId 格式为标准 UUID v4

#### Scenario: 会话关联
- **WHEN** 提供 sessionId
- **THEN** trace 与会话关联
- **AND** 可通过 sessionId 查询所有相关追踪

### Requirement: 查询信息记录
系统 SHALL 记录完整的查询处理过程。

#### Scenario: 原始查询
- **WHEN** 设置查询
- **THEN** query.raw 存储原始查询字符串
- **AND** timestamp 记录创建时间

#### Scenario: 查询重写
- **WHEN** 查询被重写
- **THEN** query.rewritten 存储重写后的查询
- **AND** query.raw 保留原始查询

#### Scenario: 实体识别
- **WHEN** 完成实体识别
- **THEN** query.entities 存储 MedicalEntities
- **AND** 包含 diseases, drugs, indicators

#### Scenario: 复杂度评估
- **WHEN** 完成复杂度评估
- **THEN** query.complexity 存储 ComplexityAssessment
- **AND** 包含 level 和 needsPlanning

### Requirement: 阶段追踪记录
系统 SHALL 记录每个执行阶段。

#### Scenario: 记录阶段
- **WHEN** 调用 recordSpan
- **THEN** spans 数组添加新元素
- **AND** span 包含 spanId, phase, startTime, endTime, durationMs

#### Scenario: 阶段嵌套
- **WHEN** 阶段有父阶段
- **THEN** parentSpanId 指向父阶段
- **AND** 形成阶段树结构

#### Scenario: 阶段输入输出
- **WHEN** 记录阶段
- **THEN** input 和 output 字段存储阶段数据
- **AND** 数据以 JSON 格式存储

### Requirement: LLM 调用记录
系统 SHALL 记录所有 LLM 调用。

#### Scenario: 调用记录
- **WHEN** 调用 LLM
- **THEN** recordLLMCall 添加调用记录
- **AND** 包含 callId, model, provider, latencyMs

#### Scenario: Token 统计
- **WHEN** LLM 返回 token 信息
- **THEN** 存储 promptTokens 和 completionTokens
- **AND** 如无 token 信息，基于字符数估算

#### Scenario: 调用阶段关联
- **WHEN** 记录 LLM 调用
- **THEN** phase 字段关联到具体执行阶段
- **AND** 可查询每个阶段的 LLM 调用

### Requirement: 检索结果记录
系统 SHALL 记录检索结果用于评估。

#### Scenario: 检索记录
- **WHEN** 完成检索
- **THEN** recordRetrieval 存储所有 RetrievedChunk
- **AND** 每个 chunk 包含 content, similarityScore, source

#### Scenario: 检索元数据
- **WHEN** 记录检索
- **THEN** retrieval 包含 topK, threshold, mode
- **AND** 可用于评估配置参考

### Requirement: 答案记录
系统 SHALL 记录生成的答案。

#### Scenario: 答案记录
- **WHEN** 生成答案
- **THEN** setAnswer 存储答案文本
- **AND** 包含 text, confidence, sources

#### Scenario: 答案置信度
- **WHEN** 答案有置信度评估
- **THEN** 存储 confidence 字段
- **AND** 范围为 0.0 到 1.0

### Requirement: 状态管理
系统 SHALL 管理追踪状态。

#### Scenario: 运行状态
- **WHEN** 创建 TraceContext
- **THEN** 初始状态为 'running'
- **AND** 直到调用 complete 或 fail

#### Scenario: 完成状态
- **WHEN** 调用 complete
- **THEN** 状态变为 'completed'
- **AND** 不再接受新记录

#### Scenario: 失败状态
- **WHEN** 调用 fail
- **THEN** 状态变为 'failed'
- **AND** 存储错误信息

### Requirement: 数据构建
系统 SHALL 构建完整追踪数据。

#### Scenario: 构建追踪
- **WHEN** 调用 build
- **THEN** 返回完整的 TraceContextData
- **AND** 包含所有累积的数据

#### Scenario: 评估占位
- **WHEN** 构建追踪数据
- **THEN** evaluation 字段为 undefined
- **AND** 由 EvaluationPipeline 填充

## API

```typescript
class TraceContext {
  constructor(sessionId?: string);
  
  setQuery(raw: string, rewritten?: string): void;
  setEntities(entities: MedicalEntities): void;
  setComplexity(complexity: ComplexityAssessment): void;
  
  recordSpan(span: TraceSpan): void;
  recordLLMCall(call: LLMCallRecord): void;
  recordRetrieval(chunks: RetrievedChunk[]): void;
  
  setAnswer(answer: string, confidence?: number, sources?: string[]): void;
  
  complete(): void;
  fail(error: string): void;
  
  build(): TraceContextData;
  getTraceId(): string;
}
```

## Testing Criteria

- traceId 格式验证 (UUID v4)
- 查询信息完整性测试
- 阶段记录顺序测试
- LLM 调用计数测试
- 检索结果完整性测试
- 答案记录测试
- 状态转换测试
- build 输出结构测试