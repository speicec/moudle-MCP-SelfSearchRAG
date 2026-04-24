# Tasks: RAG Evaluation & Tracing System (扩展版)

## Phase 1: 核心追踪能力 (P0)

### 1.1 TraceContext (P0)

- [x] **创建 TraceContext 类**
  - 文件: `src/tracing/TraceContext.ts`
  - 定义 TraceContextData 接口
  - 实现查询、阶段、LLM调用、检索、答案的记录方法
  - 实现状态管理 (running → completed/failed)

- [x] **定义追踪类型**
  - 文件: `src/tracing/types.ts`
  - TraceSpan, RetrievedChunk, LLMCallRecord 接口
  - 导出所有追踪相关类型

- [x] **编写 TraceContext 测试**
  - 文件: `src/tracing/TraceContext.test.ts`

### 1.2 TraceStorage (P0)

- [x] **创建 TraceStorage 类**
  - 文件: `src/tracing/TraceStorage.ts`
  - SQLite schema 定义 (使用 sql.js)
  - saveTrace, saveEvaluation 实现
  - 查询方法实现 (getTrace, getRecentTraces, getEvaluationTrends)

- [x] **扩展 SQLite schema**
  - 新增 evaluations 表字段: medical_accuracy_score, safety_score 等
  - 新增 layer_scores 字段 (分层分数)
  - 新增 risk_level 字段

- [x] **编写 TraceStorage 测试**
  - 文件: `src/tracing/TraceStorage.test.ts`

- [x] **添加 SQLite 依赖**
  - `npm install sql.js` (纯 JS 实现，无需 Python 编译)

### 1.3 扩展 TraceVisualizer (P0)

- [x] **集成 TraceContext**
  - 文件: `src/medical/agent/TraceVisualizer.ts`
  - createTraceContext 方法
  - 同步阶段数据到 TraceContext

- [x] **更新 AgentExecutor**
  - 文件: `src/medical/agent/AgentExecutor.ts`
  - 在 execute 开始创建 TraceContext
  - initTraceStorage 方法
  - persistTrace 方法

### 1.4 包装 LLMCaller (P0)

- [x] **创建 TracedLLMCaller**
  - 文件: `src/config/llm-config.ts`
  - createTracedLLMCaller 函数
  - createTracedLLMCallerFactory 函数

---

## Phase 2: 医疗扩展评估 (P1)

### 2.1 MedicalEvaluationPipeline (P1)

- [x] **创建 MedicalEvaluationPipeline 类**
  - 文件: `src/evaluation/MedicalEvaluationPipeline.ts`
  - 整合 MedicalAccuracy, SafetyAssessment 评估
  - 权重配置支持

- [x] **定义扩展评估类型**
  - 文件: `src/evaluation/types.ts`
  - ExtendedEvaluationResult 接口
  - MedicalAccuracyResult, SafetyAssessmentResult 等
  - EvaluationWeights, DEFAULT_EVALUATION_CONFIG

### 2.2 Layer 1: 基础 RAGAS (P1)

- [x] **Faithfulness 评估**
  - extractClaims: 从答案提取声称
  - judgeClaimSupport: 判断声称是否被支持
  - 幻觉检测逻辑

- [x] **Context Relevance 评估**
  - judgeContextRelevance: chunk 相关性评分

- [x] **Answer Relevance 评估**
  - generateQuestionsFromAnswer
  - judgeQuestionSimilarity

### 2.3 Layer 2: 医疗核心评估 (P1)

- [x] **Medical Accuracy 评估**
  - 实现: MedicalEvaluationPipeline.evaluateMedicalAccuracy
  - 与医学词典验证
  - 指南符合度检查 (ADA/KDIGO/ESC/ATA)
  - 错误检测和纠正建议

- [x] **Safety Assessment 评估**
  - 实现: MedicalEvaluationPipeline.evaluateSafetyAssessment
  - 禁忌检测 (absolute/relative)
  - 相互作用检测
  - 危险建议检测
  - 分数计算

### 2.4 Layer 3: 医疗增强评估 (P1)

- [x] **Evidence Traceability 评估**
  - 实现: MedicalEvaluationPipeline.evaluateEvidenceTraceability
  - 来源标注检测 [指南名 年份]
  - 引用验证
  - citationAccuracy 计算

- [x] **Completeness 评估**
  - 实现: MedicalEvaluationPipeline.evaluateCompleteness
  - 实体覆盖检查
  - topicCoverage 计算

- [x] **Terminology Accuracy 评估**
  - 实现: MedicalEvaluationPipeline.evaluateTerminologyAccuracy
  - 术语词典匹配
  - 缩写解释检查

### 2.5 综合计算 (P1)

- [x] **权重计算**
  - calculateOverallScore: 加权平均
  - calculateLayerScores: 分层分数 (layer1/layer2/layer3)
  - determineRiskLevel: 风险等级 (safe/caution/warning/danger)

- [x] **编写扩展评估测试**
  - 文件: `src/evaluation/MedicalEvaluationPipeline.test.ts`
  - 评估测试已在之前的实现中完成

- [x] **Terminology Accuracy 评估**
  - 已在 MedicalEvaluationPipeline.evaluateTerminologyAccuracy 实现
  - 术语词典匹配
  - 缩写解释检查
  - 术语错误检测

---

## Phase 3: 异步执行架构 (Redis + Bull) (P1)

### 3.1 Redis + Bull 依赖 (P1)

- [x] **添加依赖**
  - `npm install bull ioredis @bull-board/api @bull-board/express`

- [x] **配置 Redis 连接**
  - 文件: `src/config/redis-config.ts`
  - RedisConfig 接口
  - 环境变量读取

- [x] **Docker Compose 配置**
  - 文件: `docker-compose.yml`
  - Redis 服务配置
  - Worker 服务配置

### 3.2 EvaluationQueue (P1)

- [x] **创建 EvaluationQueue 类**
  - 文件: `src/queue/EvaluationQueue.ts`
  - Bull Queue 创建
  - addJob, addBatch 方法
  - getJobStatus, getQueueStats 方法

- [x] **配置 Bull Job Options**
  - attempts: 3 (重试次数)
  - backoff: exponential (重试间隔递增)
  - removeOnComplete: true
  - priority 支持 (high/normal/low)

- [x] **事件监听**
  - onCompleted, onFailed, onProgress
  - 连接 ResultHandler

- [x] **编写 EvaluationQueue 测试**
  - 文件: `src/queue/EvaluationQueue.test.ts`

### 3.3 EvaluationWorker (P1)

- [x] **创建 EvaluationWorker 类**
  - 文件: `src/queue/EvaluationWorker.ts`
  - Bull Worker 创建
  - concurrency 配置

- [x] **实现 process 处理函数**
  - 执行 MedicalEvaluationPipeline.evaluate
  - job.updateProgress 进度更新
  - 错误处理 (Bull 自动重试)

- [x] **创建独立 Worker 进程**
  - 文件: `src/workers/evaluation-worker.ts`
  - SIGTERM/SIGINT 处理
  - npm run worker:evaluation 命令

- [x] **编写 EvaluationWorker 测试**
  - 文件: `src/queue/EvaluationWorker.test.ts`
  - 处理成功测试
  - 进度更新测试
  - 错误重试测试

### 3.4 Bull Board 监控 (P1)

- [x] **集成 Bull Board**
  - 文件: `src/server/bull-board.ts`
  - createBullBoard 配置
  - Express 路由 /admin/queues

- [x] **队列监控界面**
  - pending, active, completed, failed 状态
  - 任务详情查看
  - 手动重试/删除任务

### 3.5 与 MedicalAgent 集成 (P1)

- [x] **修改 MedicalAgent.execute**
  - 文件: `src/integration/AgentEvaluationService.ts`
  - 创建 EvaluationQueue 实例
  - 执行完成后 queue.addJob() (不阻塞)
  - 立即返回 AgentResult

- [x] **设置 ResultHandler**
  - onSuccess: TraceStorage.saveEvaluation
  - onError: 错误日志
  - onProgress: WebSocket 进度推送

- [x] **添加 getEvaluationStatus 方法**
  - 查询 Bull Job 状态

- [x] **添加 getQueueStats 方法**
  - 队列统计查询

### 3.6 编写集成测试 (P1)

- [x] **Agent 集成测试**
  - 文件: `src/integration/AgentEvaluationService.test.ts`
  - submitEvaluation 测试
  - 评估状态查询测试
  - 从 AgentResult 提交测试

---

## Phase 4: 指标聚合与可视化 (P2)

### 4.1 MetricsAggregator

- [x] **扩展 MetricsAggregator**
  - 文件: `src/tracing/MetricsAggregator.ts`
  - 新增 getEvaluationMetrics (包含医疗指标)
  - 新增 getRiskLevelDistribution
  - 新增 getComprehensiveMetrics
  - 新增 broadcastComprehensiveMetrics

### 4.2 StatsDashboard 扩展

- [x] **扩展 statsStore**
  - 文件: `src/frontend/store/statsStore.ts`
  - 新增 evaluationMetrics 字段
  - WebSocket 处理 'metrics:update'

- [x] **扩展 StatsDashboard 组件**
  - 文件: `src/frontend/components/StatsDashboard.tsx`
  - 医疗评估指标面板
  - 风险等级分布

- [x] **创建 EvaluationCard 组件**
  - 文件: `src/frontend/components/stats/EvaluationCard.tsx`
  - 8 维度分数显示
  - 分层分数显示
  - 风险等级指示

### 4.3 TraceExplorer UI

- [x] **创建 TraceExplorer 页面**
  - 文件: `src/frontend/components/TraceExplorer.tsx`
- [x] **创建 TraceDetail 组件**
  - 包含在 TraceExplorer.tsx 中
- [x] **创建 traceStore**
  - 文件: `src/frontend/store/traceStore.ts`

---

## Phase 5: OpenTelemetry (可选 P3)

- [x] **创建 TraceExporter**
  - 文件: `src/tracing/TraceExporter.ts`
  - 导出为 OTLP 格式
  - 推送到 collector
  - 批量导出支持

---

## Phase 6: 文档和部署

- [x] **部署配置**
  - docker-compose.yml Redis 服务
  - docker-compose.yml evaluation-worker 服务
  - package.json worker:evaluation 命令

- [x] **更新 docs/medical-agent-guide.md**
  - 文件: `docs/medical-agent-guide.md`
  - 添加 RAG 评估体系章节
- [x] **创建 docs/rag-evaluation-guide.md**
  - 文件: `docs/rag-evaluation-guide.md`
  - 评估体系架构和使用方法

---

## 任务依赖关系

```
Phase 1.1-1.4 (核心追踪) ─────────────────────────────────────┐
                                                              │
                                                              ▼
                           MedicalAgent 集成 (追踪部分)         │
                                                              │
                                                              ▼
Phase 2.1-2.5 (医疗扩展评估) ─────────────────────────────────┤
                                                              │
                                                              ▼
Phase 3.1 (Redis + Bull 依赖)                                │
    │                                                         │
    ├─────────────────────────────────────────────────────▶   │
    │                                                         │
Phase 3.2-3.3 (EvaluationQueue + EvaluationWorker)           │
    │                                                         │
    ├─────────────────────────────────────────────────────▶   │
    │                                                         │
Phase 3.4 (Bull Board 监控)                                   │
    │                                                         │
    ├─────────────────────────────────────────────────────▶   │
    │                                                         │
Phase 3.5-3.6 (Agent 集成)                                    │
                                                              │
                                                              ▼
Phase 4 (可视化) ────────────────────────────────────────────┘
                                                              │
                                                              ▼
Phase 5 (OpenTelemetry, 可选)
```

---

## 验收标准

### Phase 1-3 完成标准 (核心功能)

1. TraceContext 可正确记录所有阶段
2. TraceStorage 可持久化扩展的评估数据
3. MedicalEvaluationPipeline 可评估 8 个维度
4. EvaluationQueue.addJob 不阻塞，提交 < 50ms
5. EvaluationWorker 可处理任务，支持重试
6. Bull Board 可监控队列状态
7. MedicalAgent.execute 不被评估阻塞 (返回 < 6s)

### Phase 4 完成标准 (可视化)

1. StatsDashboard 显示 8 维度评估指标
2. TraceExplorer 可查询历史追踪和评估结果
3. WebSocket 实时推送评估进度和结果

---

## 关键指标

| 指标 | 目标 | 验证方法 |
|------|------|----------|
| 追踪提交延迟 | < 10ms | TraceStorage.saveTrace() |
| 任务添加延迟 | < 50ms | EvaluationQueue.addJob() |
| Agent 不阻塞 | 返回 < 6s | MedicalAgent.execute() |
| Worker 处理吞吐 | > 10 tasks/min | Bull Queue stats |
| 重试成功率 | > 80% | 重试后完成率 |
| Faithfulness 准确度 | > 0.7 | 人工标注对比 |
| Safety 检测率 | > 95% | 禁忌测试集 |
| 风险等级准确性 | > 90% | 风险案例测试 |

---

## Redis + Bull 架构优势

| 特性 | Worker Threads | Redis + Bull |
|------|----------------|--------------|
| 任务持久化 | ✗ 进程重启丢失 | ✓ Redis 存储 |
| 分布式支持 | ✗ 单节点 | ✓ 多 Worker 进程 |
| 监控界面 | ✗ 无 | ✓ Bull Board |
| 重试机制 | 手动实现 | ✓ 内置 |
| 优先级队列 | 手动实现 | ✓ 内置 |
| 进度跟踪 | 手动实现 | ✓ job.progress |
| 延迟任务 | ✗ 无 | ✓ 内置 |
| 外部依赖 | ✓ 无 | ✗ 需要 Redis |

---

## 部署配置

### Docker Compose

```yaml
services:
  redis:
    image: redis:7-alpine
    
  app:
    environment:
      - REDIS_HOST=redis
      
  evaluation-worker:
    command: npm run worker:evaluation
    deploy:
      replicas: 2  # 可扩展
```

### 环境变量

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
EVALUATION_CONCURRENCY=2
EVALUATION_ATTEMPTS=3
```