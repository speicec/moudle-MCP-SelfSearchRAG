## ADDED Requirements

### Requirement: PipelineTimeline displays stage progress with timing
The system SHALL display a timeline showing document processing stages (ingest, parse, embed, index) with duration and key metrics for each stage.

#### Scenario: Stage progress visualization
- **WHEN** a document processing pipeline starts
- **THEN** system displays timeline with all four stages and updates progress as stages complete

#### Scenario: Stage metrics display
- **WHEN** a stage completes with metrics
- **THEN** system displays stage-specific metrics (pages extracted, tokens, chunks created, etc.)

#### Scenario: Timeline animation
- **WHEN** a stage is actively running
- **THEN** system shows pulsing animation on the current stage node

#### Scenario: Total duration display
- **WHEN** pipeline completes
- **THEN** system displays total processing duration with success indicator

### Requirement: PipelineTimeline receives real-time WebSocket events
The system SHALL update timeline display in response to WebSocket events.

#### Scenario: stage:start event handling
- **WHEN** frontend receives `stage:start` event
- **THEN** system marks corresponding stage as running with start time

#### Scenario: stage:metrics event handling
- **WHEN** frontend receives `stage:metrics` event
- **THEN** system updates stage metrics and displays in metrics card

#### Scenario: stage:complete event handling
- **WHEN** frontend receives `stage:complete` event
- **THEN** system marks stage as completed with duration and slides in metrics card

### Requirement: PipelineTimeline displays stage-specific metrics
The system SHALL show appropriate metrics for each pipeline stage.

#### Scenario: Ingest stage metrics
- **WHEN** ingest stage completes
- **THEN** system displays file size

#### Scenario: Parse stage metrics
- **WHEN** parse stage completes
- **THEN** system displays pages extracted, tokens extracted, tables detected, formulas detected

#### Scenario: Embed stage metrics
- **WHEN** embed stage completes
- **THEN** system displays embedding dimension, chunks embedded

#### Scenario: Index stage metrics
- **WHEN** index stage completes
- **THEN** system displays small chunks created, parent chunks created