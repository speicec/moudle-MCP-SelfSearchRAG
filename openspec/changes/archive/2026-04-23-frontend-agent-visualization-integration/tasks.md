## 1. 后端基础设施

- [x] 1.1 扩展 PipelineEventType - 在 `src/server/types.ts` 添加 `agent:*` 事件类型
- [x] 1.2 扩展 PipelineEvent 接口 - 添加 visualization 和 executionTrace 字段
- [x] 1.3 创建 AgentEmitter 类 - 新建 `src/server/agent-emitter.ts`，实现各阶段 emit 方法

## 2. Agent 可视化回调集成

- [x] 2.1 AgentExecutor 添加回调支持 - 在 `src/medical/agent/AgentExecutor.ts` 添加 visualizationCallback 属性和 setVisualizationCallback 方法
- [x] 2.2 MedicalAgent 添加回调方法 - 在 `src/medical/agent/MedicalAgent.ts` 添加 setVisualizationCallback 方法传递给 Executor
- [x] 2.3 各阶段调用回调 - 在 AgentExecutor.run() 各阶段调用 visualizationCallback

## 3. HTTP Chat 路径集成 Agent

- [x] 3.1 创建 LLMCaller 适配器 - 在 `src/server/http-server.ts` 创建 LLMCaller 供 Agent 使用
- [x] 3.2 修改 chat.ts /generate 路径 - 在 `src/server/routes/chat.ts` 添加 Medical Agent 集成逻辑
- [x] 3.3 创建 AgentEmitter 实例 - 在 /generate 路径创建 AgentEmitter 并注册回调
- [x] 3.4 添加 enableAgent 配置开关 - 支持禁用 Agent 回退到基础检索
- [x] 3.5 使用 Agent 结果生成回答 - 将 AgentResult 用于最终生成输出

## 4. 前端类型定义

- [x] 4.1 创建 visualization.ts 类型文件 - 在 `src/frontend/types/visualization.ts` 定义 Agent 可视化类型
- [x] 4.2 复用后端类型定义 - 导入或复用 RetrievalVisualization 和 ExecutionTrace 类型

## 5. 前端 Store 扩展

- [x] 5.1 扩展 retrievalStore 状态 - 添加 visualization、executionTrace、entityMatches 等字段
- [x] 5.2 添加 Agent 事件 handlers - 实现 handleAgentInput、handleAgentEntities、handleAgentMode 等 actions
- [x] 5.3 更新 reset action - 清空新增的 Agent 状态字段

## 6. 前端 WebSocket 处理

- [x] 6.1 扩展 useWebSocket.ts - 在 createEventHandler 中添加 agent:* 事件处理
- [x] 6.2 连接事件到 Store - 每个 agent:* 事件调用对应的 retrievalStore action

## 7. RetrievalFlow 组件扩展

- [x] 7.1 创建执行模式面板 - 显示 Planning/ReAct 模式及选择原因
- [x] 7.2 创建实体识别面板 - 显示疾病、药物、指标匹配结果
- [x] 7.3 创建关键词匹配面板 - 显示禁忌/注意事项关键词
- [x] 7.4 创建查询改写面板 - 显示原始查询 vs 优化查询对比
- [x] 7.5 创建执行路径面板 - 显示阶段流程图
- [x] 7.6 创建模板匹配面板 - 显示所有模板尝试及结果
- [x] 7.7 创建 DAG 结构面板 - Planning 模式下显示任务 DAG
- [x] 7.8 保留原有检索步骤 - 确保向量化/相似度搜索/父块展开步骤正常显示
- [x] 7.9 添加响应式布局 - 适配不同屏幕尺寸

## 8. 测试与验证

- [x] 8.1 后端单元测试 - 测试 AgentEmitter 各 emit 方法
- [x] 8.2 AgentExecutor 回调测试 - 验证回调在各阶段被正确调用
- [ ] 8.3 chat 路径集成测试 - 验证 HTTP 路径正确使用 Agent 和发送事件
- [ ] 8.4 前端事件处理测试 - 验证 WebSocket 事件正确更新 Store
- [ ] 8.5 UI 验证 - 手动测试 RetrievalFlow 各面板渲染和数据更新

## 9. 文档更新

- [x] 9.1 更新 medical-agent-guide.md - 添加 HTTP Chat 路径集成说明
- [x] 9.2 添加 WebSocket 事件文档 - 记录新增的 agent:* 事件格式