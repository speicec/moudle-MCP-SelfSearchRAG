## ADDED Requirements

### Requirement: WebSocket server provides real-time event broadcasting
The system SHALL provide WebSocket server for real-time pipeline event broadcasting.

#### Scenario: WebSocket connection establishment
- **WHEN** client connects to WebSocket endpoint
- **THEN** system accepts connection and adds client to broadcast list

#### Scenario: Event broadcasting to all clients
- **WHEN** pipeline event is emitted
- **THEN** system broadcasts event to all connected WebSocket clients

#### Scenario: Client disconnection handling
- **WHEN** WebSocket client disconnects
- **THEN** system removes client from broadcast list without error

### Requirement: WebSocket protocol defines standard event types
The system SHALL define standard event types for pipeline communication.

#### Scenario: Stage start event
- **WHEN** pipeline stage begins execution
- **THEN** system emits event with type "stage:start", stage name, and timestamp

#### Scenario: Stage progress event
- **WHEN** pipeline stage reports progress
- **THEN** system emits event with type "stage:progress", stage name, progress percentage (0-100), and timestamp

#### Scenario: Stage complete event
- **WHEN** pipeline stage completes
- **THEN** system emits event with type "stage:complete", stage name, result summary, and timestamp

#### Scenario: Pipeline complete event
- **WHEN** entire pipeline completes
- **THEN** system emits event with type "pipeline:complete", document ID, and final statistics

#### Scenario: Error event
- **WHEN** pipeline encounters error
- **THEN** system emits event with type "error", error message, and stack trace

### Requirement: WebSocket message format is JSON-based
The system SHALL use JSON format for WebSocket messages.

#### Scenario: Message structure
- **WHEN** event is broadcasted
- **THEN** message is JSON object with type, stage, progress, message, timestamp, and documentId fields

#### Scenario: Invalid message handling
- **WHEN** client sends invalid JSON
- **THEN** system ignores message or returns error response

### Requirement: WebSocket integrates with Fastify server
The system SHALL integrate WebSocket handler with Fastify HTTP server.

#### Scenario: WebSocket route registration
- **WHEN** Fastify server starts
- **THEN** WebSocket route is registered at /ws path

#### Scenario: WebSocket and HTTP coexistence
- **WHEN** HTTP request arrives at non-WebSocket path
- **THEN** HTTP routes handle request normally

### Requirement: Frontend maintains WebSocket connection
The system SHALL maintain WebSocket connection from frontend to backend.

#### Scenario: Automatic reconnection
- **WHEN** WebSocket connection is lost
- **THEN** frontend attempts reconnection with exponential backoff

#### Scenario: Connection status indicator
- **WHEN** WebSocket connection status changes
- **THEN** frontend displays connection status indicator (connected/disconnected/reconnecting)

## Requirement: WebSocket supports generation phase events
The system SHALL support WebSocket events for LLM generation phase.

### Scenario: generation:start event
- **WHEN** LLM generation begins
- **THEN** WebSocket broadcasts generation:start event with query and retrieved chunks count

### Scenario: generation:thinking event
- **WHEN** DeepSeek returns reasoning_content in SSE stream
- **THEN** WebSocket broadcasts generation:thinking event with thinking content fragment

### Scenario: generation:answer event
- **WHEN** DeepSeek returns content in SSE stream
- **THEN** WebSocket broadcasts generation:answer event with answer content fragment

### Scenario: generation:complete event
- **WHEN** LLM generation finishes
- **THEN** WebSocket broadcasts generation:complete event with token counts and duration

## Requirement: Generation events include metadata
The system SHALL include relevant metadata in generation phase events.

### Scenario: Thinking event includes phase indicator
- **WHEN** generation:thinking event is broadcast
- **THEN** event includes phase field indicating "reasoning"

### Scenario: Complete event includes token counts
- **WHEN** generation:complete event is broadcast
- **THEN** event includes thinkingTokens, answerTokens, and totalDuration fields

## Requirement: WebSocket preserves existing retrieval events
The system SHALL continue supporting existing retrieval events unchanged.

### Scenario: retrieval:start event preserved
- **WHEN** retrieval phase starts
- **THEN** WebSocket broadcasts retrieval:start event as before

### Scenario: retrieval:match event preserved
- **WHEN** retrieval finds a match
- **THEN** WebSocket broadcasts retrieval:match event as before

### Scenario: retrieval:complete event preserved
- **WHEN** retrieval phase completes
- **THEN** WebSocket broadcasts retrieval:complete event as before

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

### Requirement: WebSocket protocol supports startup progress events
The system SHALL support startup progress events for model preloading status reporting.

#### Scenario: startup:progress event emission
- **WHEN** server is preloading embedding models during startup
- **THEN** system emits event with type "startup:progress", stage (checking/loading_text/loading_multimodal/ready), progress percentage (0-100), message, optional model name, and timestamp

#### Scenario: startup:ready event emission
- **WHEN** model preloading completes successfully
- **THEN** system emits event with type "startup:ready", completion message, and timestamp

#### Scenario: startup:error event emission
- **WHEN** model preloading fails
- **THEN** system emits event with type "startup:error", error message, and timestamp

### Requirement: Startup events follow existing event format
The system SHALL follow the established WebSocket event format for startup events.

#### Scenario: Startup event structure
- **WHEN** startup event is broadcast
- **THEN** message is JSON object with type, stage (StartupStage), progress, message, timestamp, and optional model field

#### Scenario: StartupStage type definition
- **WHEN** startup:progress event includes stage
- **THEN** stage value is one of: "checking", "loading_text", "loading_multimodal", "ready"

### Requirement: WebSocket retrieval:complete event includes GRADE evaluation
The system SHALL include evidenceEvaluation field in retrieval:complete event results.

#### Scenario: Retrieval result with GRADE evaluation
- **WHEN** retrieval:complete event is broadcast
- **THEN** each result in results array includes optional evidenceEvaluation object
- **AND** evidenceEvaluation contains: literatureType, grade, sourceAuthority, compositeScore, timeWeight, consistencyScore, isCurrent, expirationWarning

#### Scenario: GRADE evaluation computed per result
- **WHEN** Agent completes retrieval phase
- **THEN** system calls evaluateMultipleSourcesEnhanced() for all retrieval results
- **AND** attaches evidenceEvaluation to each result before broadcasting

### Requirement: WebSocket generation:complete event includes overall GRADE
The system SHALL include overall evidence grade in generation:complete event.

#### Scenario: Generation complete with overall grade
- **WHEN** generation:complete event is broadcast
- **THEN** event includes overallEvidenceGrade field (A/B/C/D)
- **AND** overallEvidenceGrade is calculated as highest grade from all evidence

#### Scenario: Generation complete with evidence statistics
- **WHEN** generation:complete event is broadcast
- **THEN** event includes evidenceStatistics object
- **AND** evidenceStatistics contains: totalSources, gradeDistribution, averageCompositeScore, conflictDetected

#### Scenario: Conflict warning in generation event
- **WHEN** evidence consistency check detects conflict
- **THEN** generation:complete event includes conflictWarning field
- **AND** conflictWarning describes the conflicting sources

### Requirement: WebSocket agent events include evidence evaluation
The system SHALL include evidence evaluation in Agent-related WebSocket events.

#### Scenario: Agent evidence:evaluated event
- **WHEN** Agent evaluates retrieved evidence
- **THEN** system broadcasts evidence:evaluated event
- **AND** event contains: evidenceArray, overallGrade, consistencyScore, timestamp

#### Scenario: Evidence event after retrieval
- **WHEN** retrieval:complete event is broadcast in Agent mode
- **THEN** evidence:evaluated event follows within 100ms
- **AND** client can display GRADE data before generation starts