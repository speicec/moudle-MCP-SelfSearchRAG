## ADDED Requirements

### Requirement: Timeline caches stage logs
The system SHALL cache log messages for each pipeline stage with a maximum limit of 20 entries per stage.

#### Scenario: Stage log caching on stage:start
- **WHEN** frontend receives `stage:start` event with message field
- **THEN** system adds log entry to corresponding stage's log cache

#### Scenario: Stage log caching on stage:progress
- **WHEN** frontend receives `stage:progress` event with message field
- **THEN** system adds log entry to corresponding stage's log cache

#### Scenario: Stage log limit enforcement
- **WHEN** stage log cache exceeds 20 entries
- **THEN** system removes oldest entries to maintain 20 entry limit

#### Scenario: Log entry structure
- **WHEN** system caches a log entry
- **THEN** entry contains timestamp, message string, and type (info/warn/error)

### Requirement: Timeline caches global logs
The system SHALL cache log messages globally with a maximum limit of 100 entries.

#### Scenario: Global log caching on any stage event
- **WHEN** frontend receives any pipeline event with message field
- **THEN** system adds log entry to global log cache

#### Scenario: Global log limit enforcement
- **WHEN** global log cache exceeds 100 entries
- **THEN** system removes oldest entries to maintain 100 entry limit

#### Scenario: Global log timestamp ordering
- **WHEN** system displays global logs
- **THEN** logs are ordered by timestamp with most recent first

### Requirement: Stage log panel is collapsible
The system SHALL provide a collapsible panel within each stage card to display stage-specific logs.

#### Scenario: Stage log panel collapsed by default
- **WHEN** stage card is rendered
- **THEN** log panel is collapsed and hidden

#### Scenario: Stage log panel expansion
- **WHEN** user clicks log panel trigger button
- **THEN** log panel expands to show cached logs for that stage

#### Scenario: Stage log panel collapse
- **WHEN** user clicks log panel trigger button while expanded
- **THEN** log panel collapses and hides logs

#### Scenario: Running stage auto-expands logs
- **WHEN** stage is actively running
- **THEN** system auto-expands log panel for that stage (optional behavior)

### Requirement: Global log panel displays at bottom
The system SHALL provide a collapsible global log panel at the bottom of timeline component.

#### Scenario: Global log panel collapsed by default
- **WHEN** PipelineTimeline renders
- **THEN** global log panel is collapsed showing only header

#### Scenario: Global log panel expansion
- **WHEN** user clicks global log panel trigger
- **THEN** panel expands showing recent 10-20 logs with scrollable area

#### Scenario: Global log auto-scroll
- **WHEN** new log entry is added while panel is expanded
- **THEN** panel automatically scrolls to show newest entry

#### Scenario: Log type visual distinction
- **WHEN** log entry is displayed
- **THEN** info entries show neutral styling, warn entries show yellow, error entries show red