## ADDED Requirements

### Requirement: StatsDashboard displays pipeline statistics
The system SHALL display global pipeline processing statistics.

#### Scenario: Processing time stats display
- **WHEN** StatsDashboard loads
- **THEN** system displays avg/min/max processing times and throughput (docs/min)

#### Scenario: Document status breakdown
- **WHEN** StatsDashboard loads
- **THEN** system displays total documents with breakdown by status (indexed, processing, error)

#### Scenario: Stage time distribution
- **WHEN** StatsDashboard loads
- **THEN** system displays percentage breakdown of time spent in each stage (ingest, parse, embed, index)

### Requirement: StatsDashboard displays retrieval statistics
The system SHALL display global retrieval performance statistics.

#### Scenario: Query latency stats display
- **WHEN** StatsDashboard loads
- **THEN** system displays avg/min/max query latency and success rate

#### Scenario: Results count stats
- **WHEN** StatsDashboard loads
- **THEN** system displays average results count per query

### Requirement: StatsDashboard displays chunk quality distribution
The system SHALL display chunk quality score distribution.

#### Scenario: Quality distribution display
- **WHEN** StatsDashboard loads
- **THEN** system displays quality distribution with percentage for high (>0.8), medium (0.6-0.8), low (<0.6)

#### Scenario: Chunk count stats
- **WHEN** StatsDashboard loads
- **THEN** system displays total small chunks, total parent chunks, and average token counts

### Requirement: StatsDashboard receives real-time updates
The system SHALL update statistics in response to WebSocket events.

#### Scenario: stats:update event handling
- **WHEN** frontend receives `stats:update` event
- **THEN** system refreshes all dashboard statistics

#### Scenario: Performance indicator
- **WHEN** statistics are displayed
- **THEN** system shows performance rating (e.g., "优秀", "良好") based on latency thresholds

### Requirement: StatsDashboard provides optimization hints
The system SHALL display actionable hints based on statistics.

#### Scenario: Bottleneck hint
- **WHEN** a stage consumes >50% of processing time
- **THEN** system displays hint suggesting optimization for that stage