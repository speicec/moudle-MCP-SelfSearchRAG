## Context

### Background

系统已完成 RAGAS 医疗评估体系的完整实现：
- `MedicalEvaluationPipeline`：8 维度评估（Faithfulness、ContextRelevance、AnswerRelevance、MedicalAccuracy、SafetyAssessment、EvidenceTraceability、Completeness、TerminologyAccuracy）
- `EvaluationQueue`：Bull Redis 队列，异步评估任务管理
- `EvaluationWorker`：队列消费者，执行评估 Pipeline
- `AgentEvaluationService`：评估服务集成层
- `TraceStorage`：SQLite 持久化追踪和评估结果
- `AlertHandler`：评估异常告警触发

但评估未集成到主查询流程，所有组件处于"被动调用"状态。

### Current State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    当前查询流程（无评估）                                      │
└─────────────────────────────────────────────────────────────────────────────┘

POST /api/chat/generate (enableAgent=true)
         │
         ▼
    MedicalAgent.run()
         │
         ▼
    AgentExecutor → AgentResult
         │
         ▼
    LLMGenerationService → answer
         │
         ▼
    return response
         │
         ▼
    ❌ 评估未触发

───────────────────────────────────────────────────────────────────────────────
已存在但未集成的组件：
───────────────────────────────────────────────────────────────────────────────

AgentEvaluationService  → 初始化但未 decorate 到 fastify
EvaluationQueue         → 需 Redis，队列未在 http-server 启动
EvaluationWorker        → 需单独启动进程
TraceStorage            → 已初始化在 http-server.ts
AlertHandler            → 需要创建并配置 WebSocket broadcast
```

### Stakeholders

- **后端**：http-server.ts（初始化）、chat.ts（触发评估）、websocket-handler.ts（广播）
- **前端**：statsStore.ts（接收事件）、useWebSocket.ts（事件分发）
- **运维**：Redis（队列）、EvaluationWorker（独立进程）

### Constraints

1. 评估不能阻塞 HTTP 响应（必须异步）
2. 无 Redis 时仍需支持评估（同步模式 fallback）
3. 前端 Dashboard 需实时更新（WebSocket 推送）
4. 评估失败不影响主流程（仅日志告警）

## Goals / Non-Goals

**Goals:**

1. 每次 Agent 查询后自动触发 RAGAS 评估
2. 评估结果通过 WebSocket 推送到前端 Dashboard
3. 有 Redis 时使用队列异步评估（高吞吐）
4. 无 Redis 时使用同步评估（不阻塞响应）
5. 前端实时显示评估分数和风险等级

**Non-Goals:**

1. 不修改评估 Pipeline 本身（MedicalEvaluationPipeline 保持不变）
2. 不添加新的评估维度（维持现有 8 维度）
3. 不修改 Agent 执行逻辑（仅在结果产出后触发评估）
4. 不实现评估结果持久化到聊天历史（评估结果存 TraceStorage）
5. 不实现用户配置评估参数（使用默认配置）

## Decisions

### Decision 1: 评估触发位置

**问题**：评估应该在哪里触发？

**选项对比**：

| 方案 | 位置 | 优点 | 缺点 |
|------|------|------|------|
| A | AgentExecutor.buildResult() 后 | 与 Agent 紧耦合，数据完整 | AgentExecutor 变重 |
| B | chat.ts 路由返回前 | 控制灵活，不修改核心 | 职责分散到路由 |
| C | WebSocket hook 全局拦截 | 全局覆盖 | 过度评估健康检查等 |

**选择**：**方案 B — chat.ts 路由层**

**理由**：
- AgentExecutor 保持纯粹，不引入评估依赖
- 可控制触发条件（仅 enableAgent=true）
- 可访问 sessionId 用于 WebSocket 推送
- 失败时仅日志告警，不影响响应

---

### Decision 2: 评估执行模式

**问题**：有 Redis 时使用队列，无 Redis 时如何处理？

**选项对比**：

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| A | 仅队列模式 | 高吞吐、可扩展 | 无 Redis 时无法评估 |
| B | 队列 + 同步 fallback | 覆盖全场景 | 同步模式增加响应时间 |
| C | 队列 + 后台直接调用 | 不阻塞响应 | 无重试机制 |

**选择**：**方案 C — 队列 + 后台直接调用**

**实现**：

```typescript
// http-server.ts 初始化
if (isRedisAvailable()) {
  evaluationService = createAgentEvaluationService({ enableQueue: true });
} else {
  evaluationService = createAgentEvaluationService({ enableQueue: false });
}

// chat.ts 触发（两种模式都不阻塞响应）
evaluationService.submitFromAgentResult(agentResult, query, sessionId, {
  onSuccess: (result) => wsHandler.broadcast({ type: 'evaluation:complete', ... }),
}).catch(err => console.warn('Evaluation failed:', err));
```

**理由**：
- 有 Redis → Bull 队列异步处理，有重试
- 无 Redis → 后台直接调用 Pipeline，仍不阻塞（Promise 不 await）
- 两种模式都立即返回 HTTP 响应

---

### Decision 3: WebSocket 事件结构

**问题**：`evaluation:complete` 事件应包含什么数据？

**选择**：

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

**理由**：
- 前端 statsStore 已定义 `EvaluationMetrics` 类型，结构兼容
- 包含 traceId 可追溯查询来源
- 不包含 details/verdicts 等大数据（前端 Dashboard 不需要）

---

### Decision 4: 前端事件处理

**问题**：前端如何接收并更新 Dashboard？

**选择**：在 WebSocket handler 添加 evaluation:complete 分发

```typescript
// useWebSocket.ts 或 WebSocket handler
case 'evaluation:complete':
  useStatsStore.getState().handleEvaluationUpdate({
    avgOverall: event.overallScore,
    dimensionScores: event.dimensionScores,
    layerScores: event.layerScores,
    riskDistribution: updateRiskDistribution(event.riskLevel),
    totalEvaluations: incrementCount(),
    lastEvaluationTime: event.timestamp,
  });
  break;
```

**理由**：
- statsStore 已有 `handleEvaluationUpdate()` 方法
- 不修改 statsStore 核心逻辑，仅添加事件监听

---

### Decision 5: 告警集成

**问题**：评估异常如何触发告警？

**选择**：在 AgentEvaluationService.onSuccess 中调用 AlertHandler

```typescript
// AgentEvaluationService.submitFromAgentResult()
onSuccess: (result) => {
  // 1. WebSocket 推送
  wsHandler.broadcast({ type: 'evaluation:complete', ... });
  
  // 2. 告警检查
  alertHandler.checkAndAlert({
    traceId: result.traceId,
    evaluationId: result.evaluationId,
    metrics: result.metrics,
    extendedMetrics: result.extendedMetrics,
  });
}
```

**触发条件**：
- `safetyAssessment < 0.5` → SAFETY_CRITICAL 告警
- `faithfulness < 0.5` → FAITHFULNESS_LOW 告警
- `medicalAccuracy < 0.6` → MEDICAL_ACCURACY 告警

**理由**：
- AlertHandler 已实现完整告警逻辑
- 评估完成后立即检查，无需额外轮询

## Risks / Trade-offs

### Risk 1: 评估失败导致告警丢失

**影响**：评估 Pipeline 异常时无告警触发
**缓解**：EvaluationWorker 有 3 次重试；失败后记录日志，可手动触发评估

### Risk 2: 无 Redis 时评估无重试

**影响**：同步模式下评估失败无法自动重试
**缓解**：评估失败记录到 TraceStorage，可手动触发重新评估

### Risk 3: WebSocket 连接断开丢失推送

**影响**：用户看不到实时评估结果
**缓解**：Dashboard 有 HTTP 轮询机制（每 10 秒 fetchStats），断线重连后可获取历史评估

### Risk 4: 高频查询导致评估队列积压

**影响**：评估任务超过 Worker 处理能力
**缓解**：
- Bull 队列有 rate limiter（每分钟最多 10 任务）
- EvaluationWorker concurrency 可动态调整
- Dashboard 显示队列健康状态

### Trade-off 1: 评估不阻塞响应 vs 结果延迟

**选择**：评估异步执行，用户先收到答案
**后果**：用户看到答案后约 3-5 秒才看到评估分数
**接受**：医疗场景中答案即时性更重要，评估分数是补充信息

### Trade-off 2: 事件驱动 vs HTTP 轮询

**选择**：WebSocket 推送 + HTTP 轮询 fallback
**后果**：前端维护两种更新机制
**接受**：保障断线重连后数据完整性

## Migration Plan

### Phase 1: 后端集成

1. **修改 http-server.ts**：
   - 创建 AlertHandler 并配置 WebSocket broadcast
   - 创建 AgentEvaluationService 并 decorate 到 fastify
   - 根据 Redis 可用性选择队列/同步模式

2. **修改 chat.ts**：
   - 在 AgentResult 返回后调用 `evaluationService.submitFromAgentResult()`
   - 配置 onSuccess 回调（WebSocket 推送 + AlertHandler）

3. **修改 websocket-handler.ts**：
   - 添加 `broadcastEvaluation()` 方法
   - 定义 `evaluation:complete` 事件结构

### Phase 2: 前端集成

1. **修改 useWebSocket.ts**：
   - 添加 `evaluation:complete` 事件监听
   - 分发到 statsStore.handleEvaluationUpdate()

2. **验证 statsStore**：
   - 确认 `handleEvaluationUpdate()` 正确更新 state
   - 确认 EvaluationCard 组件正确渲染新数据

### Phase 3: 运维配置

1. **启动 Redis**（可选）：`docker run -d redis`
2. **启动 EvaluationWorker**：`npm run worker:evaluation`
3. **验证队列健康**：`GET /api/queue/health`

### Rollback Strategy

各阶段独立，可单独禁用：

| 阶段 | 禁用方式 |
|------|---------|
| Phase 1 | 移除 `evaluationService.submitFromAgentResult()` 调用 |
| Phase 2 | 移除 WebSocket `evaluation:complete` 监听 |
| Phase 3 | 停止 EvaluationWorker 进程 |

**环境变量开关**：`ENABLE_RAGAS_EVALUATION=false` 可全局禁用评估触发

## Open Questions

1. **是否需要评估结果持久化到聊天历史？**
   - 当前评估存 TraceStorage，不关联 chatHistory
   - 后续可扩展：在 ChatQueryResponse 中添加 evaluationSummary 字段

2. **是否需要用户可配置评估参数？**
   - 当前使用默认配置（8 维度权重固定）
   - 后续可扩展：通过 `/api/chat/config` API 调整权重

3. **是否需要评估结果缓存？**
   - 相同查询重复评估浪费资源
   - 可考虑：基于 query embedding 缓存评估结果（24 小时 TTL）