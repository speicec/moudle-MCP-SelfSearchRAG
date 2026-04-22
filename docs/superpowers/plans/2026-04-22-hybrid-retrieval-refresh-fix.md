# Hybrid Retrieval 刷新后失效修复 - 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复刷新页面后检索失效问题，让检索完全依赖 Qdrant，不再依赖内存中的 embeddings。

**架构：** HTTP Server 初始化时创建 HybridRetriever 并存储到 fastify，Chat Routes 优先使用已配置的 HybridRetriever，MCP Server 同样配置 Hybrid 模式。

**技术栈：** TypeScript, Fastify, Qdrant, SmallToBigRetriever, HybridSmallToBigRetriever

---

## 文件结构

| 文件 | 职责 | 改动类型 |
|------|------|----------|
| `src/embedding/embedding-factory.ts` | Embedding 模式检测 | 修改 |
| `src/server/http-server.ts` | HTTP 服务器初始化，存储 HybridRetriever | 修改 |
| `src/server/routes/chat.ts` | Chat 路由，使用 SharedRetriever | 修改 |
| `src/app.ts` | MCP Server 配置 Hybrid 模式 | 修改 |

---

## 任务 1：修改 embedding-factory.ts - 添加 hybrid 检测

**文件：**
- 修改：`src/embedding/embedding-factory.ts:35-44`

**目标：** 让 `EMBEDDING_MODE=hybrid` 环境变量能直接启用 hybrid 模式，并添加检测日志。

- [ ] **步骤 1：修改 getEmbeddingMode 函数**

打开 `src/embedding/embedding-factory.ts`，找到第 35-44 行的 `getEmbeddingMode` 函数，替换为：

```typescript
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

- [ ] **步骤 2：验证改动编译通过**

```bash
cd D:/Code/moudle-MCP-SelfSearchRAG
npm run build
```

预期：编译成功，无错误

- [ ] **步骤 3：Commit**

```bash
git add src/embedding/embedding-factory.ts
git commit -m "feat(embedding): add EMBEDDING_MODE=hybrid direct detection

- Add explicit EMBEDDING_MODE=hybrid detection
- Add detection source logging for debugging
- Support both EMBEDDING_MODE and HYBRID_RETRIEVAL_ENABLED env vars

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 2：修改 http-server.ts - 存储 HybridRetriever

**文件：**
- 修改：`src/server/http-server.ts:88-126`

**目标：** 创建 HybridRetriever 和 SharedRetriever，存储到 fastify 实例。

- [ ] **步骤 1：添加 SmallToBigRetriever 导入**

在 `src/server/http-server.ts` 第 19 行后添加导入：

```typescript
import { createHybridSmallToBigRetriever } from '../retrieval/hybrid-small-to-big-retriever.js';
import { SmallToBigRetriever } from '../chunking/small-to-big-retriever.js';  // 新增
```

- [ ] **步骤 2：重构 Hybrid 初始化逻辑**

找到第 88-107 行的 Hybrid 初始化代码块，替换为：

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
  }
}
```

- [ ] **步骤 3：添加 fastify.decorate 存储 Hybrid 组件**

找到第 109-125 行的 fastify.decorate 代码块，修改为：

```typescript
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

- [ ] **步骤 4：验证改动编译通过**

```bash
npm run build
```

预期：编译成功，无错误

- [ ] **步骤 5：Commit**

```bash
git add src/server/http-server.ts
git commit -m "feat(http-server): store HybridRetriever and SharedRetriever in fastify

- Create HybridRetriever and SharedRetriever during initialization
- Store hybridRetriever, sharedRetriever in fastify for route access
- Add structured startup logging for hybrid mode
- Graceful fallback on initialization failure

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 3：修改 chat.ts - 使用 SharedRetriever

**文件：**
- 修改：`src/server/routes/chat.ts`

**目标：** `/query`、`/generate`、`/enhanced` 端点优先使用已配置的 SharedRetriever。

- [ ] **步骤 1：添加 HybridSmallToBigRetriever 类型导入**

在 `src/server/routes/chat.ts` 第 4 行后添加：

```typescript
import type { HybridSmallToBigRetriever } from '../../retrieval/hybrid-small-to-big-retriever.js';
```

- [ ] **步骤 2：修改 /query 端点检索逻辑**

找到第 59-95 行的检索逻辑，替换为：

```typescript
// Check if Hybrid Retriever is available
const sharedRetriever = (fastify as any).sharedRetriever as SmallToBigRetriever | undefined;

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

    // 维度检查仅适用于 Legacy 模式（Hybrid 模式 embeddings 在 Qdrant）
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

// Create emitter for retrieval events
const wsHandler = fastify.wsHandler;
const emitter = wsHandler ? new PipelineEmitter('retrieval', wsHandler) : null;
```

- [ ] **步骤 3：修改 /generate 端点检索逻辑**

找到第 246-254 行，替换为与 `/query` 相同的逻辑：

```typescript
// Check if Hybrid Retriever is available
const sharedRetriever = (fastify as any).sharedRetriever as SmallToBigRetriever | undefined;

let retriever: SmallToBigRetriever;

if (sharedRetriever && sharedRetriever.isHybridMode()) {
  console.log('[ChatRoute:Generate] Using pre-configured Hybrid Retriever');
  retriever = sharedRetriever;
  retriever.setConfig({ topK, similarityThreshold, maxContextTokens });
} else {
  console.log('[ChatRoute:Generate] Using Legacy in-memory retriever');
  retriever = new SmallToBigRetriever(hierarchicalStore, {
    topK,
    similarityThreshold,
    maxContextTokens,
  });

  if (embeddingService) {
    retriever.setEmbeddingGenerator((text: string) => embeddingService.embedText(text));
  }
}
```

- [ ] **步骤 4：修改 /enhanced 端点检索逻辑**

找到第 463-466 行，替换为：

```typescript
// Check if Hybrid Retriever is available
const sharedRetriever = (fastify as any).sharedRetriever as SmallToBigRetriever | undefined;

let retriever: SmallToBigRetriever;

if (sharedRetriever && sharedRetriever.isHybridMode()) {
  console.log('[ChatRoute:Enhanced] Using pre-configured Hybrid Retriever');
  retriever = sharedRetriever;
} else {
  console.log('[ChatRoute:Enhanced] Using Legacy in-memory retriever');
  retriever = new SmallToBigRetriever(hierarchicalStore);

  if (embeddingService) {
    retriever.setEmbeddingGenerator((text: string) => embeddingService.embedText(text));
  }
}
```

- [ ] **步骤 5：验证改动编译通过**

```bash
npm run build
```

预期：编译成功，无错误

- [ ] **步骤 6：Commit**

```bash
git add src/server/routes/chat.ts
git commit -m "feat(chat): use pre-configured HybridRetriever instead of creating new one

- /query, /generate, /enhanced endpoints now use sharedRetriever
- Add HybridSmallToBigRetriever type import
- Add logging for hybrid vs legacy mode selection
- Dimension check only applies to Legacy mode

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 4：修改 app.ts - MCP Server 配置 Hybrid 模式

**文件：**
- 修改：`src/app.ts`

**目标：** 确保 MCP Server 也配置 Hybrid 模式。

- [ ] **步骤 1：添加必要的导入**

在 `src/app.ts` 第 1-11 行的导入部分添加：

```typescript
import { createDefaultPipeline } from './integration/pipeline-builder.js';
import { DocumentStorage } from './core/storage.js';
import { createMcpServer } from './mcp/server.js';
import { createMcpRetrievalService } from './mcp/mcp-retrieval-service.js';
import { HierarchicalStore } from './chunking/hierarchical-store.js';
import { getEmbeddingFactory, getEmbeddingMode } from './embedding/embedding-factory.js';  // 添加 getEmbeddingMode
import { getVectorStoreFactory } from './retrieval/vector-store-factory.js';  // 新增
import { createHybridSmallToBigRetriever } from './retrieval/hybrid-small-to-big-retriever.js';  // 新增
import { createLLMCaller, type LLMCaller } from './config/llm-config.js';
import type { Harness } from './core/harness.js';
import type { McpRetrievalService } from './mcp/mcp-retrieval-service.js';
import type { McpServer } from './mcp/server.js';
import path from 'path';
import { fileURLToPath } from 'url';
```

- [ ] **步骤 2：添加 Hybrid 配置逻辑**

找到 `Application.create` 方法（约第 115-124 行），修改为：

```typescript
/**
 * Create application instance (async factory)
 */
static async create(config: Partial<AppConfig> = {}): Promise<Application> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const app = new Application(fullConfig);

  // Enable persistence for HierarchicalStore (async)
  const storeDataPath = path.resolve(__dirname, '../data/store');
  await app.hierarchicalStore.enablePersistence(storeDataPath, true);

  // Configure Hybrid Retriever if hybrid mode is enabled
  const mode = getEmbeddingMode();
  if (mode === 'hybrid') {
    try {
      const embeddingFactory = getEmbeddingFactory();
      const vectorStoreFactory = getVectorStoreFactory();
      const vectorStoreAdapter = await vectorStoreFactory.createAdapter();
      const hybridEmbeddingService = embeddingFactory.getHybridEmbeddingService();

      if (hybridEmbeddingService && vectorStoreAdapter) {
        const hybridRetriever = createHybridSmallToBigRetriever(
          vectorStoreAdapter,
          app.hierarchicalStore,
          hybridEmbeddingService
        );
        app.retrieval.setHybridRetriever(hybridRetriever);
        console.log('[App] Hybrid Retriever configured for MCP Service');
      }
    } catch (error) {
      console.warn('[App] Failed to configure Hybrid for MCP:', error instanceof Error ? error.message : String(error));
    }
  }

  return app;
}
```

- [ ] **步骤 3：验证改动编译通过**

```bash
npm run build
```

预期：编译成功，无错误

- [ ] **步骤 4：Commit**

```bash
git add src/app.ts
git commit -m "feat(app): configure Hybrid Retriever for MCP Server

- Add getEmbeddingMode, getVectorStoreFactory, createHybridSmallToBigRetriever imports
- Configure Hybrid Retriever in Application.create() if hybrid mode enabled
- Graceful fallback with warning log on failure

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 任务 5：集成测试验证

**目标：** 验证所有改动正常工作。

- [ ] **步骤 1：运行完整构建**

```bash
npm run build
```

预期：编译成功，无错误

- [ ] **步骤 2：运行现有测试**

```bash
npm test
```

预期：所有测试通过（如果有测试失败，检查是否与本改动相关）

- [ ] **步骤 3：启动服务器验证 Hybrid 模式**

设置环境变量并启动服务器：

```bash
export HYBRID_RETRIEVAL_ENABLED=true
npm run start
```

预期启动日志包含：
```
=== Hybrid Mode Initialization ===
  [1/4] VectorStore: qdrant
  [2/4] HybridEmbeddingService available
  [3/4] HybridRetriever created
  [4/4] SharedRetriever configured with Hybrid
=== Hybrid Mode Ready ===
```

- [ ] **步骤 4：手动测试检索功能**

1. 上传 PDF 文档
2. 等待向量化完成
3. 执行检索请求
4. 刷新页面后再次检索

预期：两次检索都返回结果

- [ ] **步骤 5：Final Commit**

```bash
git status
git add docs/superpowers/specs/2026-04-22-hybrid-retrieval-refresh-fix-design.md
git add docs/superpowers/plans/2026-04-22-hybrid-retrieval-refresh-fix.md
git add context/review/2026-04-22-1430-design-hybrid-retrieval-fix.md
git commit -m "docs: add hybrid retrieval refresh fix design and plan

- Add design spec documenting the root cause and fix approach
- Add implementation plan with 5 tasks and detailed steps
- Add design consistency check report validating the plan

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 自检清单

### 1. 规格覆盖度

| 规格章节 | 对应任务 |
|----------|----------|
| `embedding-factory.ts` 改动 | 任务 1 |
| `http-server.ts` 改动 | 任务 2 |
| `chat.ts` 改动 | 任务 3 |
| `app.ts` 改动 | 任务 4 |
| 测试验证 | 任务 5 |

✓ 所有规格需求已覆盖

### 2. 占位符扫描

- 无 "待定"、"TODO"、"后续实现"
- 无 "添加适当的错误处理" 等模糊描述
- 所有代码步骤都有完整代码块

✓ 无占位符问题

### 3. 类型一致性

- `SmallToBigRetriever` 类型名一致
- `HybridSmallToBigRetriever` 类型名一致
- `isHybridMode()` 方法名一致
- `setHybridRetriever()` 方法名一致
- `setConfig()` 方法名一致

✓ 类型和方法名一致

---

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-04-22-hybrid-retrieval-refresh-fix.md`。

**两种执行方式：**

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

选哪种方式？