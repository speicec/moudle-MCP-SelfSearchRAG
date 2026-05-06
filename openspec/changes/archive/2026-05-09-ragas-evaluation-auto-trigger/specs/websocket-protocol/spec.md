## ADDED Requirements

### Requirement: WebSocket protocol supports evaluation complete events
The system SHALL support evaluation:complete event for RAGAS result broadcasting.

#### Scenario: evaluation:complete event structure
- **WHEN** evaluation completes and results are ready
- **THEN** system broadcasts event with type "evaluation:complete"
- **AND** event includes evaluationId, traceId, sessionId fields
- **AND** event includes dimensionScores object
- **AND** event includes layerScores object
- **AND** event includes overallScore and riskLevel
- **AND** event includes timestamp

#### Scenario: evaluation:complete dimension scores format
- **WHEN** evaluation:complete event is broadcast
- **THEN** dimensionScores contains all 8 dimension values (0.0-1.0 range)
- **AND** each dimension value is a number, not object

#### Scenario: evaluation:complete risk level format
- **WHEN** evaluation:complete event is broadcast
- **THEN** riskLevel is one of: "safe", "caution", "warning", "danger"
- **AND** riskLevel maps to overallScore thresholds (≥0.8=safe, ≥0.6=caution, ≥0.4=warning, <0.4=danger)

#### Scenario: evaluation:complete event timing
- **WHEN** Agent query completes with evaluation
- **THEN** evaluation:complete event is broadcast approximately 3-5 seconds after HTTP response
- **AND** event follows the existing WebSocket JSON message format

### Requirement: Evaluation events follow standard message format
The system SHALL follow established WebSocket event format for evaluation events.

#### Scenario: Evaluation event message structure
- **WHEN** evaluation event is broadcast
- **THEN** message is JSON object with type field matching "evaluation:complete"
- **AND** message includes timestamp field (Unix milliseconds)
- **AND** message structure is compatible with existing frontend event handling