## Context

### 当前架构问题
系统存在三条独立的数据路径，导致查询功能失效：

```
┌─────────────────────────────────────────────────────────────────┐
│                    当前架构断裂                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  HTTP Server (✅ 工作正常)                                       │
│  ═══════════════════════                                        │
│  Upload → Pipeline → HierarchicalStore → SmallToBigRetriever    │
│                     ↓                                           │
│          hierarchical-store.json (189 chunks)                   │
│                     ↓                                           │
│          /api/chat/query → 返回结果 ✅                           │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  MCP Server (❌ 完全失效)                                        │
│  ══════════════════════                                         │
│  app.ts → InMemoryVectorStore (空!)                             │
│           ↓                                                     │
│           query → 返回空结果 ❌                                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  前端 UI (❌ Bug)                                                │
│  ═════════════                                                  │
│  VisualApp.tsx → useDocumentStore.submitQuery() → undefined ❌  │
│  正确应为 → useChatStore.submitQuery() → API call ✅            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 数据存储现状
- `HierarchicalStore` 持有实际数据：189 small chunks, 165 parent chunks
- 数据持久化在 `data/store/hierarchical-store.json`
- HTTP Server 启动时正确加载此数据
- MCP Server 创建了空的 `InMemoryVectorStore`，从未与数据关联

### 前端组件现状
- `ChatWindow.tsx` 已存在完整聊天 UI（消息列表、输入框、结果卡片）
- `VisualApp.tsx` 使用简单的 `QuickQuery` 输入框
- QuickQuery 错误引用 `useDocumentStore`（无 submitQuery）

## Goals / Non-Goals

**Goals:**
- 修复前端 QuickQuery store Bug，使其正确调用查询 API
- 集成 ChatWindow 到主界面，提供完整的聊天对话体验
- MCP Server 使用 HierarchicalStore 进行查询，返回正确结果
- 统一 HTTP Server 和 MCP Server 的数据源

**Non-Goals:**
- 不重构 pipeline 流程（当前 pipeline 工作正常）
- 不修改 HTTP Server 的查询逻辑（已正确工作）
- 不修改 embedding 服务配置
- 不添加新的查询功能（如混合检索、BM25）

## Decisions

### Decision 1: MCP 数据源方案

**选择**: 让 MCP Server 使用 `HierarchicalStore` + `SmallToBigRetriever`

**理由**:
- 数据已存在于 HierarchicalStore
- SmallToBigRetriever 已实现完整的 Small-to-Big 检索逻辑
- 与 HTTP Server 保持一致，避免维护两套查询系统

**备选方案**:
1. ❌ 同步数据到 InMemoryVectorStore - 需要在每次处理后同步，复杂且易出错
2. ❌ 让 Pipeline 写入两个 Store - 增加复杂度，违反单一数据源原则
3. ✅ MCP 直接使用 HierarchicalStore - 最简单，复用现有代码

### Decision 2: 前端 UI 方案

**选择**: 将 ChatWindow 作为左侧面板的主要组件

**理由**:
- ChatWindow 已实现完整功能：消息历史、结果展示、错误处理
- 保持现有布局结构，最小改动
- 用户期望聊天式交互体验

**备选方案**:
1. ❌ 创建新的 QueryPanel - 重复开发，浪费时间
2. ❌ 保持 QuickQuery + 单独结果面板 - 分离式 UI 不符合聊天交互习惯
3. ✅ 集成现有 ChatWindow - 复用现有组件，快速实现

### Decision 3: MCP 工具返回格式

**选择**: MCP query 工具返回 Small-to-Big 格式（与 HTTP API 一致）

**理由**:
- 保持 API 一致性
- 包含更丰富的上下文信息（contextWindow、parentChunkContent）
- 减少维护负担

**备选方案**:
1. ❌ 保持原有 VectorStore 格式 - 数据源变化后无法支持
2. ✅ 使用 Small-to-Big 格式 - 与 HTTP API 一致，便于调试

## Risks / Trade-offs

### Risk 1: MCP 工具返回格式变化
- **影响**: 使用 MCP 的 Claude Desktop 客户端需要适应新格式
- **缓解**: 新格式包含更丰富信息，是增强而非削弱；添加格式说明文档

### Risk 2: 前端改动可能影响现有功能
- **影响**: VisualApp.tsx 改动可能影响其他 Tab（timeline、chunks、stats）
- **缓解**: 仅修改左侧面板，保持右侧 Tab 结构不变；测试每个 Tab 功能

### Risk 3: 嵌入服务首次调用延迟
- **影响**: Local embedding 模型首次加载需要时间
- **缓解**: 已有 preload 机制，服务启动时预加载模型

## Migration Plan

### Phase 1: 前端修复（低风险）
1. 修改 VisualApp.tsx store 引用
2. 集成 ChatWindow 组件
3. 测试 Web UI 查询功能

### Phase 2: MCP 重构（中等风险）
1. 创建 MCP RetrievalService（基于 HierarchicalStore）
2. 修改 app.ts 初始化逻辑
3. 修改 MCP handlers 使用新服务
4. 测试 MCP query 工具

### Rollback Strategy
- 前端改动：Git revert，恢复 VisualApp.tsx
- MCP 改动：保留原有 InMemoryVectorStore 代码路径，通过配置切换

## Open Questions

- 是否需要为 MCP 增加配置选项支持不同查询模式？（当前决定：不需要，直接使用 HierarchicalStore）
- ChatWindow 是否需要支持语音输入？（当前决定：不需要，超出范围）
- MCP 返回格式是否需要版本标识？（当前决定：暂不需要，后续可添加）