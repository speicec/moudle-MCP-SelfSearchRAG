---
capability: llm-generation
version: 1.1
created: 2026-04-22
modified_from: openspec/specs/llm-generation/spec.md
---

# Spec: LLM Generation (Modified for Agent Integration)

## MODIFIED Requirements

### Requirement: LLM service integrates with Medical Agent
The system SHALL use Medical Agent for query processing when enabled.

#### Scenario: Agent mode enabled
- **WHEN** enableAgent configuration is true and LLM service is available
- **THEN** HTTP Chat endpoint uses MedicalAgent.run() instead of direct retrieval

#### Scenario: Agent mode disabled
- **WHEN** enableAgent configuration is false or LLM service unavailable
- **THEN** HTTP Chat endpoint uses SmallToBigRetriever directly (fallback)

#### Scenario: Agent provides retrieval function
- **WHEN** MedicalAgent is created
- **THEN** Agent receives SmallToBigRetriever as retrieval function for RAG

### Requirement: LLM generation receives Agent visualization events
The system SHALL broadcast Agent events via WebSocket before generation events.

#### Scenario: Agent events broadcast before generation
- **WHEN** Agent executes query processing
- **THEN** agent:* events are broadcast in real-time before generation:* events

#### Scenario: Visualization callback registered
- **WHEN** MedicalAgent is created for HTTP Chat
- **THEN** Agent receives visualizationCallback for event broadcasting

## ADDED Requirements

### Requirement: LLM service creates LLMCaller for Agent
The system SHALL provide LLMCaller function to Medical Agent for reasoning.

#### Scenario: LLMCaller created
- **WHEN** MedicalAgent is instantiated
- **THEN** llmGenerationService.generateOnce is wrapped as LLMCaller function

#### Scenario: LLMCaller used for Agent reasoning
- **WHEN** Agent needs LLM reasoning (think, decide, generate_answer)
- **THEN** LLMCaller is called with appropriate prompt

### Requirement: LLM service uses Agent result for generation
The system SHALL use Agent's answer structure for final generation output.

#### Scenario: Agent answer used
- **WHEN** Agent execution completes successfully
- **THEN** generation:* events use Agent's answer.conclusion and answer.details

#### Scenario: Agent sources used
- **WHEN** Agent provides retrieval results
- **THEN** generation events include sources from AgentResult.retrievalResults