## Why

当前前端显示的"检索得分"（如 2%-3%）实际上是 **RRF (Reciprocal Rank Fusion) 排名融合得分**，而非真正的语义相似度。RRF 得分范围天然在 1%-4%，对用户而言没有直观含义——用户期望看到的是"这篇文献和我的问题有多相似"，而非"这条结果在融合排名中贡献了多少分数"。

这导致用户困惑："为什么检索得分这么低？文献质量有问题吗？"实际上检索质量可能很好（Cosine 相似度 85%），只是得分表示方式错误。

## What Changes

- **RRF 融合层**：在融合结果中保留原始 Dense 向量搜索的 Cosine 相似度得分和 Sparse 搜索的 BM25 得分
- **数据传递链**：将原始相似度得分沿数据流传递到前端显示层
- **前端显示**：将"检索得分"改为显示真正的语义相似度（Cosine 得分），而非 RRF 排名得分
- **命名修正**：前端 UI 文案从"检索得分"改为"相似度"或"匹配度"

## Capabilities

### New Capabilities

- `retrieval-score-preservation`: 在 RRF 融合过程中保留原始 Dense/Sparse 搜索得分，确保语义相似度信息不丢失

### Modified Capabilities

- `hybrid-retrieval`: 修改 HybridSearchResult 结构，增加 `semanticScore` 字段用于存储真正的 Cosine 相似度
- `retrieval-visualization`: 修改前端显示逻辑，将相似度得分（而非 RRF 得分）展示给用户

## Impact

**代码改动范围**：
- `src/retrieval/rrf-fusion.ts` - FusionResult 类型增加 `denseScore`、`sparseScore` 字段
- `src/retrieval/hybrid-small-to-big-retriever.ts` - HybridSearchResult 增加 `semanticScore` 字段
- `src/chunking/small-to-big-retriever.ts` - 传递语义相似度得分
- `src/retrieval/types.ts` - ConfidenceRetrievalResult 增加 `semanticScore` 字段
- `src/frontend/components/EvidencePanel.tsx` - 显示语义相似度而非 RRF 得分

**API 影响**：无破坏性变更，新增可选字段，向后兼容

**用户影响**：用户将看到有意义的相关性得分（如"85% 相似度"），而非难以理解的 RRF 排名得分