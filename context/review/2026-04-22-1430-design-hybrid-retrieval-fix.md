# 设计一致性检查报告

## 时间: 2026-04-22

## 检查范围
- **设计文档:** `docs/superpowers/specs/2026-04-22-hybrid-retrieval-refresh-fix-design.md`
- **代码范围:**
  - `src/server/http-server.ts`
  - `src/server/routes/chat.ts`
  - `src/embedding/embedding-factory.ts`
  - `src/app.ts`
  - `src/chunking/small-to-big-retriever.ts` (辅助验证)
  - `src/mcp/mcp-retrieval-service.ts` (辅助验证)

## 契约一致性状态: **⚠ 存在偏差**

---

## 一致项

✓ `SmallToBigRetriever.setHybridRetriever()` 方法存在 (`src/chunking/small-to-big-retriever.ts:88-91`)
  ```typescript
  setHybridRetriever(retriever: HybridSmallToBigRetriever): void {
    this.hybridRetriever = retriever;
    console.log('[SmallToBigRetriever] Hybrid retriever configured - using Qdrant for search');
  }
  ```

✓ `SmallToBigRetriever.isHybridMode()` 方法存在 (`src/chunking/small-to-big-retriever.ts:96-98`)
  ```typescript
  isHybridMode(): boolean {
    return this.hybridRetriever !== undefined;
  }
  ```

✓ `McpRetrievalService.setHybridRetriever()` 方法存在 (`src/mcp/mcp-retrieval-service.ts:75-78`)
  ```typescript
  setHybridRetriever(hybridRetriever: HybridSmallToBigRetriever): void {
    this.retriever.setHybridRetriever(hybridRetriever);
    console.log('[McpRetrievalService] Hybrid retriever configured');
  }
  ```

✓ `HybridSmallToBigRetriever` 导入存在 (`src/server/http-server.ts:19`)
  ```typescript
  import { createHybridSmallToBigRetriever } from '../retrieval/hybrid-small-to-big-retriever.js';
  ```

✓ `getVectorStoreFactory` 导入存在 (`src/server/http-server.ts:18`)
  ```typescript
  import { getVectorStoreFactory } from '../retrieval/vector-store-factory.js';
  ```

✓ `fastify.decorate('vectorStoreAdapter')` 已实现 (`src/server/http-server.ts:120`)
  ```typescript
  fastify.decorate('vectorStoreAdapter', vectorStoreAdapter);
  ```

✓ `fastify.decorate('hybridEmbeddingService')` 已实现 (`src/server/http-server.ts:121-124`)

---

## 偏差列表

### Critical

#### 1. `embedding-factory.ts`: 缺少 `EMBEDDING_MODE=hybrid` 直接检测

**设计要求 (第 35-44 行):**
```typescript
export function getEmbeddingMode(): EmbeddingMode {
  const mode = process.env.EMBEDDING_MODE?.toLowerCase();
  // 明确设置为 hybrid
  if (mode === 'hybrid') {
    console.log('[EmbeddingFactory] Mode detected: HYBRID (EMBEDDING_MODE=hybrid)');
    return 'hybrid';
  }
  // ...
}
```

**当前代码 (`src/embedding/embedding-factory.ts:35-44`):**
```typescript
export function getEmbeddingMode(): EmbeddingMode {
  const mode = process.env.EMBEDDING_MODE?.toLowerCase();
  if (mode === 'api') {
    return 'api';
  }
  // Check if hybrid retrieval is enabled
  if (process.env.HYBRID_RETRIEVAL_ENABLED === 'true') {
    return 'hybrid';
  }
  return 'local';
}
```

**影响:** 无法通过 `EMBEDDING_MODE=hybrid` 环境变量直接启用 hybrid 模式，必须依赖 `HYBRID_RETRIEVAL_ENABLED=true`。

---

#### 2. `http-server.ts`: HybridRetriever 未存储到 fastify

**设计要求 (第 129-161 行):**
```typescript
// Step 3: Create HybridRetriever
hybridRetriever = createHybridSmallToBigRetriever(...);
fastify.log.info('  [3/4] HybridRetriever created');

// Step 4: Create Shared Retriever and configure Hybrid
sharedRetriever = new SmallToBigRetriever(hierarchicalStore);
sharedRetriever.setHybridRetriever(hybridRetriever);
fastify.log.info('  [4/4] SharedRetriever configured with Hybrid');

// Decorate with Hybrid components
fastify.decorate('hybridRetriever', hybridRetriever);
fastify.decorate('sharedRetriever', sharedRetriever);
```

**当前代码 (`src/server/http-server.ts:97-102`):**
```typescript
createHybridSmallToBigRetriever(
  vectorStoreAdapter,
  hierarchicalStore,
  hybridEmbeddingService
);
fastify.log.info('HybridSmallToBigRetriever initialized');
// ❌ 没有存储 hybridRetriever
// ❌ 没有创建 sharedRetriever
// ❌ 没有调用 setHybridRetriever
```

**影响:** chat routes 无法访问已配置的 HybridRetriever，导致每次请求创建新的无配置 retriever。

---

#### 3. `chat.ts`: 未使用预配置的 SharedRetriever

**设计要求 (第 59-95 行 `/query` 端点):**
```typescript
const sharedRetriever = (fastify as any).sharedRetriever as SmallToBigRetriever | undefined;
const hybridRetriever = (fastify as any).hybridRetriever as HybridSmallToBigRetriever | undefined;

let retriever: SmallToBigRetriever;

if (sharedRetriever && sharedRetriever.isHybridMode()) {
  retriever = sharedRetriever;
  retriever.setConfig({ topK, similarityThreshold, maxContextTokens });
} else {
  // Fallback: Legacy 内存模式
  retriever = new SmallToBigRetriever(hierarchicalStore, { ... });
}
```

**当前代码 (`src/server/routes/chat.ts:60-64`):**
```typescript
const retriever = new SmallToBigRetriever(hierarchicalStore, {
  topK,
  similarityThreshold,
  maxContextTokens,
});
// ❌ 每次请求创建新 retriever，没有 hybrid 配置
```

**影响:** 即使 http-server 正确初始化 HybridRetriever，chat routes 也不会使用它，导致刷新后检索失效。

**同样问题存在于:**
- `/generate` 端点 (`chat.ts:246-250`)
- `/enhanced` 端点 (`chat.ts:463-466`)

---

#### 4. `app.ts`: MCP Server 缺少 Hybrid 配置

**设计要求 (第 89-109 行):**
```typescript
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
  } catch (error) { ... }
}
```

**当前代码 (`src/app.ts:89-101`):**
```typescript
this.hierarchicalStore = new HierarchicalStore();
const storeDataPath = path.resolve(__dirname, '../data/store');

const embeddingFactory = getEmbeddingFactory();
const embeddingService = embeddingFactory.createTextEmbeddingService();

this.retrieval = createMcpRetrievalService(
  this.hierarchicalStore,
  (text: string) => embeddingService.embedText(text)
);
// ❌ 没有 hybrid 配置逻辑
// ❌ 没有导入 getEmbeddingMode, getVectorStoreFactory, createHybridSmallToBigRetriever
```

**影响:** MCP Server 端点无法使用 Hybrid 模式检索，依赖内存 embeddings。

---

### Important

#### 1. `chat.ts`: 缺少 `HybridSmallToBigRetriever` 类型导入

**设计要求 (第 4 行后):**
```typescript
import type { HybridSmallToBigRetriever } from '../../retrieval/hybrid-small-to-big-retriever.js';
```

**当前代码:** 不存在该导入

---

#### 2. `embedding-factory.ts`: 缺少 hybrid mode 检测日志

**设计要求:** 添加 console.log 提示 hybrid mode 检测来源

**当前代码:** 无对应日志输出

---

#### 3. `app.ts`: 缺少必要的导入

**设计需要导入:**
- `getEmbeddingMode` from `./embedding/embedding-factory.js`
- `getVectorStoreFactory` from `./retrieval/vector-store-factory.js`
- `createHybridSmallToBigRetriever` from `./retrieval/hybrid-small-to-big-retriever.js`

**当前代码 (`src/app.ts:1-11`):** 仅导入 `getEmbeddingFactory`

---

### Minor

#### 1. `http-server.ts`: 初始化日志格式与设计略有差异

设计提议更详细的分步日志 (`[1/4]`, `[2/4]`, etc.)，当前为简单日志。

---

## 建议

### 修复优先级

1. **P0 - Critical** (修复刷新后检索失效的根本问题):
   - `http-server.ts`: 存储 `hybridRetriever` 和 `sharedRetriever` 到 fastify
   - `chat.ts`: 使用 `sharedRetriever` 替代每次创建新 retriever
   - `app.ts`: MCP Server 配置 Hybrid 模式

2. **P1 - Important**:
   - `embedding-factory.ts`: 添加 `EMBEDDING_MODE=hybrid` 直接检测
   - 添加必要的类型导入

3. **P2 - Minor**:
   - 统一日志格式

### 具体修复步骤

按照设计文档的实施步骤执行:
1. **Phase 1**: 修改 `embedding-factory.ts` - 添加 hybrid 检测
2. **Phase 2**: 修改 `http-server.ts` - 存储 HybridRetriever 和 SharedRetriever
3. **Phase 3**: 修改 `chat.ts` - 优先使用 SharedRetriever
4. **Phase 4**: 修改 `app.ts` - MCP Server 配置 Hybrid
5. **Phase 5**: 测试验证