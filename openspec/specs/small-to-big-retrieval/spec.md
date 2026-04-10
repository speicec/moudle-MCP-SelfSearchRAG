## ADDED Requirements

### Requirement: Small-to-Big retrieval strategy
The system SHALL implement two-phase retrieval: search small chunks for precision, then expand to parent chunks for complete context.

#### Scenario: Two-phase retrieval
- **WHEN** user query is executed
- **THEN** system first retrieves relevant small chunks, then expands to their parent chunks

#### Scenario: Small chunk retrieval phase
- **WHEN** query embedding is generated
- **THEN** system searches in small chunk index for top-k matches

#### Scenario: Parent expansion phase
- **WHEN** small chunks are retrieved
- **THEN** system expands each small chunk to its parent chunk for final result

### Requirement: Query embedding generation
The system SHALL generate embedding for user query to enable similarity search.

#### Scenario: Query embedding
- **WHEN** user submits query text
- **THEN** system generates embedding vector for the query

#### Scenario: Query preprocessing
- **WHEN** query is processed
- **THEN** system applies same preprocessing as document chunks

#### Scenario: Query caching
- **WHEN** identical query is repeated
- **THEN** system uses cached query embedding to avoid redundant API calls

### Requirement: Top-k small chunk retrieval
The system SHALL retrieve top-k most similar small chunks based on cosine similarity.

#### Scenario: Top-k selection
- **WHEN** retrieval is executed with k parameter
- **THEN** system returns exactly k most similar small chunks (or fewer if insufficient matches)

#### Scenario: Similarity ranking
- **WHEN** small chunks are retrieved
- **THEN** chunks are ranked by cosine similarity to query embedding

#### Scenario: Similarity threshold filter
- **WHEN** similarity threshold is configured
- **THEN** system filters out chunks below threshold before top-k selection

### Requirement: Parent chunk expansion
The system SHALL expand retrieved small chunks to their parent chunks for final response.

#### Scenario: Parent lookup
- **WHEN** small chunk is retrieved
- **THEN** system looks up its parent chunk via parentId reference

#### Scenario: Duplicate parent merging
- **WHEN** multiple small chunks belong to same parent
- **THEN** system returns single parent chunk instead of duplicates

#### Scenario: Parent relevance validation
- **WHEN** parent chunk is expanded
- **THEN** system validates parent chunk relevance to query

### Requirement: Context assembly from parent chunks
The system SHALL assemble final context from expanded parent chunks respecting token limits.

#### Scenario: Token limit enforcement
- **WHEN** parent chunks are assembled
- **THEN** system respects configured maximum context token limit

#### Scenario: Priority ordering
- **WHEN** multiple parent chunks are available
- **THEN** system prioritizes by small chunk similarity score

#### Scenario: Truncation strategy
- **WHEN** context exceeds token limit
- **THEN** system truncates lowest-priority parent chunks

### Requirement: Retrieval result metadata
The system SHALL return comprehensive metadata for retrieval results.

#### Scenario: Source attribution
- **WHEN** retrieval result is returned
- **THEN** result includes source document ID and chunk position

#### Scenario: Similarity score
- **WHEN** retrieval result is returned
- **THEN** result includes similarity score from small chunk phase

#### Scenario: Hierarchical info
- **WHEN** retrieval result is returned
- **THEN** result includes small chunk ID and parent chunk ID

### Requirement: Fallback to direct parent search
The system SHALL fallback to direct parent chunk search when small chunk search fails.

#### Scenario: Small chunk no match
- **WHEN** small chunk search returns zero results
- **THEN** system searches directly in parent chunk index

#### Scenario: Low confidence fallback
- **WHEN** small chunk search confidence is below threshold
- **THEN** system augments with parent chunk search

#### Scenario: Fallback result handling
- **WHEN** fallback is triggered
- **THEN** system combines small chunk and parent chunk results

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