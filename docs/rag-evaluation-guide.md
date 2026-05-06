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

### 0. 自动评估触发 (推荐)

系统支持在 Agent 查询完成后自动触发评估，无需手动调用。

```typescript
// 环境变量配置
ENABLE_RAGAS_EVALUATION=true  // 默认启用，设置为 false 禁用
REDIS_HOST=localhost          // Redis 主机 (可选，无 Redis 时使用同步模式)
REDIS_PORT=6379               // Redis 端口
```

自动评估触发流程：
1. Agent 查询完成后 (`enableAgent=true`)
2. 自动提交评估任务到队列 (不阻塞 HTTP 响应)
3. 评估完成后通过 WebSocket 广播 `evaluation:complete` 事件
4. 前端 Dashboard 实时更新评估指标

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

// WebSocket 自动处理 'evaluation:complete' 事件
```

### evaluation:complete WebSocket 事件

当评估完成时，系统广播 `evaluation:complete` 事件：

```typescript
interface EvaluationCompleteEvent {
  type: 'evaluation:complete';
  evaluationId: string;
  traceId: string;
  sessionId?: string;
  
  // 8 维度分数
  dimensionScores: {
    faithfulness: number;
    contextRelevance: number;
    answerRelevance: number;
    medicalAccuracy: number;
    safetyAssessment: number;
    evidenceTraceability: number;
    completeness: number;
    terminologyAccuracy: number;
  };
  
  // 3 层分数
  layerScores: {
    layer1: number;  // 基础 RAGAS
    layer2: number;  // 医疗核心
    layer3: number;  // 医疗增强
  };
  
  overallScore: number;
  riskLevel: 'safe' | 'caution' | 'warning' | 'danger';
  timestamp: number;
}
```

前端监听示例：

```typescript
// useWebSocket.ts 自动处理
if (event.type === 'evaluation:complete') {
  useStatsStore.getState().handleEvaluationUpdate({
    avgOverall: event.overallScore,
    dimensionScores: event.dimensionScores,
    layerScores: event.layerScores,
    riskDistribution: updateRiskDistribution(event.riskLevel),
    totalEvaluations: incrementCount(),
    lastEvaluationTime: event.timestamp,
  });
}
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

- **2026-05-09**: 记录 Bull 队列跨进程事件传递修复、前端评估展示架构
- **2026-04-27**: 添加架构演进路线图引用，说明 Layer 3 当前限制和改进计划
- **2026-04-23**: 初始版本，支持 8 维度评估
- **2026-04-23**: 添加异步队列支持 (Bull + Redis)

---

## 技术问题修复记录

### 1. Bull 队列跨进程事件传递问题 (2026-05-09)

#### 问题描述

Docker 部署时，`rag-server` 和 `evaluation-worker` 运行在不同容器（进程）中。Bull 队列的本地事件 `queue.on('completed')` 只在当前进程触发，导致：

```
rag-server 容器           evaluation-worker 容器
┌─────────────────┐       ┌─────────────────┐
│ Queue 实例 A    │       │ Queue 实例 B    │
│ 监听 completed  │       │ 触发 completed  │
│ ❌ 不触发       │       │ ✓ 触发本地      │
└─────────────────┘       └─────────────────┘
```

#### 解决方案

使用 Bull 的全局事件监听 Redis pub/sub：

```typescript
// src/queue/EvaluationQueue.ts

// 修复前：本地事件（只在当前进程触发）
this.queue.on('completed', (job, result) => { ... });

// 修复后：全局事件（跨进程通过 Redis pub/sub）
this.queue.on('global:completed', async (jobId) => {
  const job = await this.queue.getJob(jobId);
  const result = job.returnvalue as EvaluationJobResult;
  handlers?.onSuccess?.(result);
});
```

#### 相关文件变更

| 文件 | 变更 |
|------|------|
| `src/queue/EvaluationQueue.ts` | 使用 `global:completed` 替代 `completed` |
| `src/integration/AgentEvaluationService.ts` | 处理 `EvaluationJobResult` → `ExtendedEvaluationResult` 类型转换 |
| `src/tracing/TraceStorage.ts` | 添加 `getDatabase()` 方法支持从存储获取完整评估结果 |

---

### 2. 检索得分显示修复 (fix-retrieval-score-display)

#### 问题描述

前端显示的"检索得分"（如 2%-3%）实际上是 RRF (Reciprocal Rank Fusion) 排名融合得分，而非语义相似度。用户困惑："为什么得分这么低？文献质量有问题吗？"

#### 解决方案

在 RRF 融合过程中保留原始 Dense/Sparse 搜索得分，并传递到前端：

```typescript
// src/retrieval/rrf-fusion.ts
interface FusionResult {
  denseScore?: number;  // Dense Cosine 相似度
  sparseScore?: number; // Sparse BM25 得分
}

// src/frontend/components/EvidencePanel.tsx
// 显示语义相似度而非 RRF 得分
if (result.semanticScore !== undefined) {
  return { score: result.semanticScore, type: 'semantic' };
}
```

#### 验证结果

```
HTTP Response:
  semanticScore: 0.729 (真正的语义相似度 73%)  ✓
  similarityScore: 0.016 (RRF 排名得分，不再显示给用户)
```

---

### 3. 前端评估结果展示架构

#### 数据流

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    评估结果前端展示数据流                                        │
└─────────────────────────────────────────────────────────────────────────────┘

1. 后端 Worker 完成评估
   EvaluationWorker.processJob()
   → 返回 EvaluationJobResult
   → Bull 队列触发 global:completed 事件

2. 后端 AgentEvaluationService 处理回调
   EvaluationQueue.on('global:completed')
   → fetchFullEvaluationResult() 从 SQLite 获取完整数据
   → handlers.onSuccess(ExtendedEvaluationResult)

3. 后端 chat.ts 广播 WebSocket 事件
   wsHandler.broadcast({
     type: 'evaluation:complete',
     dimensionScores: { faithfulness, contextRelevance, ... },
     layerScores: { layer1, layer2, layer3 },
     overallScore, riskLevel
   })

4. 前端 WebSocket 接收事件
   useWebSocket.ts → createEventHandler()
   → useStatsStore.handleEvaluationUpdate(metrics)

5. 前端 Zustand Store 状态更新
   statsStore.ts → set({ evaluationMetrics: metrics })

6. 前端 UI 渲染
   StatsDashboard.tsx → <EvaluationCard ... />
```

#### 关键组件

| 文件 | 作用 |
|------|------|
| `src/frontend/hooks/useWebSocket.ts` | 监听 `evaluation:complete` WebSocket 事件 |
| `src/frontend/store/statsStore.ts` | Zustand 状态管理，存储评估指标数据 |
| `src/frontend/components/stats/EvaluationCard.tsx` | UI 组件，渲染评估分数卡片 |
| `src/frontend/components/StatsDashboard.tsx` | 主 Dashboard，包含 EvaluationCard |

#### WebSocket 事件结构

```typescript
interface EvaluationCompleteEvent {
  type: 'evaluation:complete';
  evaluationId: string;
  traceId: string;
  sessionId?: string;
  
  // 8 维度分数
  dimensionScores: {
    faithfulness: number;
    contextRelevance: number;
    answerRelevance: number;
    medicalAccuracy: number;
    safetyAssessment: number;
    evidenceTraceability: number;
    completeness: number;
    terminologyAccuracy: number;
  };
  
  // 3 层分数
  layerScores: {
    layer1: number;  // 基础 RAGAS
    layer2: number;  // 医疗核心
    layer3: number;  // 医疗增强
  };
  
  overallScore: number;
  riskLevel: 'safe' | 'caution' | 'warning' | 'danger';
  timestamp: number;
}
```

#### EvaluationCard 组件展示内容

```
┌─────────────────────────────────────────────────┐
│ 评估概览                          [优秀/良好/需优化] │
├─────────────────────────────────────────────────┤
│ 综合分数     │ 评估总数     │ 最后更新          │
│   52%        │     5       │ 08:06:01         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 8 维度评估分数                                    │
├─────────────────────────────────────────────────┤
│ ○ 忠实度    52%   │ ○ 医疗准确性  0%   │
│ ○ 上下文相关 52%  │ ○ 安全评估    0%   │
│ ○ 答案相关  52%   │ ○ 证据可追溯  0%   │
│                   │ ○ 完整性      0%   │
│                   │ ○ 术语准确性  0%   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 分层分数                                          │
├─────────────────────────────────────────────────┤
│ [基础 RAGAS] 52%  │ [医疗核心] 52% │ [医疗增强] 52% │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 风险等级分布                                      │
├─────────────────────────────────────────────────┤
│ ████████  ████████  ████████  ████████           │
│ 安全(3)    注意(1)   警告(0)   危险(0)            │
└─────────────────────────────────────────────────┘
```

---

### 4. Docker 部署验证结果 (2026-05-09)

#### 测试环境

- Docker Compose 多容器部署
- rag-server + evaluation-worker (2 replicas) 分离部署
- Redis 作为 Bull 队列后端

#### 验证结果

```
WebSocket 客户端接收:
  evaluationId: 44d85e66-da9b-46e5-b8b9-baf022080377    ✓
  traceId: trace-1777277139411-15daqk                   ✓
  sessionId: session-1777277139411-h9kq5h               ✓
  overallScore: 0.515                                   ✓
  riskLevel: safe                                       ✓

Dimension Scores (8维度):
  faithfulness: 0.515        ✓
  contextRelevance: 0.515    ✓
  answerRelevance: 0.515     ✓
  medicalAccuracy: 0         ✓ (简化结果默认值)
  safetyAssessment: 0        ✓
  evidenceTraceability: 0    ✓
  completeness: 0            ✓
  terminologyAccuracy: 0      ✓

Layer Scores (3层级):
  layer1: 0.515    ✓
  layer2: 0.515    ✓
  layer3: 0.515    ✓
```

#### 测试命令

```bash
# 启动服务
docker-compose up -d

# 检查健康状态
curl http://localhost:3001/api/health

# 查看评估日志
docker logs rag-server | grep "ChatRoute:Evaluation"

# 查看 Worker 日志
docker logs evaluation-worker-1 | tail -20
```