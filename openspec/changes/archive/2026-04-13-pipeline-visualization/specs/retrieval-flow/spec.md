## ADDED Requirements

### Requirement: RetrievalFlow visualizes query embedding process
The system SHALL display the query-to-embedding transformation process.

#### Scenario: Query input display
- **WHEN** user submits a query
- **THEN** system displays query text with arrow pointing to embedding model

#### Scenario: Embedding generation animation
- **WHEN** query embedding is being generated
- **THEN** system shows flowing animation from text to model, then displays embedding vector preview

#### Scenario: Embedding dimension display
- **WHEN** embedding generation completes
- **THEN** system displays vector dimension (e.g., "384 维")

### Requirement: RetrievalFlow visualizes similarity search
The system SHALL display the similarity search process with match highlighting.

#### Scenario: Vector space visualization
- **WHEN** similarity search starts
- **THEN** system displays abstract vector space with query vector at center

#### Scenario: Match highlighting
- **WHEN** matches are found
- **THEN** system highlights matched chunks with similarity scores, showing aggregation animation

#### Scenario: Search completion
- **WHEN** similarity search completes
- **THEN** system displays duration and number of chunks scanned

### Requirement: RetrievalFlow visualizes parent expansion
The system SHALL display the Small-to-Big parent expansion process.

#### Scenario: Expansion animation
- **WHEN** parent expansion starts
- **THEN** system shows arrows from matched small chunks to their parent chunks

#### Scenario: Parent selection display
- **WHEN** parent expansion completes
- **THEN** system displays selected parent chunks with total word count

### Requirement: RetrievalFlow displays final results
The system SHALL display retrieval results with source context.

#### Scenario: Result card display
- **WHEN** retrieval completes
- **THEN** system displays result cards with similarity score, source document, and content preview

#### Scenario: Result card animation
- **WHEN** results are ready
- **THEN** system slides in result cards sequentially from bottom

### Requirement: RetrievalFlow receives real-time retrieval events
The system SHALL update display in response to WebSocket events.

#### Scenario: retrieval:start event handling
- **WHEN** frontend receives `retrieval:start` event
- **THEN** system initializes retrieval flow display with query

#### Scenario: retrieval:match event handling
- **WHEN** frontend receives `retrieval:match` event
- **THEN** system highlights new match in vector space visualization

#### Scenario: retrieval:complete event handling
- **WHEN** frontend receives `retrieval:complete` event
- **THEN** system displays final results and total duration