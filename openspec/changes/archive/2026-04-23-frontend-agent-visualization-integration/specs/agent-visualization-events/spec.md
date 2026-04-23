---
capability: agent-visualization-events
version: 1.0
created: 2026-04-22
---

# Spec: Agent Visualization Events

## ADDED Requirements

### Requirement: Agent emits input event on query received
The system SHALL emit `agent:input` WebSocket event when Agent receives user query.

#### Scenario: Query input captured
- **WHEN** Agent receives query from HTTP Chat endpoint
- **THEN** system emits `agent:input` event with query text and timestamp

### Requirement: Agent emits entities event after recognition
The system SHALL emit `agent:entities` WebSocket event with recognized medical entities.

#### Scenario: Disease entities recognized
- **WHEN** entity recognizer identifies disease terms in query
- **THEN** `agent:entities` event includes diseases array with matchedTerm and canonicalName

#### Scenario: Drug entities recognized
- **WHEN** entity recognizer identifies drug terms in query
- **THEN** `agent:entities` event includes drugs array with matchedTerm and canonicalName

#### Scenario: Indicator with value recognized
- **WHEN** entity recognizer identifies indicator with value (e.g., "eGFR=35")
- **THEN** `agent:entities` event includes indicators array with matchedTerm, canonicalName, value, and unit

### Requirement: Agent emits complexity event after assessment
The system SHALL emit `agent:complexity` WebSocket event with complexity assessment result.

#### Scenario: Complexity assessed
- **WHEN** ComplexityJudge evaluates query complexity
- **THEN** `agent:complexity` event includes level, needsPlanning flag, and reason

### Requirement: Agent emits mode event after selection
The system SHALL emit `agent:mode` WebSocket event with execution mode decision.

#### Scenario: Planning mode selected
- **WHEN** complexity assessment indicates needsPlanning=true
- **THEN** `agent:mode` event includes mode='planning' and reason string

#### Scenario: ReAct mode selected
- **WHEN** complexity assessment indicates needsPlanning=false
- **THEN** `agent:mode` event includes mode='react' and reason string

### Requirement: Agent emits query_rewrite event after optimization
The system SHALL emit `agent:query_rewrite` WebSocket event with optimized query.

#### Scenario: Query rewritten
- **WHEN** query-planner builds query strategy
- **THEN** `agent:query_rewrite` event includes primaryQuery and expandedTerms array

#### Scenario: Original query preserved
- **WHEN** query optimization completes
- **THEN** event includes originalQuery field for comparison

### Requirement: Agent emits template event after matching
The system SHALL emit `agent:template` WebSocket event with template matching results.

#### Scenario: Template attempts logged
- **WHEN** TemplateMatcher tries all available templates
- **THEN** `agent:template` event includes templateAttempts array with each attempt's result

#### Scenario: Template matched successfully
- **WHEN** a template matches the query criteria
- **THEN** event includes matchedTemplate field with template name

#### Scenario: Template matching failed
- **WHEN** no template matches the query
- **THEN** event includes fallbackReason field explaining why all templates failed

### Requirement: Agent emits dag event after planning (Planning mode only)
The system SHALL emit `agent:dag` WebSocket event with task DAG structure when Planning mode is active.

#### Scenario: DAG created
- **WHEN** TaskPlanner generates task DAG
- **THEN** `agent:dag` event includes tasks array with id, type, dependencies

#### Scenario: DAG validated
- **WHEN** DAG validation completes
- **THEN** event includes validation result and corrected DAG if auto-correction applied

### Requirement: Agent emits execution event during DAG execution
The system SHALL emit `agent:execution` WebSocket event with execution progress.

#### Scenario: Task started
- **WHEN** a DAG task begins execution
- **THEN** `agent:execution` event includes taskId, status='running', and currentRound

#### Scenario: Task completed
- **WHEN** a DAG task completes successfully
- **THEN** `agent:execution` event includes taskId, status='completed', and resultCount

#### Scenario: Task failed
- **WHEN** a DAG task fails
- **THEN** `agent:execution` event includes taskId, status='failed', and error message

### Requirement: Agent emits complete event on finish
The system SHALL emit `agent:complete` WebSocket event with final Agent result.

#### Scenario: Agent execution completed
- **WHEN** Agent finishes all phases and generates answer
- **THEN** `agent:complete` event includes visualization and executionTrace data

#### Scenario: Statistics included
- **WHEN** Agent completes
- **THEN** event includes stats with totalTimeMs, taskCount, and llmCallCount

### Requirement: Events are sent in correct order
The system SHALL emit Agent events in the defined sequence.

#### Scenario: Event sequence for Planning mode
- **WHEN** Planning mode is selected
- **THEN** events are emitted in order: input → entities → complexity → mode → query_rewrite → template → dag → execution → retrieval:* → generation:* → complete

#### Scenario: Event sequence for ReAct mode
- **WHEN** ReAct mode is selected
- **THEN** events are emitted in order: input → entities → complexity → mode → query_rewrite → retrieval:* → generation:* → complete