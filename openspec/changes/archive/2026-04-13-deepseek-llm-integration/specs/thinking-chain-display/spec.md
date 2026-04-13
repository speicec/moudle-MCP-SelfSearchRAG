## ADDED Requirements

### Requirement: Thinking chain display shows three phases
The system SHALL display thinking chain with three distinct phases: analysis, retrieval, and synthesis.

#### Scenario: Analysis phase displayed
- **WHEN** LLM generation starts
- **THEN** thinking chain display shows "分析问题" phase with query text

#### Scenario: Retrieval phase displayed
- **WHEN** retrieval phase completes
- **THEN** thinking chain display shows "检索资料" phase with number of results found

#### Scenario: Synthesis phase displayed
- **WHEN** LLM thinking stream begins
- **THEN** thinking chain display shows "正在思考" phase with streaming thinking content

### Requirement: Thinking chain display supports expand/collapse
The system SHALL allow users to expand and collapse thinking chain details.

#### Scenario: Collapsed by default
- **WHEN** thinking chain display renders
- **THEN** thinking chain is collapsed by default showing only phase status icons

#### Scenario: User expands thinking chain
- **WHEN** user clicks expand button
- **THEN** thinking chain expands to show full thinking content text

#### Scenario: User collapses thinking chain
- **WHEN** user clicks collapse button
- **THEN** thinking chain collapses to show only summary

### Requirement: Thinking chain display shows phase status
The system SHALL visually indicate the status of each thinking phase.

#### Scenario: Pending phase
- **WHEN** a phase has not started
- **THEN** phase icon shows gray circle (○) with no animation

#### Scenario: Running phase
- **WHEN** a phase is currently executing
- **THEN** phase icon shows animated blue circle with blinking effect

#### Scenario: Completed phase
- **WHEN** a phase has finished
- **THEN** phase icon shows green checkmark (✓)

### Requirement: Thinking chain display streams thinking content
The system SHALL display streaming thinking content with real-time animation.

#### Scenario: Thinking content appended
- **WHEN** generation:thinking WebSocket event received
- **THEN** thinking content is appended to display with cursor animation

#### Scenario: Thinking content formatted
- **WHEN** thinking content is displayed
- **THEN** content is rendered in monospace font with proper text wrapping

### Requirement: Thinking chain display shows retrieved sources
The system SHALL display retrieved document sources in thinking chain retrieval phase.

#### Scenario: Sources count shown
- **WHEN** retrieval phase completes
- **THEN** thinking chain shows "找到 X 个片段" with sources count

#### Scenario: Source previews available
- **WHEN** user expands retrieval phase
- **THEN** mini source cards with chunk preview and similarity score are shown