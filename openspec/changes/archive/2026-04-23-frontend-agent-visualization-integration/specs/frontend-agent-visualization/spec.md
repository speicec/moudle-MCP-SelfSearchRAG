---
capability: frontend-agent-visualization
version: 1.0
created: 2026-04-22
---

# Spec: Frontend Agent Visualization

## ADDED Requirements

### Requirement: RetrievalFlow displays execution mode
The system SHALL display Agent execution mode (ReAct/Planning) in RetrievalFlow component.

#### Scenario: Planning mode displayed
- **WHEN** agent:mode event received with mode='planning'
- **THEN** RetrievalFlow shows "Planning 模式" badge with reason

#### Scenario: ReAct mode displayed
- **WHEN** agent:mode event received with mode='react'
- **THEN** RetrievalFlow shows "ReAct 模式" badge with reason

### Requirement: RetrievalFlow displays entity recognition results
The system SHALL display recognized entities (diseases, drugs, indicators) in visualization panel.

#### Scenario: Disease entities displayed
- **WHEN** agent:entities event includes diseases array
- **THEN** panel shows each disease with matchedTerm → canonicalName mapping

#### Scenario: Drug entities displayed
- **WHEN** agent:entities event includes drugs array
- **THEN** panel shows each drug with matchedTerm → canonicalName mapping

#### Scenario: Indicator with value displayed
- **WHEN** agent:entities event includes indicators with value
- **THEN** panel shows indicator with matchedTerm, value, and unit (e.g., "eGFR=35 mL/min/1.73m²")

### Requirement: RetrievalFlow displays keyword matches
The system SHALL display matched relation keywords (contraindication, precaution, interaction, indication).

#### Scenario: Keywords matched
- **WHEN** visualization includes keywordMatches
- **THEN** panel shows each keyword with type badge and position in query

### Requirement: RetrievalFlow displays query rewriting
The system SHALL display original query and optimized query comparison.

#### Scenario: Query optimized
- **WHEN** agent:query_rewrite event received
- **THEN** panel shows originalQuery and primaryQuery with visual comparison

#### Scenario: Expanded terms displayed
- **WHEN** query_rewrite event includes expandedTerms
- **THEN** panel shows expansion terms as tags

### Requirement: RetrievalFlow displays execution path
The system SHALL display execution path stages as flow diagram.

#### Scenario: Planning path displayed
- **WHEN** mode='planning'
- **THEN** path shows: "Planning" → "Template Match" → "DAG Execution" → "Answer"

#### Scenario: ReAct path displayed
- **WHEN** mode='react'
- **THEN** path shows: "ReAct" → "Retrieval" → "Reasoning" → "Answer"

### Requirement: RetrievalFlow displays template matching attempts
The system SHALL display all template matching attempts with results.

#### Scenario: Template attempts displayed
- **WHEN** agent:template event received
- **THEN** panel shows each template with ✓ or ✗ indicator

#### Scenario: Matched template highlighted
- **WHEN** a template matched successfully
- **THEN** matched template shown with success styling and match reason

#### Scenario: Failed templates explained
- **WHEN** template failed to match
- **THEN** failed template shown with rejection reason

### Requirement: RetrievalFlow displays DAG structure (Planning mode)
The system SHALL display task DAG structure when Planning mode is active.

#### Scenario: DAG tasks displayed
- **WHEN** agent:dag event received
- **THEN** panel shows DAG tasks as nodes with connections

#### Scenario: Task status shown
- **WHEN** agent:execution events received
- **THEN** DAG visualization updates task nodes with running/completed/failed status

### Requirement: RetrievalFlow updates state on each Agent event
The system SHALL update retrievalStore state for each agent:* WebSocket event.

#### Scenario: agent:input updates state
- **WHEN** frontend receives agent:input event
- **THEN** retrievalStore.originalQuery is set

#### Scenario: agent:entities updates state
- **WHEN** frontend receives agent:entities event
- **THEN** retrievalStore.entityMatches is set

#### Scenario: agent:mode updates state
- **WHEN** frontend receives agent:mode event
- **THEN** retrievalStore.executionMode and executionReason are set

#### Scenario: agent:query_rewrite updates state
- **WHEN** frontend receives agent:query_rewrite event
- **THEN** retrievalStore.queryRewriting is set

#### Scenario: agent:template updates state
- **WHEN** frontend receives agent:template event
- **THEN** retrievalStore.templateAttempts and matchedTemplate are set

#### Scenario: agent:dag updates state
- **WHEN** frontend receives agent:dag event
- **THEN** retrievalStore.dagTasks is set

### Requirement: RetrievalFlow preserves existing retrieval visualization
The system SHALL continue displaying query embedding, similarity search, and parent expansion.

#### Scenario: Retrieval steps still shown
- **WHEN** Agent visualization panels are displayed
- **THEN** existing retrieval steps (向量化, 相似度搜索, 父块展开) are shown below Agent panels

### Requirement: Visualization panels are responsive
The system SHALL adapt visualization layout for different screen sizes.

#### Scenario: Compact layout on small screens
- **WHEN** viewport width < 768px
- **THEN** panels stack vertically with collapsible sections

#### Scenario: Expanded layout on large screens
- **WHEN** viewport width >= 1024px
- **THEN** panels use grid layout with side-by-side visualization