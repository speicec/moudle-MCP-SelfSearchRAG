## ADDED Requirements

### Requirement: Frontend receives semanticScore from WebSocket
The system SHALL accept and process semanticScore field from WebSocket retrieval events.

#### Scenario: semanticScore received in retrieval:complete event
- **WHEN** WebSocket receives retrieval:complete event with results
- **THEN** frontend store processes semanticScore field for each result
- **AND** semanticScore stored in RetrievalResult type

#### Scenario: semanticScore passed to EvidencePanel
- **WHEN** ChatStore sets currentSources from retrieval results
- **THEN** EvidencePanel receives results with semanticScore field
- **AND** EvidenceCard can access semanticScore for display

### Requirement: Frontend RetrievalResult type includes semanticScore
The system SHALL define semanticScore as optional field in frontend RetrievalResult type.

#### Scenario: Type definition in store/index.ts
- **WHEN** RetrievalResult interface is defined in store/index.ts
- **THEN** interface includes `semanticScore?: number` field
- **AND** type is compatible with backend RetrievalResultItem

#### Scenario: Type definition in retrievalStore.ts
- **WHEN** RetrievalResult interface is defined in retrievalStore.ts
- **THEN** interface includes `semanticScore?: number` field
- **AND** type matches store/index.ts definition