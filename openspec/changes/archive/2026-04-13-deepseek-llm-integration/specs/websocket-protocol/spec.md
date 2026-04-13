## ADDED Requirements

### Requirement: WebSocket supports generation phase events
The system SHALL support WebSocket events for LLM generation phase.

#### Scenario: generation:start event
- **WHEN** LLM generation begins
- **THEN** WebSocket broadcasts generation:start event with query and retrieved chunks count

#### Scenario: generation:thinking event
- **WHEN** DeepSeek returns reasoning_content in SSE stream
- **THEN** WebSocket broadcasts generation:thinking event with thinking content fragment

#### Scenario: generation:answer event
- **WHEN** DeepSeek returns content in SSE stream
- **THEN** WebSocket broadcasts generation:answer event with answer content fragment

#### Scenario: generation:complete event
- **WHEN** LLM generation finishes
- **THEN** WebSocket broadcasts generation:complete event with token counts and duration

### Requirement: Generation events include metadata
The system SHALL include relevant metadata in generation phase events.

#### Scenario: Thinking event includes phase indicator
- **WHEN** generation:thinking event is broadcast
- **THEN** event includes phase field indicating "reasoning"

#### Scenario: Complete event includes token counts
- **WHEN** generation:complete event is broadcast
- **THEN** event includes thinkingTokens, answerTokens, and totalDuration fields

### Requirement: WebSocket preserves existing retrieval events
The system SHALL continue supporting existing retrieval events unchanged.

#### Scenario: retrieval:start event preserved
- **WHEN** retrieval phase starts
- **THEN** WebSocket broadcasts retrieval:start event as before

#### Scenario: retrieval:match event preserved
- **WHEN** retrieval finds a match
- **THEN** WebSocket broadcasts retrieval:match event as before

#### Scenario: retrieval:complete event preserved
- **WHEN** retrieval phase completes
- **THEN** WebSocket broadcasts retrieval:complete event as before