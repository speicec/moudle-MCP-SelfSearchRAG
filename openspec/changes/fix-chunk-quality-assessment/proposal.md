## Why

当前系统存在两个层级的问题导致检索质量失效：

### 问题层级1（已修复）：质量评估未被调用
文档处理流程中，`ChunkQualityFilter.evaluate()` 从未被调用，所有 chunk 的 `qualityScore` 硬编码为 0.5。

### 问题层级2（核心问题）：质量分数传递链条断裂 ⚠️

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    质量分数流转断裂点                                    │
└─────────────────────────────────────────────────────────────────────────┘

    HierarchicalChunk               HierarchicalRetrievalResult      ConfidenceRetrievalResult
    (chunking/types.ts:53)          (chunking/types.ts:133)         (retrieval/types.ts:73)
           │                              │                              │
           ▼                              ▼                              ▼
    ┌─────────────────┐            ┌──────────────────────┐       ┌──────────────────────┐
    │ qualityScore:   │            │ ❌ 没有 qualityScore  │       │ chunkQualityScore:   │
    │ QualityScore    │───────────▶│ 字段                  │──────▶│ = 0 (硬编码)         │
    │ {               │            │                      │       │                      │
    │   composite,    │   断裂点1  │                      │       │                      │
    │   dimensions    │            │                      │       │                      │
    │ }               │            │                      │       │                      │
    └─────────────────┘            └──────────────────────┘       └──────────────────────┘
```

**后果：**
- 置信度计算中 20% 权重（chunkQuality）完全失效
- `ConfidenceCalculator.calculateChunkQualityScore()` 只能 fallback 到 `boundaryConfidence`
- 高质量和低质量 chunk 获得相同置信度排序
- 检索返回无关结果无法被质量维度过滤

## What Changes

### Phase 1（已完成）：质量评估集成
- 在 `document-processor.ts` 集成 `ChunkQualityFilter`
- 对每个 chunk 执行真实质量评估

### Phase 2（待实施）：质量分数传递修复
- `HierarchicalRetrievalResult` 添加 `qualityScore?: QualityScore` 字段
- `SmallToBigRetriever.searchSmallChunks()` 从 chunk 读取并传递
- `createDefaultConfidenceResult()` 参数类型扩展接收 `qualityScore`
- `ConfidenceCalculator` 正确使用 `qualityScore.composite`

## Capabilities

### Modified Capabilities
- `hierarchical-chunking`: 分块存储流程集成质量评估（已完成）
- `small-to-big-retrieval`: 检索结果传递质量分数（待实施）
- `confidence-calculation`: 置信度计算正确使用质量分数（待实施）

## Impact

**核心修改文件：**
- `src/chunking/types.ts`: `HierarchicalRetrievalResult` 添加 qualityScore 字段
- `src/chunking/small-to-big-retriever.ts`: `searchSmallChunks()` 传递 qualityScore
- `src/retrieval/types.ts`: `createDefaultConfidenceResult()` 参数扩展
- `src/retrieval/confidence-calculator.ts`: 使用传入的质量分数

**置信度权重恢复：**
```typescript
confidenceWeights: {
  similarity: 0.5,      // ✓ 正常
  keywordMatch: 0.2,    // ✓ 正常
  position: 0.1,        // ✓ 正常
  chunkQuality: 0.2,    // ⚠️ 当前失效 → 修复后恢复
}
```