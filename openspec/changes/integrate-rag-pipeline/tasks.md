# Tasks: Integrate RAG Pipeline

## Phase 1: Document Processing Integration

### Task 1.1: Extend FastifyInstance types ✅
- 添加 `hierarchicalStore` 和 `processDocumentFn` 到 FastifyInstance 声明
- 文件: `src/server/types.ts`

### Task 1.2: Create HierarchicalStore singleton in http-server ✅
- 在 `createHttpServer` 中创建 HierarchicalStore
- 使用 `fastify.decorate()` 注入
- 文件: `src/server/http-server.ts`

### Task 1.3: Implement processDocumentAsync function ✅
- 创建 `src/server/document-processor.ts`
- 实现 `processDocumentAsync(documentId, filePath, fastify)`
- 构建 Pipeline (ingest → parse → embed → index)
- 注册 PipelineEmitter hooks
- 异步执行 Pipeline
- 错误处理：更新 metadata 状态

### Task 1.4: Update documents.ts upload route ✅
- 上传成功后调用 `processDocumentAsync`
- 不等待执行完成（fire-and-forget with error catch）
- 文件: `src/server/routes/documents.ts`

### Task 1.5: Update metadata status on completion ✅
- Pipeline 成功后更新 metadata status 为 'indexed'
- Pipeline 失败后更新 metadata status 为 'error'
- 记录 chunksCreated 等统计信息

## Phase 2: Chat Retrieval Integration

### Task 2.1: Get HierarchicalStore in chat routes ✅
- 从 `fastify.hierarchicalStore` 获取存储实例
- 文件: `src/server/routes/chat.ts`

### Task 2.2: Create SmallToBigRetriever per query ✅
- 在 `/query` POST handler 中创建 retriever
- 使用请求参数配置 topK, similarityThreshold
- 替换 mock 数据为真实检索

### Task 2.3: Implement embedding generator injection ✅
- 配置 retriever.setEmbeddingGenerator()
- 优先使用真实 embedding 服务（如果配置）
- 否则使用 synthetic fallback（保持现有行为）

### Task 2.4: Map retrieval results to response format ✅
- 转换 HierarchicalRetrievalResult 到 ChatQueryResponse
- 组装 assembledContext
- 计算并返回 tokenCount

## Phase 3: Integration Testing

### Task 3.1: Test document upload → processing flow ✅
- 上传文档，验证 metadata 状态变化 ✓ (pending → indexed)
- 验证 WebSocket 收到 pipeline 事件
- 验证 HierarchicalStore 包含 chunks ✓

### Task 3.2: Test query → retrieval flow ✅
- 上传完成后查询 ✓
- 验证返回真实结果（非 mock）✓
- 验证相似度排序 ✓

### Task 3.3: Test error handling ✅
- 模拟处理失败 ✓ (早期 text format bug)
- 验证 metadata 更新为 'error' ✓
- 验证 WebSocket 收到 error 事件

## Dependencies Between Tasks

```
Task 1.1 ──► Task 1.2 ──► Task 1.3 ──► Task 1.4 ──► Task 1.5
    │                                      │
    │                                      │
    ▼                                      ▼
Task 2.1 ──► Task 2.2 ──► Task 2.3 ──► Task 2.4
                                            │
                                            │
                                            ▼
                                      Task 3.x (测试)
```

## Estimated Complexity

| Task | Complexity | Notes |
|------|------------|-------|
| 1.1  | Low        | 类型扩展 |
| 1.2  | Low        | 单例创建 |
| 1.3  | High       | 核心 Pipeline 集成逻辑 |
| 1.4  | Low        | 调用函数 |
| 1.5  | Medium     | 状态更新 + 错误处理 |
| 2.1  | Low        | 获取依赖 |
| 2.2  | Medium     | Retriever 配置 + 调用 |
| 2.3  | Medium     | Embedding 配置 |
| 2.4  | Low        | 结果映射 |
| 3.x  | Medium     | 测试验证 |