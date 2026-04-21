## ADDED Requirements

### Requirement: PipelineTimeline displays stage progress with timing
The system SHALL display a timeline showing document processing stages (ingest, parse, chunk, embed, index) with duration and key metrics for each stage.

#### Scenario: Stage progress visualization
- **WHEN** a document processing pipeline starts
- **THEN** system displays timeline with all five stages and updates progress as stages complete

#### Scenario: Stage metrics display
- **WHEN** a stage completes with metrics
- **THEN** system displays stage-specific metrics (pages extracted, tokens, chunks created, etc.)

#### Scenario: Timeline animation
- **WHEN** a stage is actively running
- **THEN** system shows pulsing animation on the current stage node and flow animation to next stage

#### Scenario: Total duration display
- **WHEN** pipeline completes
- **THEN** system displays total processing duration with success indicator

#### Scenario: Chunk stage display
- **WHEN** chunk stage is active or completed
- **THEN** system displays chunk stage card with cyan color theme and chunk count metrics

### Requirement: PipelineTimeline receives real-time WebSocket events
The system SHALL update timeline display in response to WebSocket events.

#### Scenario: stage:start event handling
- **WHEN** frontend receives `stage:start` event
- **THEN** system marks corresponding stage as running with start time and caches log message

#### Scenario: stage:metrics event handling
- **WHEN** frontend receives `stage:metrics` event
- **THEN** system updates stage metrics and displays in metrics card

#### Scenario: stage:complete event handling
- **WHEN** frontend receives `stage:complete` event
- **THEN** system marks stage as completed with duration and slides in metrics card

#### Scenario: chunk stage event handling
- **WHEN** frontend receives `stage:start` or `stage:complete` event with stage='chunk'
- **THEN** system correctly updates chunk stage card (no event ignored)

### Requirement: PipelineTimeline displays stage-specific metrics
The system SHALL show appropriate metrics for each pipeline stage.

#### Scenario: Ingest stage metrics
- **WHEN** ingest stage completes
- **THEN** system displays file size

#### Scenario: Parse stage metrics
- **WHEN** parse stage completes
- **THEN** system displays pages extracted, tokens extracted, tables detected, formulas detected

#### Scenario: Chunk stage metrics
- **WHEN** chunk stage completes
- **THEN** system displays chunks created (small and parent), average chunk quality score

#### Scenario: Embed stage metrics
- **WHEN** embed stage completes
- **THEN** system displays embedding dimension, chunks embedded

#### Scenario: Index stage metrics
- **WHEN** index stage completes
- **THEN** system displays small chunks indexed, parent chunks indexed

### Requirement: PipelineTimeline uses semantic color tokens
The system SHALL display stage status using semantic design tokens instead of hardcoded colors.

#### Scenario: Completed stage color
- **WHEN** stage status is completed
- **THEN** system uses status-indexed or confidence-high color token

#### Scenario: Running stage color
- **WHEN** stage status is running
- **THEN** system uses status-processing color token

#### Scenario: Pending stage color
- **WHEN** stage status is pending
- **THEN** system uses status-pending color token

#### Scenario: Error stage color
- **WHEN** stage status is error
- **THEN** system uses status-error color token

### Requirement: PipelineTimeline displays in gradient container
The system SHALL render timeline within a gradient background container matching StartupProgress visual style.

#### Scenario: Gradient container background
- **WHEN** PipelineTimeline component renders
- **THEN** container uses gradient background similar to StartupProgress

#### Scenario: Container dark mode adaptation
- **WHEN** dark mode is active
- **THEN** gradient colors adapt for dark theme visibility

### Requirement: PipelineTimeline uses five-column responsive layout
The system SHALL display five stage cards in responsive grid layout.

#### Scenario: Large screen layout
- **WHEN** viewport is lg or larger
- **THEN** system displays five columns (one card per column)

#### Scenario: Medium screen layout
- **WHEN** viewport is md size
- **THEN** system displays three columns with flow lines adjusted

#### Scenario: Small screen layout
- **WHEN** viewport is sm size or smaller
- **THEN** system displays two columns with flow lines adjusted