---
capability: low-confidence-direct-retrieval
version: 1.0
created: 2026-04-23
---

# Spec: Low Confidence Direct Retrieval

## Requirements

### Requirement: Low confidence query triggers direct retrieval
The system SHALL skip Agent ReAct loop when entity recognition confidence is below threshold.

#### Scenario: Zero entity query triggers direct retrieval
- **WHEN** user query contains no medical entities (confidence = 0.2)
- **AND** lowConfidenceThreshold is 0.3 (default)
- **THEN** system executes direct retrieval using rawQuery
- **AND** Agent ReAct loop is NOT executed
- **AND** execution mode is set to 'direct_retrieval'

#### Scenario: Single entity query enters normal Agent flow
- **WHEN** user query contains one medical entity (confidence = 0.5)
- **AND** lowConfidenceThreshold is 0.3
- **THEN** system executes normal Agent flow (ReAct or Planning)
- **AND** direct retrieval is NOT triggered

#### Scenario: Threshold boundary case
- **WHEN** user query confidence equals lowConfidenceThreshold
- **THEN** system executes normal Agent flow (threshold check uses strict less than)

#### Scenario: Custom threshold configuration
- **WHEN** lowConfidenceThreshold is configured to 0.4
- **AND** user query confidence is 0.35
- **THEN** system executes direct retrieval

### Requirement: Direct retrieval uses rawQuery
The system SHALL use original user query for retrieval in direct retrieval mode.

#### Scenario: Direct retrieval query selection
- **WHEN** direct retrieval mode is triggered
- **THEN** retrieval query is rawQuery from MedicalEntities
- **AND** no query rewriting or expansion is applied

#### Scenario: Direct retrieval returns results
- **WHEN** direct retrieval is executed with non-empty rawQuery
- **THEN** system returns retrieval results
- **AND** results count is recorded in AgentResult.stats

#### Scenario: Direct retrieval with empty rawQuery
- **WHEN** direct retrieval is triggered but rawQuery is empty string
- **THEN** system returns empty results
- **AND** AgentResult.success is false

### Requirement: Direct retrieval generates answer
The system SHALL generate answer after direct retrieval.

#### Scenario: Answer generation with results
- **WHEN** direct retrieval returns non-empty results
- **THEN** system calls reasoner.generateAnswer with results
- **AND** AgentResult contains generated answer

#### Scenario: Answer generation without results
- **WHEN** direct retrieval returns empty results
- **THEN** system calls reasoner.generateAnswer with empty results
- **AND** answer indicates no relevant information found

### Requirement: Low confidence threshold configuration
The system SHALL provide configurable confidence threshold for direct retrieval trigger.

#### Scenario: Default threshold value
- **WHEN** lowConfidenceThreshold is not configured
- **THEN** system uses default value 0.3

#### Scenario: Threshold in ExtendedAgentConfig
- **WHEN** ExtendedAgentConfig includes lowConfidenceThreshold
- **THEN** threshold value is applied for confidence check

#### Scenario: Threshold validation
- **WHEN** lowConfidenceThreshold is configured outside [0, 1] range
- **THEN** system uses default value 0.3 (invalid values ignored)

### Requirement: Direct retrieval preserves visualization events
The system SHALL emit WebSocket events for direct retrieval mode.

#### Scenario: agent:input event
- **WHEN** direct retrieval mode is triggered
- **THEN** system emits agent:input event with original query

#### Scenario: agent:entities event
- **WHEN** entities are recognized (even with low confidence)
- **THEN** system emits agent:entities event with entity data

#### Scenario: agent:mode event with direct_retrieval
- **WHEN** direct retrieval mode is selected
- **THEN** system emits agent:mode event with mode: 'direct_retrieval'
- **AND** reason includes confidence value

#### Scenario: agent:complete event
- **WHEN** direct retrieval completes
- **THEN** system emits agent:complete event with AgentResult