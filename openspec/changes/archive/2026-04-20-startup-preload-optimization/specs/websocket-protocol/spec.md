## ADDED Requirements

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