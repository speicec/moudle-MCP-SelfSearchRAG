## MODIFIED Requirements

### Requirement: Sparse vectors SHALL be stored in Qdrant with correct field name

The system SHALL store sparse vectors using the Qdrant API field name `sparse_vector` (singular), not `sparse_values`.

#### Scenario: Upsert with sparse vector stores correctly
- **WHEN** a document chunk is processed and has a sparse vector embedding
- **THEN** the sparse vector SHALL be stored in Qdrant with field name `sparse_vector`
- **AND** the sparse vector SHALL be retrievable via `getPoint()` method

#### Scenario: Sparse search returns results after storage
- **WHEN** a keyword query is executed using sparse search
- **THEN** the search SHALL return matching results (non-zero count)
- **AND** results SHALL include correct sparse match scores

### Requirement: Content SHALL be stored in Qdrant payload when STORE_CONTENT_IN_PAYLOAD is enabled

The system SHALL store chunk content in the Qdrant payload when the environment variable `STORE_CONTENT_IN_PAYLOAD=true` is set.

#### Scenario: Content stored in payload for recovery
- **WHEN** a document chunk is upserted to Qdrant with `STORE_CONTENT_IN_PAYLOAD=true`
- **THEN** the `content` field SHALL be present in the point's payload
- **AND** content SHALL be truncated if exceeding `MAX_PAYLOAD_CONTENT_SIZE`

#### Scenario: Content retrievable from payload
- **WHEN** a point is retrieved from Qdrant using `getPoint()`
- **THEN** the payload SHALL include `content` field if it was stored
- **AND** `content` SHALL match the original chunk content (or truncated version)