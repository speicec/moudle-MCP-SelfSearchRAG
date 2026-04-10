# Proposal: Integrate RAG Pipeline into HTTP Server

## Summary
将现有的 RAG 处理组件（Pipeline, SmallToBigRetriever）集成到 HTTP 服务端点，使文档上传触发真实处理流程，聊天查询返回真实检索结果。

## Problem

**数据结构视角**：
- Pipeline 框架和 SmallToBigRetriever 已实现但未被使用
- 文档上传只是保存文件，没有触发处理管道
- Chat 查询返回 mock 数据，没有调用检索器

```
当前状态                              目标状态
┌─────────────────────┐              ┌─────────────────────┐
│ Upload → 保存文件    │              │ Upload → 保存文件    │
│         ↓           │              │         ↓           │
│ 返回 metadata       │              │ 触发 Pipeline       │
│                     │              │         ↓           │
│ ❌ 没有处理         │              │ Parse → Chunk       │
│ ❌ 没有索引         │              │         ↓           │
│                     │              │ Embed → Index       │
│                     │              │         ↓           │
│                     │              │ 存入 ChromaDB       │
│                     │              │         ↓           │
│                     │              │ 更新 metadata       │
└─────────────────────┘              └─────────────────────┘

┌─────────────────────┐              ┌─────────────────────┐
│ Query → mock data   │              │ Query → embedding   │
│                     │              │         ↓           │
│ ❌ 没有检索         │              │ SmallToBig 检索     │
│                     │              │         ↓           │
│                     │              │ ChromaDB 向量搜索   │
│                     │              │         ↓           │
│                     │              │ 返回真实结果        │
└─────────────────────┘              └─────────────────────┘
```

## Scope

### In Scope
1. **文档上传集成**：触发 Pipeline 处理流程
2. **状态追踪**：通过 WebSocket 实时报告处理进度
3. **Chat 查询集成**：调用 SmallToBigRetriever 返回真实结果
4. **错误处理**：处理失败时更新文档状态为 "error"

### Out of Scope
- 前端 UI 改进
- WebSocket 协议变更
- 新的 API 端点
- Embedding 服务配置（保持现有 synthetic fallback）

## Approach

**核心原则**：
1. 不破坏现有 API 契约（向后兼容）
2. 复用现有组件，不重新发明
3. 简单直接，避免过度抽象

### Phase 1: 文档处理集成

```typescript
// documents.ts - 上传后触发 Pipeline
async function processDocument(documentId: string, filePath: string) {
  // 1. 创建 Document 对象
  // 2. 构建 Pipeline
  // 3. 注册 PipelineEmitter hooks
  // 4. 异步执行 Pipeline.run()
  // 5. 更新 metadata 状态
}
```

### Phase 2: Chat 检索集成

```typescript
// chat.ts - 替换 mock 为真实检索
async function queryDocuments(query: string, topK: number) {
  // 1. 获取全局 HierarchicalStore
  // 2. 创建 SmallToBigRetriever
  // 3. 调用 retrieveWithMetadata()
  // 4. 返回真实结果
}
```

## Dependencies

- 已存在：`Pipeline`, `PipelineBuilder`, `SmallToBigRetriever`, `HierarchicalStore`
- 已存在：`PipelineEmitter`, `WebSocketHandler`
- 需确认：ChromaDB 连接是否已配置

## Risks

1. **异步处理**：Pipeline 执行需要时间，必须异步运行避免阻塞 HTTP 响应
2. **状态一致性**：处理失败时 metadata 正确更新
3. **空结果处理**：首次上传后索引未完成，查询可能返回空

## Success Criteria

- 文档上传后，metadata 状态从 pending → processing → indexed
- WebSocket 客户端收到 pipeline:start, stage:progress, pipeline:complete 事件
- Chat 查询返回基于实际文档内容的检索结果（非 mock）
- 文档列表 API 显示真实处理状态

## Related Specs

- [document-management](../../specs/document-management/spec.md)
- [chat-retrieval](../../specs/chat-retrieval/spec.md)
- [small-to-big-retrieval](../../specs/small-to-big-retrieval/spec.md)
- [websocket-protocol](../../specs/websocket-protocol/spec.md)