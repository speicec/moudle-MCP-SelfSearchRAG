## ADDED Requirements

### Requirement: WebSocket retrieval:complete event includes GRADE evaluation
The system SHALL include evidenceEvaluation field in retrieval:complete event results.

#### Scenario: Retrieval result with GRADE evaluation
- **WHEN** retrieval:complete event is broadcast
- **THEN** each result in results array includes optional evidenceEvaluation object
- **AND** evidenceEvaluation contains: literatureType, grade, sourceAuthority, compositeScore, timeWeight, consistencyScore, isCurrent, expirationWarning

#### Scenario: GRADE evaluation computed per result
- **WHEN** Agent completes retrieval phase
- **THEN** system calls evaluateMultipleSourcesEnhanced() for all retrieval results
- **AND** attaches evidenceEvaluation to each result before broadcasting

### Requirement: WebSocket generation:complete event includes overall GRADE
The system SHALL include overall evidence grade in generation:complete event.

#### Scenario: Generation complete with overall grade
- **WHEN** generation:complete event is broadcast
- **THEN** event includes overallEvidenceGrade field (A/B/C/D)
- **AND** overallEvidenceGrade is calculated as highest grade from all evidence

#### Scenario: Generation complete with evidence statistics
- **WHEN** generation:complete event is broadcast
- **THEN** event includes evidenceStatistics object
- **AND** evidenceStatistics contains: totalSources, gradeDistribution, averageCompositeScore, conflictDetected

#### Scenario: Conflict warning in generation event
- **WHEN** evidence consistency check detects conflict
- **THEN** generation:complete event includes conflictWarning field
- **AND** conflictWarning describes the conflicting sources

### Requirement: WebSocket agent events include evidence evaluation
The system SHALL include evidence evaluation in Agent-related WebSocket events.

#### Scenario: Agent evidence:evaluated event
- **WHEN** Agent evaluates retrieved evidence
- **THEN** system broadcasts evidence:evaluated event
- **AND** event contains: evidenceArray, overallGrade, consistencyScore, timestamp

#### Scenario: Evidence event after retrieval
- **WHEN** retrieval:complete event is broadcast in Agent mode
- **THEN** evidence:evaluated event follows within 100ms
- **AND** client can display GRADE data before generation starts