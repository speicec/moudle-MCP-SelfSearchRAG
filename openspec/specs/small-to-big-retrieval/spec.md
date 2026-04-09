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