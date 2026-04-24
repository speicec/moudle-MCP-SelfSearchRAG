---
capability: trace-storage
version: 1.0
created: 2026-04-23
---

# Spec: Trace Storage

## 概述

SQLite 持久化存储，提供追踪数据和评估结果的 CRUD 操作。

## Requirements

### Requirement: 数据库初始化
系统 SHALL 自动初始化数据库 schema。

#### Scenario: 自动创建表
- **WHEN** 创建 TraceStorage 实例
- **THEN** 自动创建 traces, spans, llm_calls, evaluations 表
- **AND** 创建必要的索引

#### Scenario: 数据库路径
- **WHEN** 指定 dbPath
- **THEN** 数据库文件创建在指定路径
- **AND** 默认路径为 ./data/traces.db

#### Scenario: 内存模式
- **WHEN** dbPath 为 ':memory:'
- **THEN** 使用内存数据库
- **AND** 用于测试场景

### Requirement: 追踪数据存储
系统 SHALL 存储完整的追踪数据。

#### Scenario: 存储追踪主记录
- **WHEN** 调用 saveTrace
- **THEN** traces 表插入一条记录
- **AND** traceId 作为主键

#### Scenario: 存储阶段数据
- **WHEN** 保存追踪
- **THEN** spans 表插入所有阶段记录
- **AND** 外键关联到 traces

#### Scenario: 存储 LLM 调用
- **WHEN** 保存追踪
- **THEN** llm_calls 表插入所有调用记录
- **AND** 外键关联到 traces 和 spans

#### Scenario: JSON 字段存储
- **WHEN** 存储复杂对象
- **THEN** 序列化为 JSON 字符串
- **AND** 查询时反序列化

### Requirement: 评估结果存储
系统 SHALL 存储评估结果。

#### Scenario: 存储评估
- **WHEN** 调用 saveEvaluation
- **THEN** evaluations 表插入一条记录
- **AND** 外键关联到 traces

#### Scenario: 评估分数
- **WHEN** 存储评估
- **THEN** faithfulness_score, context_relevance_score, answer_relevance_score 存储为浮点数
- **AND** overall_score 计算并存储

### Requirement: 追踪查询
系统 SHALL 支持追踪数据查询。

#### Scenario: 单条查询
- **WHEN** 调用 getTrace(traceId)
- **THEN** 返回完整的 TraceContextData
- **AND** 包含 phases, llmCalls, retrieval, answer

#### Scenario: 最近追踪
- **WHEN** 调用 getRecentTraces(limit)
- **THEN** 返回最近 limit 条追踪
- **AND** 按时间倒序排列

#### Scenario: 会话追踪
- **WHEN** 按 sessionId 查询
- **THEN** 返回该会话的所有追踪
- **AND** 按时间排序

#### Scenario: 状态过滤
- **WHEN** 按状态查询
- **THEN** 只返回指定状态的追踪
- **AND** 支持 completed, failed

### Requirement: 评估趋势查询
系统 SHALL 提供评估趋势分析。

#### Scenario: 获取趋势
- **WHEN** 调用 getEvaluationTrends(days)
- **THEN** 返回指定天数内的评估趋势
- **AND** 使用 evaluation_trends 视图

#### Scenario: 趋势数据
- **WHEN** 返回趋势
- **THEN** 包含 date, total_evaluations, avg_faithfulness 等
- **AND** 按日期分组

### Requirement: 数据清理
系统 SHALL 支持数据清理。

#### Scenario: 清理旧数据
- **WHEN** 调用 clearOldTraces(days)
- **THEN** 删除超过指定天数的追踪
- **AND** 同时删除关联的 spans, llm_calls, evaluations

#### Scenario: 清理所有数据
- **WHEN** 调用 clear
- **THEN** 删除所有数据
- **AND** 重置统计

### Requirement: 连接管理
系统 SHALL 管理数据库连接。

#### Scenario: 关闭连接
- **WHEN** 调用 close
- **THEN** 关闭数据库连接
- **AND** 释放资源

#### Scenario: 单例模式
- **WHEN** 多次创建 TraceStorage
- **THEN** 可共享数据库连接
- **AND** 或每次创建新连接

## API

```typescript
class TraceStorage {
  constructor(dbPath?: string);
  
  saveTrace(trace: TraceContextData): void;
  saveEvaluation(result: EvaluationResult): void;
  
  getTrace(traceId: string): TraceContextData | null;
  getRecentTraces(limit?: number): TraceContextData[];
  getTracesBySession(sessionId: string): TraceContextData[];
  getTracesByStatus(status: string): TraceContextData[];
  
  getEvaluationTrends(days?: number): EvaluationTrendData[];
  getEvaluationsByTrace(traceId: string): EvaluationResult[];
  
  clearOldTraces(days: number): void;
  clear(): void;
  
  close(): void;
}
```

## Testing Criteria

- 数据库初始化测试
- 追踪存储完整性测试
- 评估存储测试
- 单条查询测试
- 最近追踪查询测试
- 趋势查询测试
- 数据清理测试
- 连接管理测试
- 并发写入测试