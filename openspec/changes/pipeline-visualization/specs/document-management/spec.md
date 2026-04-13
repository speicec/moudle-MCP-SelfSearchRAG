## ADDED Requirements

### Requirement: Document API provides chunk listing endpoint
The system SHALL provide HTTP API endpoint to list chunks for a specific document.

#### Scenario: Chunk list retrieval
- **WHEN** client GETs /api/documents/:id/chunks
- **THEN** system returns paginated chunk list with documentId, chunks array, total count, page, and pageSize

#### Scenario: Level filtering
- **WHEN** client GETs /api/documents/:id/chunks?level=small
- **THEN** system returns only small chunks for the document

#### Scenario: Pagination support
- **WHEN** client GETs /api/documents/:id/chunks?page=2&size=10
- **THEN** system returns second page with 10 chunks per page

#### Scenario: Sorting support
- **WHEN** client GETs /api/documents/:id/chunks?sort=quality
- **THEN** system returns chunks sorted by quality score descending

### Requirement: Chunk data includes hierarchy information
The system SHALL include hierarchy information in chunk response data.

#### Scenario: Parent chunk response
- **WHEN** chunk is parent level
- **THEN** response includes id, level="parent", content preview, token count, quality score, childIds array, and position

#### Scenario: Small chunk response
- **WHEN** chunk is small level
- **THEN** response includes id, level="small", content preview, token count, quality score, parentId, and position

### Requirement: Document API provides statistics endpoint
The system SHALL provide HTTP API endpoint for global statistics.

#### Scenario: Statistics retrieval
- **WHEN** client GETs /api/stats
- **THEN** system returns statistics object with pipelineStats, retrievalStats, chunkStats, and stageTimeDistribution

#### Scenario: Pipeline statistics structure
- **WHEN** statistics response includes pipelineStats
- **THEN** pipelineStats contains totalDocuments, indexedDocuments, processingDocuments, errorDocuments, avg/min/max processing times, and throughput

#### Scenario: Retrieval statistics structure
- **WHEN** statistics response includes retrievalStats
- **THEN** retrievalStats contains totalQueries, avg/min/max latency, avgResultsCount, and successRate