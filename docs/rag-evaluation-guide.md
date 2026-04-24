# RAG 评估体系指南

## 概述

本文档介绍 RAG 评估体系的架构、使用方法和最佳实践。评估体系基于 RAGAS 方法，扩展了医疗领域的专业评估维度。

> **架构演进**: 详见 [RAG 评估系统架构演进路线图](./rag-evaluation-system-evolution.md)，包含四大改进方向、实施路线和可演进方向。

## 架构设计

### 评估维度 (8 维度)

#### Layer 1: 基础 RAGAS 评估

| 维度 | 说明 | 权重 |
|------|------|------|
| **Faithfulness (忠实度)** | 答案是否忠实于检索内容，检测幻觉 | 0.20 |
| **Context Relevance (上下文相关性)** | 检索内容是否与问题相关 | 0.10 |
| **Answer Relevance (答案相关性)** | 答案是否回答了问题 | 0.10 |

#### Layer 2: 医疗核心评估

| 维度 | 说明 | 权重 |
|------|------|------|
| **Medical Accuracy (医疗准确性)** | 术语使用正确性、指南符合度 | 0.20 |
| **Safety Assessment (安全评估)** | 禁忌检测、相互作用风险 | 0.20 |

#### Layer 3: 医疗增强评估

| 维度 | 说明 | 权重 | 当前实现 |
|------|------|------|----------|
| **Evidence Traceability (证据可追溯性)** | 来源标注、引用准确性 | 0.10 | 规则驱动 (正则匹配) |
| **Completeness (完整性)** | 实体覆盖、问题覆盖 | 0.05 | 规则驱动 (启发式) |
| **Terminology Accuracy (术语准确性)** | 医疗术语使用准确性 | 0.05 | 规则驱动 (关键词匹配) |

> **当前限制**: Layer 3 三个指标目前使用规则驱动，而非 LLM 驱动评估。这限制了评估的准确性：
> - Evidence Traceability: 无法验证引用是否正确对应内容
> - Completeness: 无法判断是否回答了所有隐含子问题
> - Terminology Accuracy: 无法判断术语是否在正确语境中使用
>
> **计划改进**: 将在架构演进 Phase 2 中实现 LLM 驱动的批量评估，详见 [架构演进路线图](./rag-evaluation-system-evolution.md#21-layer-3-增强)。

### 风险等级

| 等级 | 说明 | 阈值 |
|------|------|------|
| **Safe** | 安全 | 综合分数 ≥ 0.85, 安全评估 ≥ 0.85 |
| **Caution** | 注意 | 综合分数 ≥ 0.70, 安全评估 ≥ 0.70 |
| **Warning** | 警告 | 综合分数 < 0.70 或 安全评估 < 0.70 |
| **Danger** | 危险 | 安全评估 < 0.50 |

> **告警机制**: 当风险等级为 Danger 或 Faithfulness < 0.5 时，系统应触发告警。
> 当前版本仅记录风险等级，完整告警机制（WebSocket推送、人工审核队列）将在架构演进 Phase 1 中实现。
> 详见 [架构演进路线图](./rag-evaluation-system-evolution.md#22-告警机制)。

## 使用方法

### 1. 同步评估

```typescript
import { createMedicalEvaluationPipeline } from './evaluation';
import { createLLMCaller } from './config/llm-config';
import { createTraceContext } from './tracing';

// 创建评估流水线
const llmCaller = createLLMCaller();
const pipeline = createMedicalEvaluationPipeline(llmCaller);

// 创建追踪数据
const context = createTraceContext();
context.setQuery('高血压患者如何选择降压药？');
context.setAnswer('建议首选二甲双胍...');
context.recordRetrieval([...retrievedChunks]);
context.complete();

// 执行评估
const result = await pipeline.evaluate(context.build());

console.log('综合分数:', result.overallScore);
console.log('风险等级:', result.riskLevel);
```

### 2. 异步评估 (推荐)

```typescript
import { createEvaluationQueue } from './queue';
import { createTraceContext } from './tracing';

// 创建队列
const queue = await createEvaluationQueue();

// 创建追踪数据
const context = createTraceContext();
// ... 设置数据

// 添加任务 (不阻塞)
const job = await queue.addJob(context.build(), 'normal', {
  onSuccess: (result) => {
    console.log('评估完成:', result.overallScore);
  },
  onError: (error) => {
    console.error('评估失败:', error);
  },
  onProgress: (progress) => {
    console.log('进度:', progress);
  },
});

// 立即返回，评估在后台执行
```

### 3. 查询评估状态

```typescript
// 查询任务状态
const status = await queue.getJobStatus(job.id);

// 查询队列统计
const stats = await queue.getQueueStats();
console.log('等待:', stats.waiting);
console.log('执行:', stats.active);
console.log('完成:', stats.completed);
console.log('失败:', stats.failed);
```

## 配置选项

### 权重配置

```typescript
import { DEFAULT_EVALUATION_CONFIG } from './evaluation/types';

// 自定义权重
const customConfig = {
  weights: {
    faithfulness: 0.25,
    contextRelevance: 0.10,
    answerRelevance: 0.10,
    medicalAccuracy: 0.25,
    safetyAssessment: 0.15,
    evidenceTraceability: 0.10,
    completeness: 0.03,
    terminologyAccuracy: 0.02,
  },
};

const pipeline = createMedicalEvaluationPipeline(llmCaller, customConfig);
```

### 阈值配置

```typescript
const config = {
  thresholds: {
    faithfulness: 0.7,      // 低于此值告警
    contextRelevance: 0.6,
    answerRelevance: 0.6,
    overall: 0.65,
    safetyCritical: 0.5,    // 安全评估低于此值为危险
  },
};
```

## Docker 部署

### 启动服务

```bash
# 启动所有服务 (包括 Redis + Worker)
docker-compose up -d

# 查看 Worker 日志
docker-compose logs -f evaluation-worker

# 扩展 Worker 数量
docker-compose up -d --scale evaluation-worker=3
```

### 手动启动 Worker

```bash
# 本地运行 Worker
npm run worker:evaluation

# 或直接运行
npx tsx src/workers/evaluation-worker.ts
```

## 监控

### Bull Board 队列监控

访问 `/admin/queues` 查看：
- 任务状态 (pending/active/completed/failed)
- 任务详情
- 手动重试/删除任务

### WebSocket 实时更新

```typescript
// 前端订阅评估更新
import { useStatsStore } from './store/statsStore';

const { evaluationMetrics, handleEvaluationUpdate } = useStatsStore();

// WebSocket 自动处理 'metrics:update' 事件
```

## 最佳实践

### 1. 生产环境推荐配置

```typescript
const productionConfig = {
  mode: 'full',
  weights: {
    faithfulness: 0.25,
    safetyAssessment: 0.20,
    medicalAccuracy: 0.20,
    // ... 其他维度
  },
  thresholds: {
    faithfulness: 0.75,
    safetyCritical: 0.60,
  },
};
```

### 2. 评估结果处理

```typescript
// 处理评估结果
function handleEvaluation(result) {
  if (result.riskLevel === 'danger') {
    // 阻止发布或人工审核
    alertDangerousContent(result);
  } else if (result.riskLevel === 'warning') {
    // 添加警告标记
    addWarningFlag(result);
  } else {
    // 正常发布
    publishContent(result);
  }
}
```

### 3. 批量评估

```typescript
// 批量评估历史追踪
const traces = await traceStorage.getRecentTraces(100);

await queue.addBatch(
  traces.map(trace => ({
    traceData: trace,
    priority: 'normal',
  }))
);
```

## 常见问题

### Q: 评估增加多少延迟？

同步评估约 3-5 秒。异步评估不阻塞主流程，提交时间 < 50ms。

### Q: 评估失败如何处理？

Bull 自动重试 3 次，间隔递增 (1s, 2s, 4s)。失败任务可在 Bull Board 手动重试。

### Q: 如何调整并发数？

```bash
# 环境变量
EVALUATION_CONCURRENCY=4

# Docker
docker-compose up -d --scale evaluation-worker=4
```

### Q: 如何持久化追踪数据？

追踪数据自动存储到 SQLite (`./data/traces.db`)。评估结果关联到追踪记录。

## API 参考

### TraceContext

```typescript
class TraceContext {
  setQuery(raw: string, rewritten?: string): void;
  setEntities(entities: MedicalEntities): void;
  recordSpan(span: TraceSpan): void;
  recordLLMCall(call: LLMCallRecord): void;
  recordRetrieval(chunks: RetrievedChunk[]): void;
  setAnswer(answer: string, confidence?: number): void;
  complete(): void;
  fail(error: string): void;
  build(): TraceContextData;
}
```

### EvaluationQueue

```typescript
class EvaluationQueue {
  addJob(trace: TraceContextData, priority?: JobPriority, handlers?: ResultHandlers): Promise<Job>;
  addBatch(traces: BatchItem[]): Promise<Job[]>;
  getJobStatus(jobId: string): Promise<string | null>;
  getQueueStats(): Promise<QueueStats>;
  empty(): Promise<void>;
  close(): Promise<void>;
}
```

### MedicalEvaluationPipeline

```typescript
class MedicalEvaluationPipeline {
  evaluate(trace: TraceContextData): Promise<ExtendedEvaluationResult>;
}
```

## 更新日志

- **2026-04-24**: 添加架构演进路线图引用，说明 Layer 3 当前限制和改进计划
- **2026-04-23**: 初始版本，支持 8 维度评估
- **2026-04-23**: 添加异步队列支持 (Bull + Redis)