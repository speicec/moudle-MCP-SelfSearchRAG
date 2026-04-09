## Why

现有RAG MCP Server只提供后端语义分块和检索能力，缺乏用户交互界面。用户无法直观管理文档、发起查询或观察pipeline执行过程。

核心问题：
1. **文档管理缺失**：无文档上传、列表、删除入口
2. **查询交互缺失**：无聊天UI进行检索问答
3. **执行透明度缺失**：pipeline处理过程不可见，用户无法了解分块、embedding、索引进度

这是用户交付完整体验的必要组成部分，单体部署避免前后端分离的运维复杂度。

## What Changes

### 新增功能
- React前端应用，提供三个核心界面：
  - **文档管理器**：上传、列表、删除文档
  - **聊天窗口**：检索问答交互界面
  - **Pipeline可视化器**：实时展示执行进度（分块→embedding→索引）
- WebSocket实时通信协议，推送pipeline执行事件
- Fastify HTTP服务器，提供文档上传API和WebSocket端点
- Zustand状态管理，统一管理前端状态
- 单体部署，前端bundle打包进后端服务

### 后端改造
- Harness pipeline增加事件发射机制（集成现有hooks）
- 新增HTTP路由模块（文档上传、文档列表、文档删除）
- 新增WebSocket处理模块（pipeline事件推送）

## Capabilities

### New Capabilities
- `frontend-ui`: React+TypeScript+Tailwind前端应用，包含DocumentManager、ChatWindow、PipelineVisualizer组件
- `websocket-protocol`: 双向通信协议定义，事件类型（stage:start/progress/complete, pipeline:complete），消息格式
- `document-management`: 文档上传、存储、列表、删除功能，文件系统存储或内存存储
- `chat-retrieval`: 查询输入→Small-to-Big检索→结果展示的完整流程

### Modified Capabilities
<!-- 无修改现有capability，前端是全新模块 -->
- 无

## Impact

### 新增文件
- `src/server/http-server.ts` - Fastify HTTP服务器
- `src/server/websocket-handler.ts` - WebSocket处理
- `src/server/routes/documents.ts` - 文档API路由
- `src/server/pipeline-emitter.ts` - Pipeline事件发射器
- `src/frontend/` - 整个前端目录（React组件、状态、样式）
- `src/main-server.ts` - 新入口点（HTTP+WebSocket服务）

### 依赖新增
- `fastify` - HTTP框架
- `@fastify/websocket` - WebSocket插件
- `react`, `react-dom` - 前端框架
- `zustand` - 状态管理
- `tailwindcss` - CSS框架
- `vite` - 前端构建工具

### 现有文件修改
- `src/core/harness.ts` - 增加事件发射接口
- `src/core/hooks.ts` - 增加WebSocket事件发射hook
- `package.json` - 新增依赖
- `tsconfig.json` - 前端编译配置