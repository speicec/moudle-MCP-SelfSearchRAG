## Phase 1: 质量评估集成（已完成）

### 1. Import and Setup
- [x] 1.1 Add imports in `document-processor.ts`: `ChunkQualityFilter`, `createChunkQualityFilter`, `aggregateEmbeddings` from chunking module

### 2. Core Implementation
- [x] 2.1 Modify `storeInHierarchical()` to create `ChunkQualityFilter` instance with default config
- [x] 2.2 Collect all chunk embeddings before creating hierarchical chunks
- [x] 2.3 Aggregate embeddings using `aggregateEmbeddings()` to compute document embedding
- [x] 2.4 Call `qualityFilter.setDocumentEmbedding(documentId, docEmbedding)` before evaluating chunks
- [x] 2.5 Replace `createDefaultQualityScore()` with `qualityFilter.evaluate(chunk)` for each chunk

### 3. Logging and Debugging
- [x] 3.1 Add logging for document embedding computation (documentId, embedding dimension)
- [x] 3.2 Add logging for quality evaluation results (avg composite, dimension breakdown)

---

## Phase 2: 质量分数传递修复（已完成）

### 4. 类型定义扩展
- [x] 4.1 在 `src/chunking/types.ts` 的 `HierarchicalRetrievalResult` 添加可选字段 `qualityScore?: QualityScore`

### 5. 检索层传递
- [x] 5.1 在 `src/chunking/small-to-big-retriever.ts` 的 `searchSmallChunks()` 方法中，从 chunk 读取 `qualityScore` 并赋值到 result
- [x] 5.2 确保 `expandToParents()` 方法保持 `qualityScore` 字段不被丢失（spread 语法自动保留）

### 6. 置信度结果传递
- [x] 6.1 在 `src/retrieval/types.ts` 扩展 `createDefaultConfidenceResult()` 参数，添加可选 `qualityScore?: QualityScore | undefined`
- [x] 6.2 在函数内部，从 `qualityScore?.composite` 提取值赋给 `chunkQualityScore`
- [x] 6.3 如果未提供 `qualityScore`，保持 fallback 行为（使用 0）
- [x] 6.4 修改 `convertToConfidenceResults()` 传递 qualityScore 参数

### 7. 置信度计算器更新
- [x] 7.1 `calculateChunkQualityScore()` 已正确实现优先使用传入值

### 8. 构建和测试
- [x] 8.1 构建项目成功：`npm run build`
- [x] 8.2 运行 chunking 模块测试：38 tests passed
- [x] 8.3 运行 retrieval 核心测试：confidence-calculator, local-reranker, dynamic-topk 全部通过
- [x] 8.4 修复相关测试用例 bug（测试期望值不匹配）

---

## Summary

**修复完成：质量分数传递链条现已完整**

```
HierarchicalChunk.qualityScore
        ↓ (searchSmallChunks)
HierarchicalRetrievalResult.qualityScore
        ↓ (convertToConfidenceResults)
ConfidenceRetrievalResult.chunkQualityScore = qualityScore.composite
        ↓ (ConfidenceCalculator)
置信度计算 20% chunkQuality 权重恢复工作
```

**置信度计算恢复：**
- similarity: 0.5 ✓
- keywordMatch: 0.2 ✓
- position: 0.1 ✓
- chunkQuality: 0.2 ✓ (之前失效，现已恢复)

**测试状态：**
- chunking: 38 passed
- confidence-calculator: 22 passed
- local-reranker: 21 passed
- dynamic-topk-calculator: 29 passed
- 其他测试失败与本次修复无关（现有 bug）