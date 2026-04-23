## Why

前端 HTTP Chat 路径使用基础检索器（`SmallToBigRetriever`），无法获得 Medical Agent 的完整可视化数据（执行模式、实体识别、查询改写、模板匹配）。用户在 RetrievalFlow.tsx 中看不到 Agent 的决策过程，无法理解为什么选择 Planning/ReAct 模式、查询如何被优化、模板匹配结果等关键信息。

Medical Agent 已在后端 MCP Tool 路径实现了完整的可视化收集（`VisualizationCollector` 和 `TraceVisualizer`），但这些数据未传输到前端 UI。

## What Changes

### 核心集成
- HTTP Chat 路径集成 Medical Agent，替代基础 `SmallToBigRetriever`
- Agent 执行各阶段通过 WebSocket 实时发送可视化事件
- 前端 RetrievalFlow.tsx 展示完整的 Agent 可视化面板

### 新增 WebSocket 事件
- `agent:input` - 原始查询解析
- `agent:entities` - 实体识别结果（疾病、药物、指标）
- `agent:complexity` - 复杂度评估
- `agent:mode` - 执行模式选择（ReAct/Planning）
- `agent:query_rewrite` - 查询改写（优化查询、扩展词）
- `agent:template` - 模板匹配尝试记录
- `agent:dag` - DAG 结构（Planning 模式）
- `agent:execution` - 执行进度
- `agent:complete` - Agent 完成

### 前端展示新增
- 执行模式面板：显示 Planning/ReAct 及选择原因
- 实体识别面板：展示匹配的疾病、药物、指标及值
- 关键词匹配面板：显示禁忌/注意事项等关键词
- 查询改写面板：原始查询 → 优化查询，扩展词列表
- 执行路径面板：阶段流程图（Planning → Template → DAG）
- 模板匹配面板：所有尝试的模板及匹配结果
- DAG 结构面板：任务 DAG 图（Planning 模式）

## Capabilities

### New Capabilities
- `agent-visualization-events`: Agent 执行各阶段的 WebSocket 事件发送，包括实体识别、复杂度评估、模式选择、查询改写、模板匹配、DAG 结构
- `frontend-agent-visualization`: 前端 RetrievalFlow 组件展示完整 Agent 可视化面板

### Modified Capabilities
- `chat-generation`: HTTP Chat `/generate` 路径集成 Medical Agent，替代基础检索器
- `retrieval-flow`: 扩展 RetrievalFlow.tsx 展示 Agent 可视化数据（原有向量化/相似度搜索/父块展开流程保留）

## Impact

### 后端文件
- `src/server/types.ts` - 扩展 PipelineEventType 和 PipelineEvent 接口
- `src/server/agent-emitter.ts` - 新建 Agent WebSocket 事件发射器
- `src/server/routes/chat.ts` - 集成 Medical Agent，添加可视化回调
- `src/server/http-server.ts` - 初始化 LLMCaller 供 Agent 使用
- `src/medical/agent/AgentExecutor.ts` - 添加可视化回调支持（emit callback）
- `src/medical/agent/MedicalAgent.ts` - 添加 setVisualizationCallback 方法

### 前端文件
- `src/frontend/store/retrievalStore.ts` - 扩展状态字段和 actions
- `src/frontend/hooks/useWebSocket.ts` - 处理 agent:* 事件
- `src/frontend/components/RetrievalFlow.tsx` - 新增可视化面板组件
- `src/frontend/types/visualization.ts` - 新建类型定义（复用后端类型）

### 类型定义
- 复用 `src/medical/agent/RetrievalVisualization.ts` 类型
- 复用 `src/medical/agent/TraceVisualizer.ts` 类型