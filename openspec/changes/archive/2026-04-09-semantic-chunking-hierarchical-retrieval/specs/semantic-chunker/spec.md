## ADDED Requirements

### Requirement: Semantic-based document chunking
The system SHALL chunk documents based on semantic boundaries detected via embedding similarity, not fixed token counts.

#### Scenario: Semantic boundary detection
- **WHEN** a document is processed by the semantic chunker
- **THEN** the system identifies semantic boundaries where embedding similarity between adjacent text segments drops significantly

#### Scenario: Boundary-aligned chunking
- **WHEN** semantic boundaries are detected
- **THEN** the system creates chunks that align with these boundaries, preserving semantic coherence

#### Scenario: Sentence-level processing
- **WHEN** chunking is performed
- **THEN** the system processes documents at sentence level to identify semantic boundaries

### Requirement: Sliding window embedding calculation
The system SHALL use sliding window approach to calculate embeddings and detect semantic changes.

#### Scenario: Window-based embedding
- **WHEN** semantic chunking is initiated
- **THEN** the system generates embeddings for sliding windows of consecutive sentences

#### Scenario: Window size configuration
- **WHEN** window size is configured (default 3 sentences)
- **THEN** the system applies the specified window size for embedding calculation

#### Scenario: Adjacent window comparison
- **WHEN** embeddings are calculated
- **THEN** the system computes cosine similarity between adjacent windows

### Requirement: Chunk boundary at semantic cliff
The system SHALL create chunk boundaries where semantic similarity exhibits cliff-like drops.

#### Scenario: Cliff-triggered boundary
- **WHEN** cosine similarity between adjacent windows drops below configured threshold
- **THEN** the system marks that position as a potential chunk boundary

#### Scenario: Multiple cliff handling
- **WHEN** multiple semantic cliffs are detected in close proximity
- **THEN** the system selects the most significant cliff as the boundary

#### Scenario: No-cliff fallback
- **WHEN** no significant semantic cliffs are detected in a document segment
- **THEN** the system applies fallback chunking at maximum chunk length

### Requirement: Batch embedding generation
The system SHALL generate embeddings in batch mode to optimize API calls.

#### Scenario: Batch embedding request
- **WHEN** embeddings are needed for multiple sentences
- **THEN** the system batches sentences into single embedding API call

#### Scenario: Batch size limit
- **WHEN** embedding batch exceeds configured size limit
- **THEN** the system splits into multiple batch requests

#### Scenario: Embedding caching
- **WHEN** embeddings are generated
- **THEN** the system caches embeddings to avoid redundant API calls

### Requirement: Chunk metadata preservation
The system SHALL preserve metadata for each generated chunk.

#### Scenario: Position metadata
- **WHEN** a chunk is created
- **THEN** the system records start and end positions in the source document

#### Scenario: Document reference
- **WHEN** a chunk is created
- **THEN** the system includes reference to source document ID

#### Scenario: Boundary confidence
- **WHEN** a chunk is created
- **THEN** the system records confidence score for the boundary decision