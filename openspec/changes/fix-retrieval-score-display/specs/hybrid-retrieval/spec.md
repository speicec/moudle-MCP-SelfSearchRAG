---
capability: hybrid-retrieval
version: 1.1
created: 2026-04-27
delta: true
---

# Spec: Hybrid Retrieval (Delta)

## Overview

在现有 Hybrid Retrieval 架构上增加语义相似度得分保留能力，确保前端能显示有意义的语义匹配度。

## MODIFIED Requirements

### Requirement: FusionResult includes original search scores
FusionResult 结构 SHALL 包含原始 Dense 和 Sparse 搜索得分。

#### Scenario: Dense score stored in fusion result
- **WHEN** Dense search returns result with Cosine score (e.g., 0.85)
- **THEN** FusionResult.denseScore equals the original Cosine score
- **AND** denseScore is in range [0, 1]

#### Scenario: Sparse score stored in fusion result
- **WHEN** Sparse search returns result with BM25 score
- **THEN** FusionResult.sparseScore equals the original BM25 score
- **AND** sparseScore may be any positive number

#### Scenario: Scores preserved without affecting ranking
- **WHEN** RRF fusion calculates fused score for ranking
- **THEN** fused score still uses formula: 1/(k + rank)
- **AND** denseScore and sparseScore do not influence sort order

### Requirement: HybridSearchResult includes semantic score
HybridSearchResult 结构 SHALL 包含语义相似度得分用于前端显示。

#### Scenario: Semantic score from max dense score
- **WHEN** parent expansion groups multiple small chunk matches
- **THEN** HybridSearchResult.semanticScore equals max(denseScore) across matched small chunks
- **AND** parentScore (RRF score) is used for result sorting

#### Scenario: No semantic score for pure sparse match
- **WHEN** result only has Sparse match (no Dense match)
- **THEN** HybridSearchResult.semanticScore is undefined or null
- **AND** frontend should display "关键词匹配" instead of percentage

## ADDED Requirements

### Requirement: Frontend displays semantic similarity
前端 SHALL 显示语义相似度得分而非 RRF 融合得分。

#### Scenario: Semantic score displayed when available
- **WHEN** result has semanticScore defined
- **THEN** frontend displays "相似度: X%" (e.g., "相似度: 85%")
- **AND** percentage is calculated as semanticScore * 100

#### Scenario: Keyword match displayed when no semantic score
- **WHEN** result has no semanticScore (pure sparse match)
- **THEN** frontend displays "关键词匹配" label
- **AND** no percentage value is shown

#### Scenario: Tooltip explains score meaning
- **WHEN** user hovers over similarity score
- **THEN** tooltip shows "基于语义向量匹配"
- **AND** explains the score represents semantic relevance