## Context

当前架构中，文档处理流程如下：
1. `document-processor.ts` 调用 pipeline 进行文档解析、分块、embedding
2. Pipeline 的 `embedding-stage.ts` 使用 `TextEmbeddingService` 生成分块的 embedding
3. Embedding 结果存储在 `HierarchicalStore` 中
4. 检索时，`SmallToBigRetriever` 在 `chat.ts` 中被创建，但**没有设置 embeddingGenerator**

**问题根源**：`SmallToBigRetriever.getQueryEmbedding()` 方法在没有 embeddingGenerator 时使用 `syntheticEmbedding()` 生成的伪向量，与真实 embedding 进行余弦相似度计算，结果无意义。

**当前数据流**：
```
Query → syntheticEmbedding (1536维伪向量)
       → cosineSimilarity vs real embedding (1536维语义向量)
       → 低相似度分数 (< 0.3)
       → fallbackSearch 返回整个 parent chunk
```

## Goals / Non-Goals

**Goals:**
- 检索器使用真实 embedding 服务处理查询，确保语义相似度计算有意义
- 返回最相关的片段而非整篇文档
- 保持 API 兼容性，不影响现有接口

**Non-Goals:**
- 不改变分块策略（small/parent chunk 配置）
- 不改变 API 接口结构
- 不引入新的 embedding 模型或维度

## Decisions

### 1. Embedding 生成器注入方式

**决定**：在 HTTP server 初始化时创建 `TextEmbeddingService` 实例，通过 Fastify decorator 注入到 retriever。

**备选方案**：
- A) 在 `chat.ts` 中直接创建 `TextEmbeddingService` - **拒绝**：每次请求创建新实例，浪费资源
- B) 使用全局单例 - **拒绝**：不利于测试和配置灵活性
- C) Fastify decorator 注入 - **接受**：符合现有架构（hierarchicalStore 也是这样注入）

**实现路径**：
```typescript
// http-server.ts
fastify.decorate('embeddingService', new TextEmbeddingService());

// chat.ts
const embeddingService = fastify.embeddingService;
retriever.setEmbeddingGenerator(text => embeddingService.embedText(text));
```

### 2. Fallback 行为优化

**决定**：保留 fallback 机制但调整 threshold 和返回内容限制。

**当前配置**：
- `similarityThreshold`: 0.5（小分块匹配阈值）
- `fallbackThreshold`: 0.3（fallback 搜索阈值）
- `enableFallback`: true

**优化方案**：
- 提高 `fallbackThreshold` 到 0.4，减少低质量结果
- fallback 返回的 parent chunk 需满足 `maxContextTokens` 限制

### 3. 缓存策略

**决定**：利用 `SmallToBigRetriever` 内置的 `QueryCache` 缓存查询 embedding。

**实现**：
- 查询 embedding 缓存 TTL: 5分钟
- 最大缓存条目: 100
- 缓存命中时跳过 API 调用

## Risks / Trade-offs

### 1. API 调用延迟增加
- **风险**：每个查询需要调用 embedding API（约 50-200ms）
- **缓解**：QueryCache 减少重复查询的 API 调用；考虑后续添加异步预热缓存

### 2. Embedding 服务不可用
- **风险**：API 调用失败时检索无法工作
- **缓解**：添加错误处理，返回错误信息而非崩溃；保留 syntheticEmbedding 作为降级方案

### 3. 维度不匹配
- **风险**：如果 embedding 服务配置维度与存储不同，会导致计算错误
- **缓解**：在 `setEmbeddingGenerator` 时验证维度一致性