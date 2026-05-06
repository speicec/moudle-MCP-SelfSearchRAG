---
capability: retrieval-score-preservation
version: 1.0
created: 2026-04-27
---

# Spec: Retrieval Score Preservation

## 概述

在 RRF (Reciprocal Rank Fusion) 融合过程中保留原始 Dense Cosine 相似度得分，确保语义相关性信息不丢失，可供前端显示使用。

## ADDED Requirements

### Requirement: Dense score preservation in RRF fusion
The system SHALL preserve the original Dense vector Cosine similarity score during RRF fusion.

#### Scenario: Dense search result preserved
- **WHEN** Dense vector search returns a result with Cosine score
- **THEN** FusionResult.denseScore field contains the original Cosine similarity score
- **AND** score value is in range [0, 1]

#### Scenario: Dense score included in fusion output
- **WHEN** RRF fusion processes Dense search results
- **THEN** each FusionResult has denseScore populated for Dense-matched results
- **AND** denseScore remains unchanged from original search result

### Requirement: Sparse score preservation in RRF fusion
The system SHALL preserve the original Sparse BM25 score during RRF fusion.

#### Scenario: Sparse search result preserved
- **WHEN** Sparse vector search returns a result with BM25 score
- **THEN** FusionResult.sparseScore field contains the original BM25 score
- **AND** score value may be any positive number

### Requirement: Score preservation does not affect ranking
The system SHALL NOT use preserved scores for ranking calculations.

#### Scenario: RRF ranking unchanged
- **WHEN** RRF fusion calculates fused scores
- **THEN** ranking uses only rank position formula: score = Σ 1/(k + rank)
- **AND** preserved denseScore/sparseScore do not influence sort order

### Requirement: Semantic score propagation to parent expansion
The system SHALL propagate the best semantic score to parent-level results.

#### Scenario: Parent semantic score from max dense score
- **WHEN** multiple small chunks match the same parent
- **THEN** HybridSearchResult.semanticScore equals max(denseScore) of matched small chunks
- **AND** parentScore (RRF score) used for sorting

#### Scenario: Fallback for pure sparse matches
- **WHEN** parent result only has Sparse matches (no Dense match)
- **THEN** HybridSearchResult.semanticScore is undefined
- **AND** frontend displays "关键词匹配" instead of numeric similarity