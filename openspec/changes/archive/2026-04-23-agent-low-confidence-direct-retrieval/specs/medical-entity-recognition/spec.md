## ADDED Requirements

### Requirement: Confidence threshold for execution mode selection
The system SHALL provide configurable threshold to determine when to skip Agent loop.

#### Scenario: Low confidence threshold configuration
- **WHEN** AgentExecutor config includes lowConfidenceThreshold
- **THEN** threshold is used to determine direct retrieval trigger

#### Scenario: Confidence value in MedicalEntities
- **WHEN** extractMedicalEntities returns MedicalEntities
- **THEN** confidence field is available for threshold comparison

#### Scenario: Confidence calculation preserved
- **WHEN** entity count is zero
- **THEN** confidence is 0.2 (existing behavior preserved)
- **WHEN** entity count is one
- **THEN** confidence is 0.5 (existing behavior preserved)