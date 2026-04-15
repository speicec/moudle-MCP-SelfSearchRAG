## Why

当前文档分块处理流程中，所有 chunk 的质量分数（`qualityScore`）都被硬编码为 0.5，而不是根据内容进行真实评估。`ChunkQualityFilter` 类及其 `evaluate()` 方法已经实现，但从未被集成到实际的处理流程中。这导致：
1. 前端显示的质量分布图表无意义（所有块都是 0.5）
2. 无法过滤低质量内容（如重复文本、不完整句子）
3. "Small-to-Big" 检索的质量排序功能失效

## What Changes

- 在 `document-processor.ts` 的 `storeInHierarchical()` 函数中集成 `ChunkQualityFilter`
- 计算文档整体 embedding 作为质量评估的参照点
- 对每个 chunk 执行真实质量评估，替换硬编码的 `createDefaultQualityScore()`
- 聚合文档 embedding 并调用 `setDocumentEmbedding()` 以计算 `documentRelevance` 维度

## Capabilities

### New Capabilities
- `chunk-quality-evaluation`: 文档分块质量真实评估功能，包含四个维度的计算（信息密度、重复比率、语义完整性、文档相关性）

### Modified Capabilities
- `hierarchical-chunking`: 分块存储流程需要集成质量评估步骤

## Impact

**核心修改文件：**
- `src/server/document-processor.ts`: 集成 `ChunkQualityFilter`，修改 `storeInHierarchical()` 函数

**依赖已有实现：**
- `src/chunking/quality-filter.ts`: `ChunkQualityFilter.evaluate()` 方法
- `src/chunking/utils.ts`: `aggregateEmbeddings()`, `cosineSimilarity()` 等辅助函数

**前端影响：**
- `src/frontend/components/ChunkExplorer.tsx`: 质量分数将显示真实值而非 0.5
- `src/frontend/components/StatsDashboard.tsx`: 质量分布图表将显示真实的 high/medium/low 分布

**API 影响：**
- `/api/documents/:id/chunks`: 返回的 `qualityScore` 将反映真实评估结果
- `/api/stats`: `qualityDistribution` 和 `avgQualityScore` 将有真实数据