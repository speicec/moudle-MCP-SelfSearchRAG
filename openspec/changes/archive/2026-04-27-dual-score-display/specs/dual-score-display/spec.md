## ADDED Requirements

### Requirement: EvidenceCard displays semantic similarity score
The system SHALL display semantic similarity score (Dense Cosine) in EvidenceCard component when semanticScore is available.

#### Scenario: Semantic score displayed with percentage
- **WHEN** retrieval result has semanticScore field (e.g., 0.85)
- **THEN** EvidenceCard displays "相似度 85%" in primary score section
- **AND** score bar fills to 85% width
- **AND** tooltip shows "基于语义向量匹配"

#### Scenario: Semantic score determines quality grade
- **WHEN** semanticScore is available (e.g., 0.85)
- **THEN** quality grade calculated from semanticScore threshold (A: ≥85%, B: ≥70%, C: ≥50%, D: <50%)
- **AND** grade badge displays alongside semantic score

#### Scenario: No semantic score fallback
- **WHEN** retrieval result has no semanticScore field (sparse-only match)
- **THEN** EvidenceCard displays "关键词匹配" label in primary score section
- **AND** score bar shows fixed 50% with different style (keyword-match class)

### Requirement: EvidenceCard displays RRF ranking score
The system SHALL display RRF fusion ranking score as secondary information in EvidenceCard component.

#### Scenario: RRF score displayed as ranking position
- **WHEN** retrieval result has similarityScore field (RRF score)
- **THEN** EvidenceCard displays "排名 #N" label in secondary score section
- **AND** RRF percentage shown as "RRF X.X%" in smaller text
- **AND** tooltip explains "RRF 融合排名得分，用于排序结果"

#### Scenario: RRF score sorting indication
- **WHEN** multiple results are displayed
- **THEN** RRF ranking numbers (#1, #2, #3...) indicate sort order
- **AND** user understands results are sorted by RRF score

### Requirement: Dual score display layout
The system SHALL display semantic similarity and RRF score in distinct visual sections.

#### Scenario: Horizontal layout with priority
- **WHEN** EvidenceCard renders both scores
- **THEN** semantic score section positioned on left (primary visual priority)
- **AND** RRF ranking section positioned in middle (secondary information)
- **AND** quality grade badge positioned on right

#### Scenario: Visual distinction between scores
- **WHEN** dual scores are displayed
- **THEN** semantic score uses filled progress bar (████████)
- **AND** RRF score uses plain text label without bar
- **AND** clear visual separation between two score sections

### Requirement: Tooltip explains score meanings
The system SHALL provide tooltips explaining the difference between semantic score and RRF score.

#### Scenario: Semantic score tooltip
- **WHEN** user hovers over semantic score section
- **THEN** tooltip displays "语义相似度：基于向量匹配，反映内容与查询的相关程度"
- **AND** tooltip shown on hover delay of 500ms

#### Scenario: RRF score tooltip
- **WHEN** user hovers over RRF ranking section
- **THEN** tooltip displays "RRF 排名：融合 Dense+Sparse 搜索排名，用于排序结果顺序"
- **AND** tooltip mentions score range 1%-4% is normal

#### Scenario: Keyword match tooltip
- **WHEN** user hovers over "关键词匹配" label
- **THEN** tooltip displays "关键词匹配：仅通过 BM25 关键词搜索匹配，无语义相似度"