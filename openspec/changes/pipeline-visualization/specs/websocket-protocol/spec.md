## ADDED Requirements

### Requirement: WebSocket protocol supports stage metrics events
The system SHALL support stage metrics event for detailed processing statistics.

#### Scenario: stage:metrics event emission
- **WHEN** pipeline stage completes with metrics
- **THEN** system emits event with type "stage:metrics", stage name, metrics object, and timestamp

#### Scenario: Metrics object structure
- **WHEN** stage:metrics event is emitted
- **THEN** metrics object contains stage-specific data (fileSizeBytes, pagesExtracted, tokensExtracted, embeddingDimension, chunksCreated, etc.)

### Requirement: WebSocket protocol supports chunk creation events
The system SHALL support chunk creation events for real-time chunk tracking.

#### Scenario: chunk:created event emission
- **WHEN** a new chunk is created during indexing
- **THEN** system emits event with type "chunk:created", chunk data, document ID, total chunk count, and timestamp

#### Scenario: Chunk data structure
- **WHEN** chunk:created event is emitted
- **THEN** chunk data contains id, level (small/parent), content preview, token count, quality score, position, and metadata

### Requirement: WebSocket protocol supports retrieval process events
The system SHALL support retrieval process events for search visualization.

#### Scenario: retrieval:start event emission
- **WHEN** retrieval query is submitted
- **THEN** system emits event with type "retrieval:start", query text, and timestamp

#### Scenario: retrieval:match event emission
- **WHEN** a similarity match is found during search
- **THEN** system emits event with type "retrieval:match", match data (smallChunkId, similarityScore, rank), query, and timestamp

#### Scenario: retrieval:complete event emission
- **WHEN** retrieval process completes
- **THEN** system emits event with type "retrieval:complete", query, results array, duration, and timestamp

### Requirement: WebSocket protocol supports statistics update events
The system SHALL support statistics update events for dashboard refresh.

#### Scenario: stats:update event emission
- **WHEN** system statistics change significantly
- **THEN** system emits event with type "stats:update", statistics object, and timestamp

#### Scenario: Statistics object structure
- **WHEN** stats:update event is emitted
- **THEN** statistics object contains pipelineStats, retrievalStats, chunkStats, and stageTimeDistribution