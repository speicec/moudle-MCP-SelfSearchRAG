## Why

当前前端类型定义缺少 `semanticScore` 字段，导致 WebSocket 传递的语义相似度数据无法被前端识别。用户只能看到 RRF 融合排名得分（约 1%-4%），这个数值对用户毫无直观含义——用户期望看到"这篇文献和我的问题有多相似"，而非"这条结果在融合排名中贡献了多少分数"。

例如：用户搜索"加班"看到"相关度 1.6%"，实际上语义相似度可能是 85%，只是显示的是 RRF 排名得分。

**改进目标**：同时展示两个指标，让用户既能看到语义相似度（直观理解相关性），又能看到 RRF 排名位置（理解检索排序逻辑）。

## What Changes

- **前端类型定义**：在 `store/index.ts` 和 `store/retrievalStore.ts` 的 `RetrievalResult` 类型中添加 `semanticScore?: number` 字段
- **前端 UI 显示**：EvidenceCard 组件同时显示：
  - 语义相似度（semanticScore）：以百分比形式显示，如"相似度 85%"
  - RRF 排名得分（similarityScore）：以次要标签显示，如"排名 #1"
- **工具提示增强**：添加 Tooltip 解释两个分数的含义差异

## Capabilities

### New Capabilities

- `dual-score-display`: EvidenceCard 同时展示语义相似度和 RRF 排名得分，帮助用户理解检索结果的语义相关性（Cosine）和融合排名位置

### Modified Capabilities

- `retrieval-visualization`: 增加要求：前端需接收并显示 semanticScore 字段
- `grade-evidence-display`: 增加要求：当无 semanticScore 时显示"关键词匹配"标签，有 semanticScore 时同时显示语义相似度百分比

## Impact

**代码改动范围**：
- `src/frontend/store/index.ts` - RetrievalResult 类型添加 semanticScore 字段
- `src/frontend/store/retrievalStore.ts` - RetrievalResult 类型添加 semanticScore 字段
- `src/frontend/components/EvidencePanel.tsx` - EvidenceCard 同时显示两个分数
- `src/frontend/types/visualization.ts` - 可能需要添加相关类型定义

**API 影响**：无破坏性变更，后端已正确传递 semanticScore

**用户影响**：用户将看到有意义的相关性得分（如"相似度 85% + 排名 #1"），而非仅看到难以理解的 RRF 排名得分