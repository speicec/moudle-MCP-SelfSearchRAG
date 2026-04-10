## Why

当前检索系统返回整篇文档而非最相关的片段，根本原因是 `SmallToBigRetriever` 未配置正确的 embedding 生成器，导致查询使用合成 embedding 与文档的真实 embedding 进行相似度计算。由于合成 embedding 是基于字符 hash 生成的伪向量，与语义 embedding 不兼容，相似度分数无法有效区分相关内容，触发 fallback 机制返回整个父分块（接近整篇文档）。

## What Changes

- **修复检索器 embedding 配置**：在 chat 路由中为 `SmallToBigRetriever` 设置真实的 embedding 生成器
- **优化 fallback 行为**：调整 fallback threshold 或限制 fallback 返回的内容大小
- **增强诊断能力**：添加检索过程的调试日志，便于追踪相似度分数和分块命中情况

## Capabilities

### New Capabilities
- `retrieval-embedding-config`: 配置检索器使用真实的 embedding 服务，确保查询向量与文档向量语义兼容

### Modified Capabilities
- `small-to-big-retrieval`: 调整 fallback 行为，避免返回过大内容块；增强相似度阈值配置

## Impact

**核心代码变更：**
- `src/server/routes/chat.ts`: 设置 `SmallToBigRetriever` 的 embeddingGenerator
- `src/chunking/small-to-big-retriever.ts`: 优化 fallback 逻辑，添加日志
- `src/chunking/config.ts`: 可能需要调整默认阈值

**依赖影响：**
- 需要在 HTTP server 初始化时注入 `TextEmbeddingService` 到 retriever
- 不影响现有 API 接口，仅改变检索质量

**风险点：**
- embedding API 调用会增加检索延迟（需考虑缓存策略）
- 需确保 embedding 服务正确初始化并可用