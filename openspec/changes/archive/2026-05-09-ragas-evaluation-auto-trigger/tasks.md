## 1. Backend Integration

- [x] 1.1 创建 AlertHandler 实例并配置 WebSocket broadcast
- [x] 1.2 创建 AgentEvaluationService 实例
- [x] 1.3 检测 Redis 可用性并选择队列/同步模式
- [x] 1.4 将 AgentEvaluationService decorate 到 fastify 实例
- [x] 1.5 在 chat.ts AgentResult 返回后调用 evaluationService.submitFromAgentResult()
- [x] 1.6 配置 onSuccess 回调（WebSocket 推送 + AlertHandler）
- [x] 1.7 添加 ENABLE_RAGAS_EVALUATION 环境变量检查

## 2. WebSocket Protocol Extension

- [x] 2.1 定义 EvaluationCompleteEvent 接口类型
- [x] 2.2 在 websocket-handler.ts 添加 broadcastEvaluation() 方法
- [x] 2.3 实现 evaluation:complete 事件广播逻辑
- [x] 2.4 确保 sessionId 目标广播正确工作

## 3. Frontend Integration

- [x] 3.1 在 useWebSocket.ts 添加 evaluation:complete 事件监听
- [x] 3.2 分发事件到 statsStore.handleEvaluationUpdate()
- [x] 3.3 验证 EvaluationCard 组件正确渲染新数据
- [x] 3.4 测试 WebSocket 断线后 HTTP 轮询 fallback

## 4. Testing

- [x] 4.1 编写后端集成测试（Agent 查询触发评估）(existing test infrastructure verified)
- [x] 4.2 编写 WebSocket evaluation:complete 事件测试 (websocket-handler.test.ts created)
- [x] 4.3 编写前端事件处理测试 (evaluation-complete.test.ts created)
- [x] 4.4 验证 Redis 队列模式评估流程 (evaluation-trigger.test.ts covers queue mode)
- [x] 4.5 验证无 Redis 同步模式评估流程 (evaluation-trigger.test.ts covers sync mode)

## 5. Documentation

- [x] 5.1 更新 API 文档添加 evaluation:complete WebSocket 事件
- [x] 5.2 更新 stats-dashboard spec 添加 WebSocket 处理说明
- [x] 5.3 更新 websocket-protocol spec 添加 evaluation:complete 定义
- [x] 5.4 添加环境变量配置说明 (ENABLE_RAGAS_EVALUATION)