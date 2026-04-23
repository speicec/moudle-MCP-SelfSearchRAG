---
capability: retrieval-flow
version: 1.1
created: 2026-04-22
modified_from: openspec/specs/retrieval-flow/spec.md
---

# Spec: Retrieval Flow (Modified)

## MODIFIED Requirements

### Requirement: RetrievalFlow visualizes complete Agent execution
The system SHALL display Agent visualization panels before retrieval steps.

#### Scenario: Agent panels displayed first
- **WHEN** Agent events are received
- **THEN** Agent visualization panels (mode, entities, query_rewrite, template, dag) appear before existing retrieval steps

#### Scenario: Agent state integrated with retrieval state
- **WHEN** Agent completes entity recognition and query rewriting
- **THEN** retrieval flow uses optimized query for embedding visualization

## ADDED Requirements

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