## Why

RAGAS 评估系统已完整实现（MedicalEvaluationPipeline、EvaluationQueue、EvaluationWorker、TraceStorage），但评估未在主查询流程中自动触发。用户每次发起 Agent 查询后，系统无法实时评估答案质量，评估结果只存储在数据库，不推送到前端 Dashboard，导致用户无法感知答案的可信度和风险等级。

**为什么现在做**：医疗场景中答案安全性和准确性是底线需求，实时评估能让用户立即看到风险警示，增强系统可信度。评估组件已稳定运行，集成时机成熟。

## What Changes

- **后端 http-server.ts**：初始化 AgentEvaluationService 并 decorate 到 fastify 实例
- **后端 chat.ts 路由**：在 `/generate` 端点 Agent 执行完成后异步提交评估任务
- **WebSocket 协议扩展**：新增 `evaluation:complete` 事件类型，推送评估分数和风险等级
- **前端 statsStore**：监听 WebSocket `evaluation:complete` 事件，调用 `handleEvaluationUpdate()` 更新 Dashboard
- **评估触发条件**：仅在 `enableAgent=true` 且有 Redis 时触发异步队列评估

## Capabilities

### New Capabilities

- `evaluation-auto-trigger`: 自动评估触发能力 - 在 Agent 查询完成后自动提交评估任务到 Bull 队列，不阻塞 HTTP 响应
- `evaluation-websocket-push`: 评估结果 WebSocket 推送能力 - 评估完成后广播 `evaluation:complete` 事件，包含 8 维度分数、层级分数、风险等级

### Modified Capabilities

- `websocket-protocol`: 扩展 WebSocket 事件类型，新增 `evaluation:complete` 事件定义
- `stats-dashboard`: 前端 Dashboard 支持实时接收评估更新，通过 WebSocket 推送而非仅 HTTP 轮询

## Impact

### 代码修改

| 文件 | 改动 |
|------|------|
| `src/server/http-server.ts` | 初始化 AgentEvaluationService，decorate 到 fastify |
| `src/server/routes/chat.ts` | 在 AgentResult 返回后调用 `evaluationService.submitFromAgentResult()` |
| `src/server/websocket-handler.ts` | 添加 `evaluation:complete` 事件广播方法 |
| `src/frontend/store/statsStore.ts` | 添加 WebSocket `evaluation:complete` 事件监听 |
| `src/frontend/hooks/useWebSocket.ts` | 处理 `evaluation:complete` 事件分发 |

### API 影响

- **新增 WebSocket 事件**：`evaluation:complete`（评估完成后推送）
- **新增环境变量依赖**：`REDIS_HOST`（可选，无 Redis 时仍可同步评估）

### 系统依赖

- Redis（可选）：用于 Bull 队列异步评估
- EvaluationWorker（需单独启动）：消费评估队列任务