## MODIFIED Requirements

### Requirement: Frontend falls back to similarity score when no GRADE data
The system SHALL fall back to appropriate score display when backend does not provide GRADE evaluation.

#### Scenario: No GRADE data with semanticScore
- **WHEN** backend returns result without evidenceEvaluation but with semanticScore
- **THEN** EvidenceCard uses semanticScore to determine grade via getEvidenceQuality(semanticScore)
- **AND** displays "相似度" label with semanticScore percentage
- **AND** displays RRF ranking as secondary information

#### Scenario: No GRADE data and no semanticScore
- **WHEN** backend returns result without evidenceEvaluation and without semanticScore
- **THEN** EvidenceCard displays "关键词匹配" label
- **AND** displays RRF ranking as "#N 排名"
- **AND** grade determined from similarityScore (RRF) threshold

#### Scenario: Partial GRADE data fallback
- **WHEN** backend returns evidenceEvaluation with only grade field (no literatureType)
- **THEN** EvidenceCard displays grade badge
- **AND** does not display literature type section
- **AND** still displays semantic score if available