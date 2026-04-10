# Design: RAG Pipeline Integration

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         HTTP Server                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ /upload       │           │ /query        │           │ WebSocket     │
│               │           │               │           │               │
│ 1. Save file  │           │ 1. Get query  │           │ Broadcast     │
│ 2. Metadata   │           │ 2. Retrieve   │           │ pipeline      │
│ 3. Trigger    │           │ 3. Return     │           │ events        │
│    Pipeline   │           │    results    │           │               │
│               │           │               │           │               │
│    async ─────┼───────────►│               │           │               │
│               │           │               │           │               │
└───────────────┘           └───────────────┘           └───────────────┘
        │                           │                           │
        │                           │                           │
        ▼                           ▼                           │
┌───────────────┐           ┌───────────────┐                 │
│ Pipeline      │           │ Retriever     │                 │
│               │           │               │                 │
│ ┌───────────┐ │           │               │◄────────────────┤
│ │ Ingest    │ │           │               │  Shared Store   │
│ └───────────┘ │           │               │                 │
│       ↓       │           │               │                 │
│ ┌───────────┐ │           │               │                 │
│ │ Parse     │ │           │               │                 │
│ └───────────┘ │           │               │                 │
│       ↓       │           │               │                 │
│ ┌───────────┐ │           │               │                 │
│ │ Embed     │ ───────────►│ Hierarchical  │                 │
│ └───────────┘ │           │ Store         │                 │
│       ↓       │           │               │                 │
│ ┌───────────┐ │           │               │                 │
│ │ Index     │ ───────────►│               │                 │
│ └───────────┘ │           │               │                 │
│               │           │               │                 │
│ PipelineEmitter├──────────►│               │◄────────────────┤
│               │           │               │  wsHandler      │
└───────────────┘           └───────────────┘                 │
                                                              │
                                                              │
──────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### D1: 异步 Pipeline 执行

**问题**：Pipeline 处理可能耗时数秒到数分钟，不能阻塞 HTTP 响应。

**方案**：
```typescript
// 上传后立即返回，Pipeline 异步执行
fastify.post('/upload', async (request, reply) => {
  // ... 保存文件
  await fs.writeFile(filePath, fileBuffer);
  await saveMetadata(metadata);

  // 异步触发 Pipeline（不等待）
  processDocumentAsync(documentId, filePath).catch(err => {
    updateMetadataStatus(documentId, 'error', err.message);
    wsHandler.broadcast({ type: 'error', ... });
  });

  // 立即返回 metadata（status: 'pending'）
  return reply.status(200).send(metadata);
});
```

**理由**：用户无需等待处理完成，WebSocket 提供实时进度反馈。

---

### D2: 全局 HierarchicalStore 单例

**问题**：Pipeline 写入数据，Retriever 读取数据，需要共享存储。

**方案**：
```typescript
// http-server.ts 中创建并装饰到 fastify
const hierarchicalStore = new HierarchicalStore();
fastify.decorate('hierarchicalStore', hierarchicalStore);

// documents.ts 中注入
const store = fastify.hierarchicalStore;
// 传给 Pipeline 的 Index Stage

// chat.ts 中注入
const store = fastify.hierarchicalStore;
const retriever = new SmallToBigRetriever(store);
```

**理由**：避免多次初始化，保证数据一致性。Fastify decorate 提供类型安全的依赖注入。

---

### D3: PipelineEmitter Hook 集成

**问题**：如何将 Pipeline 事件桥接到 WebSocket？

**方案**：
```typescript
// 创建 Pipeline 时注册 hooks
const emitter = new PipelineEmitter(documentId, wsHandler);

const pipeline = pipelineBuilder()
  .withIngest()
  .withParse()
  .withEmbedding()
  .withIndex()
  .build();

// 注册事件 hooks
pipeline.registerHooks({
  preExecution: [(ctx) => {
    emitter.emitPipelineStart();
    return ctx;
  }],
  postExecution: [(result) => {
    if (result.status === 'success') {
      emitter.emitPipelineComplete({
        chunksCreated: result.context.getChunks().length,
        tokensProcessed: estimateTotalTokens(result.context),
      });
    }
    return result;
  }],
  onError: [(error, ctx) => {
    emitter.emitError(error.message, error.stack);
  }],
});
```

**理由**：复用现有 PipelineEmitter，无需修改 Pipeline 内部。

---

### D4: Stage Progress 事件

**问题**：现有 Pipeline hooks 只有 pre/post，缺少 stage progress。

**方案**：扩展 Stage 执行时发送 progress：
```typescript
// 在 Pipeline.run() 的 stage 循环中
for (const stage of this.stages) {
  emitter.emitStageStart(stage.name);

  // 执行 stage...
  context = await stage.execute(context);

  emitter.emitStageComplete(stage.name);
}
```

**备选方案**：如果 Stage 内部有细分步骤，可在 Plugin 中发送自定义事件。

---

### D5: Chat 查询参数映射

**问题**：API 参数需要映射到 Retriever 配置。

**方案**：
```typescript
// chat.ts
const { query, topK = 5, similarityThreshold = 0.3 } = request.body;

const retriever = new SmallToBigRetriever(store, {
  topK,
  similarityThreshold,
  maxContextTokens: 4000, // 默认值
});

const { results, context } = await retriever.retrieveWithMetadata(query);

// 组装响应
const response: ChatQueryResponse = {
  query,
  results: results.map(r => ({
    smallChunkId: r.smallChunkId,
    parentChunkId: r.parentChunkId,
    parentChunkContent: r.parentChunkContent,
    similarityScore: r.similarityScore,
    sourceDocumentId: r.sourceDocumentId,
  })),
  assembledContext: {
    content: context.content,
    tokenCount: context.tokenCount,
    truncated: context.truncated,
  },
};
```

---

## File Changes

### src/server/http-server.ts
- 创建 HierarchicalStore 单例
- decorate 到 fastify 实例
- 导出 processDocumentAsync 函数

### src/server/routes/documents.ts
- 上传后触发 processDocumentAsync
- 实现 processDocumentAsync 函数（构建 Pipeline，注册 hooks，执行）
- 错误处理：更新 metadata 状态

### src/server/routes/chat.ts
- 获取 fastify.hierarchicalStore
- 创建 SmallToBigRetriever
- 替换 mock 结果为真实检索

### src/server/types.ts
- 扩展 FastifyInstance 接口添加 hierarchicalStore

---

## Error Handling

```typescript
// 处理失败时
processDocumentAsync(documentId, filePath).catch(err => {
  // 1. 更新 metadata 状态为 'error'
  await updateMetadata(documentId, {
    status: 'error',
    errorMessage: err.message,
  });

  // 2. 通过 WebSocket 发送错误事件
  wsHandler.broadcast({
    type: 'error',
    documentId,
    error: { message: err.message, stack: err.stack },
    timestamp: Date.now(),
  });

  // 3. 记录到日志
  fastify.log.error({ documentId, error: err });
});
```

---

## Testing Strategy

1. **单元测试**：processDocumentAsync 函数单独测试
2. **集成测试**：
   - 上传文档 → 验证 metadata 状态变化
   - WebSocket 收到事件序列
   - 查询返回相关结果
3. **端到端测试**：前端上传 → WebSocket 显示进度 → 查询返回结果