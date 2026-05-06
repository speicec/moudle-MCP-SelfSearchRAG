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

### Requirement: Stats Dashboard receives evaluation updates via WebSocket
The system SHALL update Dashboard statistics when evaluation:complete WebSocket event is received.

#### Scenario: evaluation:complete event triggers state update
- **WHEN** WebSocket receives event with type "evaluation:complete"
- **THEN** statsStore.handleEvaluationUpdate() is called
- **AND** Dashboard displays updated evaluation metrics

#### Scenario: Update includes overall score
- **WHEN** handleEvaluationUpdate() is called
- **THEN** statsStore updates avgOverall state
- **AND** EvaluationCard displays new overall score

#### Scenario: Update includes dimension scores
- **WHEN** handleEvaluationUpdate() is called
- **THEN** statsStore updates dimensionScores state
- **AND** EvaluationCard displays 8 dimension bars with new values

#### Scenario: Update includes layer scores
- **WHEN** handleEvaluationUpdate() is called
- **THEN** statsStore updates layerScores state
- **AND** EvaluationCard displays 3 layer scores

#### Scenario: Update includes risk distribution
- **WHEN** handleEvaluationUpdate() is called
- **THEN** statsStore updates riskDistribution state
- **AND** riskDistribution accumulates count for received riskLevel

#### Scenario: Update increments evaluation count
- **WHEN** handleEvaluationUpdate() is called
- **THEN** statsStore increments totalEvaluations counter
- **AND** Dashboard shows updated evaluation count

### Requirement: Stats Dashboard preserves HTTP polling fallback
The system SHALL continue supporting HTTP polling for evaluation stats when WebSocket disconnects.

#### Scenario: HTTP polling continues after WebSocket disconnect
- **WHEN** WebSocket connection is lost
- **THEN** Dashboard continues HTTP polling every 10 seconds
- **AND** fetchStats() retrieves evaluation statistics from REST API

#### Scenario: WebSocket reconnect restores real-time updates
- **WHEN** WebSocket reconnects after disconnect
- **THEN** evaluation:complete events resume real-time delivery
- **AND** Dashboard displays latest evaluation immediately

### Requirement: Evaluation metrics display matches existing format
The system SHALL display evaluation metrics using existing EvaluationCard component format.

#### Scenario: Overall score color coding
- **WHEN** overallScore is displayed
- **THEN** color is determined by getScoreColor() function
- **AND** ≥0.8 displays green, ≥0.6 displays yellow, <0.6 displays red

#### Scenario: Dimension score bars
- **WHEN** dimensionScores are displayed
- **THEN** each dimension shows progress bar with percentage value
- **AND** bars use consistent color coding

#### Scenario: Risk level indicator
- **WHEN** riskLevel is displayed
- **THEN** indicator shows appropriate icon and color
- **AND** "safe" shows checkmark, "danger" shows warning icon