## Context

当前系统使用 **Hybrid Retrieval（混合检索）** 架构，结合 Dense 向量搜索和 Sparse (BM25) 关键词搜索：

```
┌─────────────────────────────────────────────────────────────────┐
│                    当前数据流                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Query ──► HybridEmbeddingService                              │
│              ├── dense: number[1024]  (Cosine 相似度候选)        │
│              └── sparse: {indices, values}  (BM25 候选)         │
│                                                                 │
│        ──► Qdrant Search                                        │
│              ├── Dense Search → SearchResult.score ~0.85        │
│              └── Sparse Search → SearchResult.score ~12.5       │
│                                                                 │
│        ──► RRF Fusion                                           │
│              公式: score = Σ 1/(k + rank), k=60                 │
│              结果: FusionResult.score ~0.03                     │
│              ⚠️ 丢弃原始 dense/sparse score!                     │
│                                                                 │
│        ──► Parent Expansion                                     │
│              HybridSearchResult.parentScore ~0.03               │
│              ⚠️ 只有 RRF 得分                                    │
│                                                                 │
│        ──► Frontend                                             │
│              显示: "检索得分: 3%"                                │
│              ❌ 误导用户                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**核心问题**：RRF 算法只使用排名位置 (rank)，丢弃原始相似度得分。用户看到的 2%-3% 是排名融合得分，不是语义相似度。

**约束**：
- 不能修改 RRF 排序逻辑（已验证效果良好）
- 需要向后兼容（新增字段而非修改现有字段）
- Sparse BM25 得分没有直观含义（任意正数）

## Goals / Non-Goals

**Goals:**
- 在数据流中保留原始 Dense Cosine 相似度得分
- 前端显示真正有意义的"相似度"（如 85%）
- 保持 RRF 排序机制不变（仍用融合得分排序）
- 向后兼容现有 API 和数据结构

**Non-Goals:**
- 不修改 RRF 融合公式或排序策略
- 不显示 Sparse BM25 得分（无直观含义）
- 不修改 ConfidenceCalculator 的置信度计算逻辑
- 不修改 Qdrant 向量数据库配置

## Decisions

### Decision 1: 保留哪个原始得分？

**选择**：保留 Dense Cosine 相似度得分

**理由**：
- Cosine 相似度范围 [0, 1]，直观易理解
- 代表"语义相关性"，用户真正关心的指标
- Sparse BM25 得分是任意正数，无法直观解释

**替代方案**：
- 显示归一化后的 RRF 得分 ❌ 破坏 RRF 语义，归一化后值无意义
- 显示 Dense + Sparse 混合得分 ❌ 复杂度高，两个得分含义不同
- 同时显示三个得分 ❌ 用户困惑，信息过载

### Decision 2: 数据结构如何修改？

**选择**：在现有类型中新增可选字段

```
FusionResult {
  score: number;          // RRF 得分（排序用）
  denseScore?: number;    // 新增：原始 Dense Cosine 得分
  sparseScore?: number;   // 新增：原始 Sparse BM25 得分
}

HybridSearchResult {
  parentScore: number;        // RRF 得分（排序用）
  semanticScore?: number;     // 新增：语义相似度（显示用）
}
```

**理由**：
- 可选字段 → 向后兼容
- 语义清晰：`parentScore` 用于排序，`semanticScore` 用于显示
- 前端可按是否有 `semanticScore` 决定显示逻辑

### Decision 3: 前端如何命名？

**选择**：显示为"相似度"而非"检索得分"

**理由**：
- "相似度 85%" 直观：文献和问题语义相近程度
- "检索得分 3%" 困惑：用户不理解含义，误以为质量低

**文案改动**：
- 展开面板：`检索得分 → 相似度`
- ConfidenceBadge：保持百分比显示格式
- Tooltip：可选添加"基于语义向量匹配"

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Dense 和 Sparse 匹配的结果可能没有 denseScore | 使用 fallback：若无 denseScore 则不显示相似度 |
| 不同父块的计算策略可能导致语义得分不一致 | 明确策略：使用 `max(denseScore)` 作为父块语义得分 |
| 前端改动可能影响现有用户习惯 | 添加 Tooltip 解释"相似度"含义 |

**Trade-off**: 我们选择不显示 Sparse 得分，简化用户理解。代价是纯关键词匹配的结果可能没有"相似度"显示。这种情况可以使用 fallback：显示"关键词匹配"而非数值。