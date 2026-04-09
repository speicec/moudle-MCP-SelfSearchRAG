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