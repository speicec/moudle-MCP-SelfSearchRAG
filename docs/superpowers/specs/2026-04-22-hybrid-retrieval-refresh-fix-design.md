# Hybrid Retrieval 刷新后失效修复设计

## 问题概述

**症状**：上传文档并向量化到 Qdrant 后，刷新页面重新检索时什么都搜不出来。

## 根本原因

三层问题叠加：

### 1. HierarchicalStore 持久化时清空 embeddings

文件 `src/chunking/hierarchical-store.ts`:
- `save()` 方法在第 74-77 行清空 embeddings
- `load()` 方法在第 127-129 行清空加载的 embeddings
- 设计意图是 embeddings 应存到 Qdrant，但检索时仍依赖内存中的 embeddings

### 2. HybridSmallToBigRetriever 没有被传递给 chat routes

文件 `src/server/http-server.ts`:
- 第 97-102 行创建了 HybridRetriever，但没有存储到 fastify
- 文件 `src/server/routes/chat.ts` 每次请求创建新的 SmallToBigRetriever（第 60、246 行）
- 新创建的 retriever 没有配置 HybridRetriever，依赖空 embeddings

### 3. 检索时没有从 Qdrant 加载 embeddings

Legacy 模式：
- 需要 embeddings 在内存中
- 刷新后 embeddings = []，所有相似度计算结果为 0

Hybrid 模式：
- 需要 HybridRetriever 配置
- 但 chat routes 没有使用已创建的 HybridRetriever

## 数据流问题

```
上传文档 → HierarchicalStore (有 embeddings) + Qdrant (有向量)
    ↓
保存到文件 (embeddings 被清空!)
    ↓
刷新页面
    ↓
从文件加载 → HierarchicalStore (embeddings = [])
    ↓
检索请求 → SmallToBigRetriever.searchSmallChunks()
    ↓
cosineSimilarity(queryEmbedding, []) → 所有分数 = 0
    ↓
没有任何结果
```

## 修复方案

### 方案选择：完善 Hybrid 模式集成

**核心思路**：让检索完全依赖 Qdrant，不再依赖内存中的 embeddings。

**优点**：
- 架构正确，符合设计意图
- 向量搜索性能更好（HNSW 索引）
- 支持 Dense + Sparse 混合检索

---

## 详细改动清单

### 1. `src/embedding/embedding-factory.ts`

**改动**：添加 `EMBEDDING_MODE=hybrid` 直接检测

```typescript
// 第 35-44 行改动
export function getEmbeddingMode(): EmbeddingMode {
  const mode = process.env.EMBEDDING_MODE?.toLowerCase();

  // 明确设置为 hybrid
  if (mode === 'hybrid') {
    console.log('[EmbeddingFactory] Mode detected: HYBRID (EMBEDDING_MODE=hybrid)');
    return 'hybrid';
  }

  if (mode === 'api') {
    return 'api';
  }

  // 通过 HYBRID_RETRIEVAL_ENABLED 标志
  if (process.env.HYBRID_RETRIEVAL_ENABLED === 'true') {
    console.log('[EmbeddingFactory] Mode detected: HYBRID (HYBRID_RETRIEVAL_ENABLED=true)');
    return 'hybrid';
  }

  return 'local';
}
```

---

### 2. `src/server/http-server.ts`

**改动**：将 HybridRetriever 和 SharedRetriever 存储到 fastify

**第 88-126 行改动**：

```typescript
// Initialize VectorStore if hybrid mode is enabled
let vectorStoreAdapter: any = null;
let hybridRetriever: any = null;
let sharedRetriever: any = null;

if (mode === 'hybrid') {
  try {
    fastify.log.info('=== Hybrid Mode Initialization ===');

    // Step 1: VectorStore
    const vectorStoreFactory = getVectorStoreFactory();
    vectorStoreAdapter = await vectorStoreFactory.createAdapter();
    fastify.log.info(`  [1/4] VectorStore: ${vectorStoreFactory.getType()}`);

    // Step 2: HybridEmbeddingService
    const hybridEmbeddingService = embeddingFactory.getHybridEmbeddingService();
    if (!hybridEmbeddingService) {
      fastify.log.error('  [FAIL] HybridEmbeddingService not available!');
      throw new Error('Hybrid mode requires HybridEmbeddingService');
    }
    fastify.log.info('  [2/4] HybridEmbeddingService available');

    // Step 3: Create HybridRetriever
    hybridRetriever = createHybridSmallToBigRetriever(
      vectorStoreAdapter,
      hierarchicalStore,
      hybridEmbeddingService
    );
    fastify.log.info('  [3/4] HybridRetriever created');

    // Step 4: Create Shared Retriever and configure Hybrid
    sharedRetriever = new SmallToBigRetriever(hierarchicalStore);
    sharedRetriever.setHybridRetriever(hybridRetriever);
    fastify.log.info('  [4/4] SharedRetriever configured with Hybrid');

    fastify.log.info('=== Hybrid Mode Ready ===');

  } catch (error) {
    fastify.log.warn('Failed to initialize Hybrid mode, falling back to in-memory: ' + (error instanceof Error ? error.message : String(error)));
    mode = 'local'; // Fallback to local mode
  }
}

// Register API routes
await fastify.register(documentRoutes, { prefix: '/api/documents' });
fastify.decorate('documentStoragePath', finalConfig.documentStoragePath);
fastify.decorate('wsHandler', wsHandler);
fastify.decorate('hierarchicalStore', hierarchicalStore);
fastify.decorate('imageStore', imageStore);
fastify.decorate('embeddingService', embeddingService as unknown as TextEmbeddingService);

// Decorate with Hybrid components (if available)
if (mode === 'hybrid' && vectorStoreAdapter && hybridRetriever && sharedRetriever) {
  fastify.decorate('vectorStoreAdapter', vectorStoreAdapter);
  fastify.decorate('hybridRetriever', hybridRetriever);
  fastify.decorate('sharedRetriever', sharedRetriever);

  const hybridEmbeddingService = embeddingFactory.getHybridEmbeddingService();
  if (hybridEmbeddingService) {
    fastify.decorate('hybridEmbeddingService', hybridEmbeddingService);
  }
}
```

---

### 3. `src/server/routes/chat.ts`

**改动**：优先使用已配置的 SharedRetriever

**导入新增**（第 4 行后）：
```typescript
import type { HybridSmallToBigRetriever } from '../../retrieval/hybrid-small-to-big-retriever.js';
```

**`/query` 端点改动**（第 59-95 行）：

```typescript
// Check if Hybrid Retriever is available
const sharedRetriever = (fastify as any).sharedRetriever as SmallToBigRetriever | undefined;
const hybridRetriever = (fastify as any).hybridRetriever as HybridSmallToBigRetriever | undefined;

let retriever: SmallToBigRetriever;

if (sharedRetriever && sharedRetriever.isHybridMode()) {
  // Hybrid 模式：使用已配置的 retriever
  console.log('[ChatRoute] Using pre-configured Hybrid Retriever');
  retriever = sharedRetriever;
  retriever.setConfig({ topK, similarityThreshold, maxContextTokens });
} else {
  // Fallback: Legacy 内存模式
  console.log('[ChatRoute] Using Legacy in-memory retriever');
  retriever = new SmallToBigRetriever(hierarchicalStore, {
    topK,
    similarityThreshold,
    maxContextTokens,
  });

  if (embeddingService) {
    console.log(`[ChatRoute] Embedding service available, dimension: ${embeddingService.getDimension()}`);
    retriever.setEmbeddingGenerator((text: string) => embeddingService.embedText(text));

    // 维度检查仅适用于 Legacy 模式
    const sampleChunks = hierarchicalStore.getAllSmallChunks();
    if (sampleChunks.length > 0) {
      const sampleChunk = sampleChunks[0];
      if (sampleChunk && sampleChunk.embedding.length > 0) {
        const storedDim = sampleChunk.embedding.length;
        const serviceDim = embeddingService.getDimension();
        console.log(`[ChatRoute] Dimension check - stored: ${storedDim}, service: ${serviceDim}`);

        if (storedDim !== serviceDim) {
          return reply.status(500).send({
            error: 'Embedding dimension mismatch',
            message: `Stored chunks use ${storedDim} dimensions, but embedding service produces ${serviceDim} dimensions`,
          });
        }
      }
    }
  } else {
    console.warn('[ChatRoute] No embedding service available - using synthetic embeddings');
  }
}
```

**同样逻辑应用于 `/generate` 端点（第 246-254 行）**。

**同样逻辑应用于 `/enhanced` 端点（第 463-466 行）**。

---

### 4. `src/app.ts`

**改动**：确保 MCP Server 也配置 Hybrid 模式

**第 89-109 行改动**：

```typescript
// Initialize HierarchicalStore with persistence
this.hierarchicalStore = new HierarchicalStore();
const storeDataPath = path.resolve(__dirname, '../data/store');

// Create embedding service using factory
const embeddingFactory = getEmbeddingFactory();
const embeddingService = embeddingFactory.createTextEmbeddingService();

// Create MCP RetrievalService with HierarchicalStore
this.retrieval = createMcpRetrievalService(
  this.hierarchicalStore,
  (text: string) => embeddingService.embedText(text)
);

// Configure Hybrid Retriever if hybrid mode is enabled
const mode = getEmbeddingMode();
if (mode === 'hybrid') {
  try {
    const vectorStoreFactory = getVectorStoreFactory();
    const vectorStoreAdapter = await vectorStoreFactory.createAdapter();
    const hybridEmbeddingService = embeddingFactory.getHybridEmbeddingService();

    if (hybridEmbeddingService && vectorStoreAdapter) {
      const hybridRetriever = createHybridSmallToBigRetriever(
        vectorStoreAdapter,
        this.hierarchicalStore,
        hybridEmbeddingService
      );
      this.retrieval.setHybridRetriever(hybridRetriever);
      console.log('[App] Hybrid Retriever configured for MCP Service');
    }
  } catch (error) {
    console.warn('[App] Failed to configure Hybrid for MCP:', error instanceof Error ? error.message : String(error));
  }
}
```

---

## 验证测试

### 测试场景 1：首次上传 + 检索

1. 启动服务器（确保 `HYBRID_RETRIEVAL_ENABLED=true`）
2. 上传 PDF 文档
3. 等待向量化完成
4. 执行检索 → 应返回结果

### 测试场景 2：刷新后检索

1. 刷新浏览器页面
2. 执行相同检索 → 应返回结果（不依赖内存 embeddings）

### 测试场景 3：重启服务器后检索

1. 重启服务器进程
2. 检查启动日志是否有 "Hybrid Mode Ready"
3. 执行检索 → 应返回结果

### 测试场景 4：Qdrant 不可用时降级

1. 停止 Qdrant 服务
2. 启动服务器
3. 检查日志是否正确降级到 Legacy 模式
4. 上传文档（使用 Legacy 模式）
5. 执行检索 → 应返回结果（但内存模式，刷新后会丢失）

---

## 风险评估

### 低风险
- 代码改动范围明确，仅影响初始化和检索逻辑
- 有明确的 fallback 路径（Legacy 模式）
- 不改变现有数据结构

### 需注意
- 环境变量配置需正确：`HYBRID_RETRIEVAL_ENABLED=true` 或 `EMBEDDING_MODE=hybrid`
- Qdrant 服务需持续可用
- 旧数据（使用 Legacy 模式上传的）刷新后仍会丢失，需重新上传

---

## 实施步骤

1. **Phase 1**：修改 `embedding-factory.ts` - 添加 hybrid 检测
2. **Phase 2**：修改 `http-server.ts` - 存储 HybridRetriever
3. **Phase 3**：修改 `chat.ts` - 使用 SharedRetriever
4. **Phase 4**：修改 `app.ts` - MCP Server 配置
5. **Phase 5**：测试验证