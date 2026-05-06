---
capability: retrieval-visualization
version: 1.1
created: 2026-04-27
delta: true
---

# Spec: Retrieval Visualization (Delta)

## Overview

在检索可视化中增加语义相似度得分显示，替代原来误导性的 RRF 融合得分显示。

## MODIFIED Requirements

### Requirement: Evidence score display uses semantic similarity
前端证据面板 SHALL 显示语义相似度得分而非 RRF 融合得分。

#### Scenario: Semantic score displayed when available
- **WHEN** evidence result has semanticScore defined
- **THEN** frontend displays "相似度: X%" (e.g., "相似度: 85%")
- **AND** percentage calculated from semanticScore * 100

#### Scenario: Keyword match label for sparse-only results
- **WHEN** evidence result has no semanticScore (sparse-only match)
- **THEN** frontend displays "关键词匹配" badge
- **AND** no percentage value displayed

#### Scenario: Quality grade based on semantic score
- **WHEN** calculating quality grade (A/B/C/D)
- **THEN** grade uses semanticScore thresholds (≥85%→A, ≥70%→B, ≥50%→C)
- **AND** fallback to confidenceLevel if semanticScore unavailable

## ADDED Requirements

### Requirement: Score label renamed from "检索得分" to "相似度"
前端 UI 文案 SHALL 使用"相似度"而非"检索得分"作为标签。

#### Scenario: Metadata section label change
- **WHEN** evidence card expanded view shows metadata
- **THEN** score field labeled as "相似度" (not "检索得分")
- **AND** value shows percentage format (e.g., "85.0%")

#### Scenario: Tooltip explains score meaning
- **WHEN** user hovers over similarity score
- **THEN** tooltip shows "基于语义向量匹配"
- **AND** helps user understand the score represents semantic relevance

### Requirement: Confidence bar reflects semantic score
前端置信度条 SHALL 反映语义相似度而非 RRF 得分。

#### Scenario: Confidence bar width from semanticScore
- **WHEN** rendering confidence bar visualization
- **THEN** bar width equals semanticScore * 100%
- **AND** bar color reflects quality grade (A→green, B→blue, C→yellow, D→gray)

#### Scenario: Confidence bar fallback for sparse-only
- **WHEN** result has no semanticScore
- **THEN** confidence bar shows fixed width (e.g., 50%)
- **AND** displays "关键词匹配" badge alongside