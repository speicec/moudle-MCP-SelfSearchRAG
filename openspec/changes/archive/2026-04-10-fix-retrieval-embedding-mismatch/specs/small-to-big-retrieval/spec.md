## ADDED Requirements

### Requirement: Fallback search threshold optimization
The fallback search mechanism SHALL use an optimized threshold to prevent returning low-quality results.

#### Scenario: Fallback threshold at 0.4
- **WHEN** the primary search returns no results above similarity threshold
- **THEN** the fallback search SHALL use a threshold of 0.4
- **AND** results below 0.4 SHALL be excluded

#### Scenario: Fallback returns limited context
- **WHEN** fallback search returns parent chunks
- **THEN** the assembled context SHALL respect `maxContextTokens` limit
- **AND** partial parent chunks SHALL NOT be returned (only complete chunks)

### Requirement: Retrieval debugging logs
The retrieval process SHALL produce diagnostic logs for debugging similarity scores and chunk matching.

#### Scenario: Similarity scores logged
- **WHEN** retrieval completes
- **THEN** the system SHALL log the top similarity scores
- **AND** the system SHALL log the number of small chunks matched

#### Scenario: Fallback trigger logged
- **WHEN** fallback search is triggered
- **THEN** the system SHALL log the reason (no primary results)
- **AND** the system SHALL log the fallback results count

### Requirement: Query embedding error handling
The system SHALL gracefully handle errors from the embedding service.

#### Scenario: Embedding API failure
- **WHEN** the embedding service call fails
- **THEN** the system SHALL return an error response to the client
- **AND** the system SHALL NOT use synthetic embedding as fallback
- **AND** the system SHALL log the error with stack trace

#### Scenario: Embedding timeout
- **WHEN** the embedding service call exceeds timeout threshold
- **THEN** the system SHALL cancel the request
- **AND** return a timeout error to the client