## Context

当前系统已实现完整的后端数据流：
- RRF Fusion 保留原始 denseScore/sparseScore
- HybridSmallToBigRetriever 计算 semanticScore = max(denseScore)
- Server Routes 正确传递 semanticScore 到前端

**缺失部分**：前端 TypeScript 类型定义未包含 `semanticScore` 字段，导致 WebSocket 传递的数据无法被前端组件访问。EvidencePanel 只能使用 similarityScore（RRF 排名得分），显示为 1%-4% 的无意义数值。

**数据流现状**：
```
后端: RetrievalResultItem.semanticScore ✅ 已传递
WebSocket: event.results[].semanticScore ✅ 已传递
前端类型: RetrievalResult.semanticScore ❌ 缺失
前端组件: 只能访问 similarityScore (RRF ~1.6%)
```

## Goals / Non-Goals

**Goals:**
- 在前端类型定义中添加 semanticScore 字段
- EvidenceCard 同时显示语义相似度（百分比）和 RRF 排名位置
- 添加 Tooltip 解释两个分数的含义差异
- 保持对无 semanticScore 结果的 fallback 显示（"关键词匹配"）

**Non-Goals:**
- 不修改 RRF 融合算法或排序逻辑
- 不修改后端数据传递（已正确实现）
- 不修改 ConfidenceCalculator 的置信度计算
- 不显示 Sparse BM25 得分（无直观含义）

## Decisions

### Decision 1: UI 显示布局

**选择**：双指标水平排列布局

```
┌─────────────────────────────────────────────────────────┐
│  EV-001  文献标题...                                     │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────┐            │
│  │ 相似度 85%   │  │ 排名 #1      │  │ A  │            │
│  │ ████████████ │  │ RRF 1.64%    │  │高质量│           │
│  └──────────────┘  └──────────────┘  └────┘            │
│                                                         │
│  [展开详情...]                                          │
└─────────────────────────────────────────────────────────┘
```

**理由**：
- 用户主要关心语义相似度 → 放在左侧，视觉优先
- RRF 排名是次要信息 → 放在中间，可选查看
- 质量评级是关键信息 → 放在右侧，保持原有位置

**替代方案**：
- 单指标显示（仅 semanticScore） ❌ 丢失排名信息
- 垂直堆叠 ❌ 占用过多垂直空间
- Tooltip 内隐藏 RRF ❌ 用户需要点击才能看到

### Decision 2: 类型定义修改策略

**选择**：在两个 store 文件中统一添加 semanticScore 字段

**理由**：
- `store/index.ts` 和 `store/retrievalStore.ts` 都定义了 RetrievalResult
- 两处定义需要保持一致，否则会导致类型不匹配
- 使用可选字段 `semanticScore?: number` 保持向后兼容

### Decision 3: 无 semanticScore 的 fallback 显示

**选择**：显示"关键词匹配"标签，同时显示 RRF 排名

**理由**：
- 纯 Sparse 搜索结果无 denseScore → 无 semanticScore
- 这种情况仍需显示有意义的信息："关键词匹配" + RRF 排名位置

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Dense 和 Sparse 匹配的结果可能没有 semanticScore | 使用 fallback："关键词匹配"标签 |
| 同时显示两个分数可能增加视觉复杂度 | 通过布局设计区分主次信息 |
| 现有用户可能习惯单一分数显示 | Tooltip 解释两个分数含义差异 |
| 类型定义修改可能影响其他组件 | 使用可选字段保持向后兼容 |