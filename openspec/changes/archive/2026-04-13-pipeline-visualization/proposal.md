## Why

用户无法直观理解 RAG 系统的文档处理流程——从上传到索引各阶段发生了什么、分块如何切分、检索如何匹配。这导致用户难以信任系统结果，也无法发现质量问题。现有 WebSocket 事件流已有基础数据，但前端只展示了简单的进度条，缺乏深度可视化。

## What Changes

- 新增 **处理时间轴 (PipelineTimeline)** 组件：展示文档处理各阶段的耗时、关键指标，支持实时更新
- 新增 **分块浏览器 (ChunkExplorer)** 组件：树形/网格视图展示 chunk 层级结构，支持筛选、排序、详情弹窗
- 新增 **检索过程动画 (RetrievalFlow)** 组件：可视化相似度搜索和 Parent 扩展过程
- 新增 **统计仪表盘 (StatsDashboard)** 组件：全局性能数据、趋势分析
- 后端扩展 WebSocket 事件：`stage:metrics`、`chunk:created`、`retrieval:start/match/complete`、`stats:update`
- 新增 `/api/documents/:id/chunks` 分页端点、`/api/stats` 统计端点
- 新增 `src/frontend/store/` 下多个状态管理模块

## Capabilities

### New Capabilities

- `pipeline-timeline`: 处理时间轴组件，展示 Pipeline 各阶段时间消耗和关键指标
- `chunk-explorer`: 分块浏览器组件，实时展示 Chunk 层级结构和内容，支持树形/网格视图切换
- `retrieval-flow`: 检索过程动画组件，可视化相似度搜索和 Parent 扩展过程
- `stats-dashboard`: 统计仪表盘组件，全局性能数据和趋势分析

### Modified Capabilities

- `websocket-protocol`: 新增事件类型 `stage:metrics`、`chunk:created`、`retrieval:*`、`stats:update`
- `frontend-ui`: 扩展 `PipelineVisualizer` 为完整的可视化系统，增加 Tab 切换布局
- `document-management`: 新增分页获取 chunks 端点

## Impact

**后端改动**：
- `src/server/routes/documents.ts` - 新增 `/chunks` 端点
- `src/server/routes/stats.ts` - 新文件，统计 API
- `src/server/routes/chat.ts` - 发送检索过程事件
- `src/server/pipeline-emitter.ts` - 新增 metrics/chunk 事件方法
- `src/chunking/hierarchical-store.ts` - 新增分页查询方法

**前端改动**：
- 新增 5 个组件文件、3 个 store 文件
- `useWebSocket.ts` - 处理新事件类型
- `App.tsx` - 整合可视化布局