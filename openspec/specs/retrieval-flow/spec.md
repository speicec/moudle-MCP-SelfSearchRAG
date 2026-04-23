---
capability: retrieval-flow
version: 1.1
created: 2025-04-15
modified: 2026-04-22
---

# Spec: Retrieval Flow

## Requirements

### Requirement: RetrievalFlow visualizes query embedding process
The system SHALL display the query-to-embedding transformation process.

#### Scenario: Query input display
- **WHEN** user submits a query
- **THEN** system displays query text with arrow pointing to embedding model

#### Scenario: Embedding generation animation
- **WHEN** query embedding is being generated
- **THEN** system shows flowing animation from text to model, then displays embedding vector preview

#### Scenario: Embedding dimension display
- **WHEN** embedding generation completes
- **THEN** system displays vector dimension (e.g., "384 维")

### Requirement: RetrievalFlow visualizes similarity search
The system SHALL display the similarity search process with match highlighting.

#### Scenario: Vector space visualization
- **WHEN** similarity search starts
- **THEN** system displays abstract vector space with query vector at center

#### Scenario: Match highlighting
- **WHEN** matches are found
- **THEN** system highlights matched chunks with similarity scores, showing aggregation animation

#### Scenario: Search completion
- **WHEN** similarity search completes
- **THEN** system displays duration and number of chunks scanned

### Requirement: RetrievalFlow visualizes parent expansion
The system SHALL display the Small-to-Big parent expansion process.

#### Scenario: Expansion animation
- **WHEN** parent expansion starts
- **THEN** system shows arrows from matched small chunks to their parent chunks

#### Scenario: Parent selection display
- **WHEN** parent expansion completes
- **THEN** system displays selected parent chunks with total word count

### Requirement: RetrievalFlow displays final results
The system SHALL display retrieval results with source context.

#### Scenario: Result card display
- **WHEN** retrieval completes
- **THEN** system displays result cards with similarity score, source document, and content preview

#### Scenario: Result card animation
- **WHEN** results are ready
- **THEN** system slides in result cards sequentially from bottom

### Requirement: RetrievalFlow receives real-time retrieval events
The system SHALL update display in response to WebSocket events.

#### Scenario: retrieval:start event handling
- **WHEN** frontend receives `retrieval:start` event
- **THEN** system initializes retrieval flow display with query

#### Scenario: retrieval:match event handling
- **WHEN** frontend receives `retrieval:match` event
- **THEN** system highlights new match in vector space visualization

#### Scenario: retrieval:complete event handling
- **WHEN** frontend receives `retrieval:complete` event
- **THEN** system displays final results and total duration

### Requirement: RetrievalFlow visualizes complete Agent execution
The system SHALL display Agent visualization panels before retrieval steps.

#### Scenario: Agent panels displayed first
- **WHEN** Agent events are received
- **THEN** Agent visualization panels (mode, entities, query_rewrite, template, dag) appear before existing retrieval steps

#### Scenario: Agent state integrated with retrieval state
- **WHEN** Agent completes entity recognition and query rewriting
- **THEN** retrieval flow uses optimized query for embedding visualization

### Requirement: RetrievalFlow receives Agent WebSocket events
The system SHALL handle agent:* WebSocket events in addition to retrieval:* events.

#### Scenario: agent:input event handling
- **WHEN** frontend receives agent:input event
- **THEN** retrievalStore sets originalQuery and clears previous visualization state

#### Scenario: agent:entities event handling
- **WHEN** frontend receives agent:entities event
- **THEN** retrievalStore updates entityMatches array

#### Scenario: agent:mode event handling
- **WHEN** frontend receives agent:mode event
- **THEN** retrievalStore sets executionMode and executionReason

#### Scenario: agent:query_rewrite event handling
- **WHEN** frontend receives agent:query_rewrite event
- **THEN** retrievalStore sets queryRewriting with primaryQuery and expandedTerms

#### Scenario: agent:template event handling
- **WHEN** frontend receives agent:template event
- **THEN** retrievalStore sets templateAttempts and matchedTemplate

#### Scenario: agent:dag event handling
- **WHEN** frontend receives agent:dag event
- **THEN** retrievalStore sets dagTasks for Planning mode visualization

#### Scenario: agent:execution event handling
- **WHEN** frontend receives agent:execution event
- **THEN** retrievalStore updates task status in dagTasks

#### Scenario: agent:complete event handling
- **WHEN** frontend receives agent:complete event
- **THEN** retrievalStore sets visualization and executionTrace from Agent result

## ADDED Requirements

### Requirement: RetrievalFlow handles direct_retrieval mode event
The system SHALL display direct retrieval mode when agent:mode event has mode 'direct_retrieval'.

#### Scenario: agent:mode event with direct_retrieval
- **WHEN** frontend receives agent:mode event with mode: 'direct_retrieval'
- **THEN** retrievalStore sets executionMode to 'direct_retrieval'
- **AND** displays simplified flow (no ReAct loop visualization)

#### Scenario: Direct retrieval mode display
- **WHEN** executionMode is 'direct_retrieval'
- **THEN** system shows: input → entities → direct retrieval → complete
- **AND** no iteration or think/act/observe steps displayed

#### Scenario: Direct retrieval reason display
- **WHEN** agent:mode event includes reason with confidence value
- **THEN** system displays reason explaining low confidence trigger