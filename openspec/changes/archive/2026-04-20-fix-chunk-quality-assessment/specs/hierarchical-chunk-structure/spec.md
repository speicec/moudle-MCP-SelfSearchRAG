## ADDED Requirements

### Requirement: Quality evaluation at chunk creation
The system SHALL execute quality evaluation for each chunk during the chunk creation process, not as a separate post-processing step.

#### Scenario: Quality evaluation integration
- **WHEN** chunks are stored in hierarchical structure
- **THEN** the system MUST call ChunkQualityFilter.evaluate() for each chunk
- **AND** MUST NOT use hardcoded default quality scores

#### Scenario: Quality score derivation
- **WHEN** chunk is created
- **THEN** quality score SHALL be computed from actual content analysis
- **AND** qualityScore.composite SHALL reflect true content quality

#### Scenario: Default score prohibition
- **WHEN** chunk quality is assigned
- **THEN** system MUST NOT use createDefaultQualityScore() as the final quality score
- **AND** default scores MAY only be used as initialization before real evaluation

### Requirement: Document embedding for relevance scoring
The system SHALL compute and set document-level embedding before evaluating chunk quality scores.

#### Scenario: Document embedding computation
- **WHEN** document processing begins
- **THEN** system SHALL aggregate all chunk embeddings to compute document embedding
- **AND** SHALL call setDocumentEmbedding(documentId, embedding)

#### Scenario: Relevance score accuracy
- **WHEN** document relevance dimension is evaluated
- **THEN** cosineSimilarity(chunk.embedding, documentEmbedding) SHALL be computed
- **AND** MUST NOT return hardcoded 0.5 value

#### Scenario: Document embedding timing
- **WHEN** quality evaluation begins for a document's chunks
- **THEN** document embedding MUST be available before any chunk evaluation
- **AND** first chunk batch SHALL compute and cache document embedding

### Requirement: Quality evaluation in processing pipeline
The system SHALL integrate quality evaluation into the document processing pipeline at the appropriate stage.

#### Scenario: Processing stage integration
- **WHEN** document-processor creates hierarchical chunks
- **THEN** ChunkQualityFilter SHALL be instantiated and configured
- **AND** SHALL evaluate each chunk before storage

#### Scenario: Quality filter configuration
- **WHEN** quality filter is instantiated
- **THEN** filter SHALL use configured dimension weights
- **AND** SHALL use configured quality threshold

#### Scenario: Quality statistics collection
- **WHEN** quality evaluation completes for all chunks
- **THEN** system SHALL collect quality statistics
- **AND** SHALL emit quality distribution metrics