## ADDED Requirements

### Requirement: EvidenceCard displays GRADE evidence metadata
The system SHALL extend EvidenceCard component to display GRADE evidence metadata when available.

#### Scenario: EvidenceCard receives GRADE data
- **WHEN** EvidenceCard receives result with evidenceEvaluation
- **THEN** component displays GRADE badge instead of quality badge based on similarityScore
- **AND** badge shows grade (A/B/C/D) with literature type label

#### Scenario: EvidenceCard expanded view shows full metadata
- **WHEN** user expands EvidenceCard
- **THEN** expanded view shows: literatureType, sourceAuthority, timeWeight, compositeScore
- **AND** displays expirationWarning if present

#### Scenario: EvidenceCard shows authority indicator
- **WHEN** evidenceEvaluation contains sourceAuthority
- **THEN** EvidenceCard header shows authority level indicator
- **AND** indicator uses different icon for international/national/local

### Requirement: EvidencePanel shows GRADE statistics
The system SHALL extend EvidencePanel to show GRADE distribution statistics.

#### Scenario: EvidencePanel header shows grade distribution
- **WHEN** EvidencePanel receives results with evidenceEvaluation
- **THEN** header shows grade distribution bar chart (A/B/C/D segments)
- **AND** shows average compositeScore in statistics section

#### Scenario: EvidencePanel quality distribution chart
- **WHEN** results contain evidenceEvaluation
- **THEN** quality distribution chart uses GRADE grades instead of similarityScore-based grades
- **AND** chart labels show GRADE A/B/C/D

### Requirement: RetrievalResult type includes evidenceEvaluation
The system SHALL extend frontend RetrievalResult type to include optional evidenceEvaluation.

#### Scenario: RetrievalResult type extension
- **WHEN** frontend store processes retrieval results
- **THEN** RetrievalResult interface includes optional evidenceEvaluation field
- **AND** evidenceEvaluation type matches backend EvidenceEvaluation interface

#### Scenario: Store handles results with or without GRADE
- **WHEN** WebSocket event contains results
- **THEN** store handles both results with evidenceEvaluation and without
- **AND** components gracefully handle missing evidenceEvaluation

### Requirement: AnswerCard displays overall evidence grade
The system SHALL display overall evidence grade in AnswerCard footer.

#### Scenario: AnswerCard shows evidence grade summary
- **WHEN** answer includes evidenceGrade field
- **THEN** AnswerCard footer displays "证据等级: GRADE X" with description
- **AND** shows number of sources per grade level

#### Scenario: AnswerCard shows conflict warning
- **WHEN** evidenceStatistics.conflictDetected is true
- **THEN** AnswerCard displays conflict warning in warnings section
- **AND** warning highlights conflicting sources