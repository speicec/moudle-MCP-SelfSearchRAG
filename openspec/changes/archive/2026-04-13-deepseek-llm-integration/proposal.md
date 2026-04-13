## Why

当前系统只有纯 RAG 检索功能，返回匹配的文档片段但没有 LLM 生成的回答。用户期望类似 DeepSeek 的完整聊天体验：
1. 独立的 Chat Tab（不是侧边栏嵌入式）
2. LLM 生成的智能回答
3. 思考链可视化（展示"正在分析"、"正在检索资料"、"正在思考"等过程）

这些问题导致用户体验不完整：检索结果只是原始文档片段，没有综合解释；聊天界面被压缩在侧边栏，交互空间受限。

## What Changes

### 前端 UI 重构
- **创建独立 Chat Tab**: 将 ChatWindow 从左侧面板移到主 Tab 区域，类似 DeepSeek 聊天界面布局
- **思考链可视化组件**: 新增 `ThinkingChainDisplay` 组件，展示 LLM 思考过程的实时动画
- **流式答案渲染**: 支持流式显示 LLM 生成的答案，类似 DeepSeek 的逐字显示效果

### 后端 LLM 集成
- **DeepSeek API 集成**: 创建 `LLMGenerationService` 调用 DeepSeek API，支持 `deepseek-reasoner` 模型的思考链功能
- **SSE 流式响应**: 实现 SSE (Server-Sent Events) 端点 `/api/chat/generate`，流式返回思考过程和答案
- **WebSocket 事件扩展**: 新增 `generation:start`、`generation:thinking`、`generation:answer`、`generation:complete` 事件

### RAG + LLM 流程整合
- **两阶段生成**: Phase 1 检索文档片段 → Phase 2 LLM 基于上下文生成回答
- **上下文拼接**: 将检索到的文档片段作为 LLM prompt 的参考资料部分
- **流式推送**: 后端接收 DeepSeek SSE → 通过 WebSocket 推送给前端

### **BREAKING** 变化
- `/api/chat/query` 响应格式变化：从纯检索结果变为包含 LLM 生成的回答
- `ChatWindow` 从侧边栏组件变为独立 Tab 组件

## Capabilities

### New Capabilities
- `llm-generation`: DeepSeek API 集成，支持流式响应和思考链提取
- `thinking-chain-display`: 思考链可视化 UI，展示分析、检索、思考三个阶段
- `chat-tab-interface`: 独立 Chat Tab 界面，DeepSeek 风格的完整聊天体验

### Modified Capabilities
- `chat-retrieval`: 扩展为 RAG + LLM 两阶段流程，检索结果作为 LLM prompt 上下文
- `websocket-protocol`: 新增生成阶段事件类型 (`generation:*`)

## Impact

### 前端文件
- `src/frontend/components/VisualApp.tsx` - 布局重构：Chat Tab 作为主 Tab
- `src/frontend/components/ChatWindow.tsx` - 重构为完整聊天界面，支持流式显示
- `src/frontend/components/ThinkingChainDisplay.tsx` - 新组件：思考链可视化
- `src/frontend/store/index.ts` - 扩展 ChatState，支持流式状态管理
- `src/frontend/hooks/useWebSocket.ts` - 扩展事件处理，支持生成事件

### 后端文件
- `src/server/routes/chat.ts` - 新增 SSE 端点 `/api/chat/generate`
- `src/server/services/LLMGenerationService.ts` - 新服务：DeepSeek API 集成
- `src/server/pipeline-emitter.ts` - 新增生成事件发射方法
- `src/server/types.ts` - 扩展事件类型定义

### 配置依赖
- 新增环境变量: `DEEPSEEK_API_KEY` - DeepSeek API 密钥
- 新增环境变量: `DEEPSEEK_BASE_URL` - API 端点 (默认 `https://api.deepseek.com`)
- 新增环境变量: `DEEPSEEK_MODEL` - 模型选择 (默认 `deepseek-reasoner`)