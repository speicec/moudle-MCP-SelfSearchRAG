## Why

查询功能完全失效：前端 Web UI 和 MCP Server 都无法返回查询结果。经诊断发现三个层面的问题：
1. 前端代码 Bug - QuickQuery 使用错误的 store
2. 前端 UI 缺失 - 缺少真正的聊天对话界面
3. MCP 架构断裂 - MCP Server 使用空的 VectorStore

这些问题导致用户无法使用核心的 RAG 查询功能，需要立即修复。

## What Changes

### 前端修复
- **修复 QuickQuery store Bug**: `VisualApp.tsx` 中 QuickQuery 应使用 `useChatStore`（有 `submitQuery` 方法），而非 `useDocumentStore`（无该方法）
- **集成 ChatWindow 组件**: 将 `ChatWindow.tsx` 组件集成到主界面，提供完整的聊天对话 UI
- **改造左侧面板**: 将 QuickQuery 输入框替换为嵌入式聊天窗口，支持多轮对话和历史记录

### MCP Server 修复
- **统一数据存储**: 让 MCP Server 的查询工具使用 `HierarchicalStore`（已有数据），而非独立的空 `InMemoryVectorStore`
- **创建统一的 RetrievalService**: 基于 `HierarchicalStore` 创建 `SmallToBigRetriever`，与 HTTP Server 共享同一数据源

### **BREAKING** 变化
- MCP `query` 工具返回格式将变化：从 VectorStore 格式变为 HierarchicalStore 的 Small-to-Big 格式（包含 `parentChunkContent`、`contextWindow` 等）

## Capabilities

### New Capabilities
- `chat-query-interface`: 前端聊天式查询 UI，支持多轮对话、结果展示、历史记录

### Modified Capabilities
- `mcp-query-tool`: MCP 查询工具返回格式变化，使用 HierarchicalStore 数据源

## Impact

### 前端文件
- `src/frontend/components/VisualApp.tsx` - 主要修改：store 引用、布局重构
- `src/frontend/components/ChatWindow.tsx` - 已存在，需集成
- `src/frontend/store/index.ts` - 已有正确的 `useChatStore`

### 后端文件
- `src/app.ts` - MCP Server 初始化逻辑，需注入 HierarchicalStore
- `src/mcp/handlers.ts` - MCP 工具处理器，需使用新的 RetrievalService
- `src/server/http-server.ts` - HTTP Server 已正确使用 HierarchicalStore ✅

### 数据存储
- `data/store/hierarchical-store.json` - 已有数据（189 small chunks, 165 parent chunks）
- `InMemoryVectorStore` - MCP 中不再使用，移除或保留作为备用

### API 影响
- `/api/chat/query` - 无变化，已正常工作 ✅
- MCP `query` 工具 - 返回格式变化