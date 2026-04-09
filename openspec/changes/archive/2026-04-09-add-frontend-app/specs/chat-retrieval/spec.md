## ADDED Requirements

### Requirement: Chat query API processes retrieval requests
The system SHALL provide HTTP API endpoint for chat-based retrieval queries.

#### Scenario: Query submission
- **WHEN** client POSTs query to /api/chat/query
- **THEN** system processes query using Small-to-Big retrieval and returns results

#### Scenario: Query with document scope
- **WHEN** client POSTs query with documentIds parameter
- **THEN** system restricts retrieval to specified documents

#### Scenario: Empty query rejection
- **WHEN** client POSTs empty query
- **THEN** system returns 400 error with message

### Requirement: Retrieval uses Small-to-Big strategy
The system SHALL use existing SmallToBigRetriever for query processing.

#### Scenario: Small chunk search
- **WHEN** query is received
- **THEN** system searches in small chunks for precise matching

#### Scenario: Parent chunk expansion
- **WHEN** small chunks are matched
- **THEN** system expands to parent chunks for full context

#### Scenario: Result ranking
- **WHEN** results are expanded
- **THEN** system ranks by similarity score descending

### Requirement: Chat result format includes context
The system SHALL return retrieval results with full parent chunk content.

#### Scenario: Result structure
- **WHEN** retrieval completes
- **THEN** system returns array of results with smallChunkId, parentChunkContent, similarityScore, and sourceDocumentId

#### Scenario: Context assembly
- **WHEN** multiple results are returned
- **THEN** system includes assembled context text with token count

#### Scenario: Result truncation indication
- **WHEN** assembled context exceeds token limit
- **THEN** system includes truncated flag in response

### Requirement: Chat history is maintained per session
The system SHALL maintain chat history for each frontend session.

#### Scenario: History storage
- **WHEN** query is submitted
- **THEN** system stores query and response in session history

#### Scenario: History retrieval
- **WHEN** client requests /api/chat/history
- **THEN** system returns recent queries and responses for session

#### Scenario: History clear
- **WHEN** client DELETEs /api/chat/history
- **THEN** system clears session chat history

### Requirement: Query embedding generation
The system SHALL generate embedding for query text.

#### Scenario: Embedding generation
- **WHEN** query is received
- **THEN** system generates embedding using configured embedding service

#### Scenario: Embedding caching
- **WHEN** same query is repeated
- **THEN** system uses cached embedding instead of regeneration

#### Scenario: Synthetic embedding fallback
- **WHEN** no embedding service is configured
- **THEN** system generates synthetic embedding for testing

### Requirement: Retrieval parameters are configurable
The system SHALL allow configuration of retrieval parameters.

#### Scenario: TopK parameter
- **WHEN** client specifies topK parameter
- **THEN** system limits results to topK count

#### Scenario: Similarity threshold
- **WHEN** client specifies similarityThreshold parameter
- **THEN** system filters results below threshold

#### Scenario: Max context tokens
- **WHEN** client specifies maxContextTokens parameter
- **THEN** system truncates assembled context to token limit