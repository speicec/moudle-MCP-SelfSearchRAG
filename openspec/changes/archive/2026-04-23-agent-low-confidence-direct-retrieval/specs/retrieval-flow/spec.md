## ADDED Requirements

### Requirement: RetrievalFlow handles direct_retrieval mode event
The system SHALL display direct retrieval mode when agent:mode event has mode 'direct_retrieval'.

#### Scenario: agent:mode event with direct_retrieval
- **WHEN** frontend receives agent:mode event with mode: 'direct_retrieval'
- **THEN** retrievalStore sets executionMode to 'direct_retrieval'
- **AND** displays simplified flow (no ReAct loop visualization)

#### Scenario: Direct retrieval mode display
- **WHEN** executionMode is 'direct_retrieval'
- **THEN** system shows: input → entities → direct retrieval → complete
- **AND** no iteration or think/act/observe steps displayed

#### Scenario: Direct retrieval reason display
- **WHEN** agent:mode event includes reason with confidence value
- **THEN** system displays reason explaining low confidence trigger