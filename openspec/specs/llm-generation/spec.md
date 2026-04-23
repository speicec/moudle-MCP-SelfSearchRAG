---
capability: llm-generation
version: 1.1
created: 2025-04-15
modified: 2026-04-22
---

# LLM Generation Specification

## Requirement: LLM service integrates with DeepSeek API
The system SHALL integrate with DeepSeek API for LLM-based answer generation.

### Scenario: DeepSeek API call succeeds
- **WHEN** LLM generation service receives a query and context
- **THEN** system calls DeepSeek API with proper authentication and receives streaming response

### Scenario: DeepSeek API call fails
- **WHEN** DeepSeek API call fails due to network or authentication error
- **THEN** system returns error message and optionally falls back to retrieval-only mode

## Requirement: LLM service supports streaming response
The system SHALL process DeepSeek SSE streaming response and convert to WebSocket events.

### Scenario: SSE stream received
- **WHEN** DeepSeek API returns SSE stream with reasoning_content and content fields
- **THEN** system parses each SSE chunk and emits corresponding WebSocket events

### Scenario: reasoning_content field extracted
- **WHEN** SSE chunk contains reasoning_content field
- **THEN** system emits generation:thinking WebSocket event with the thinking content

### Scenario: content field extracted
- **WHEN** SSE chunk contains content field
- **THEN** system emits generation:answer WebSocket event with the answer content

## Requirement: LLM service uses deepseek-reasoner model
The system SHALL use the deepseek-reasoner model for native thinking chain support.

### Scenario: Model configuration
- **WHEN** LLM generation service initializes
- **THEN** system uses deepseek-reasoner model by default (configurable via DEEPSEEK_MODEL env var)

### Scenario: Thinking tokens separated
- **WHEN** DeepSeek returns response
- **THEN** thinking tokens (reasoning_content) and answer tokens (content) are separated for visualization

## Requirement: LLM service constructs RAG prompt
The system SHALL construct prompts combining user query with retrieved context.

### Scenario: Prompt includes query
- **WHEN** constructing LLM prompt
- **THEN** prompt includes the user's original query text

### Scenario: Prompt includes retrieved chunks
- **WHEN** constructing LLM prompt after retrieval phase
- **THEN** prompt includes retrieved document chunks as reference material section

### Scenario: Prompt includes instructions
- **WHEN** constructing LLM prompt
- **THEN** prompt includes instructions to answer based on reference material

## Requirement: LLM service handles API configuration
The system SHALL support configurable DeepSeek API settings via environment variables.

### Scenario: API key configuration
- **WHEN** DEEPSEEK_API_KEY environment variable is set
- **THEN** system uses the configured API key for authentication

### Scenario: API URL configuration
- **WHEN** DEEPSEEK_BASE_URL environment variable is set
- **THEN** system uses the configured API endpoint (default: https://api.deepseek.com)

### Scenario: Missing API key
- **WHEN** DEEPSEEK_API_KEY is not configured
- **THEN** system logs warning and LLM generation returns error

## Requirement: LLM service integrates with Medical Agent
The system SHALL use Medical Agent for query processing when enabled.

### Scenario: Agent mode enabled
- **WHEN** enableAgent configuration is true and LLM service is available
- **THEN** HTTP Chat endpoint uses MedicalAgent.run() instead of direct retrieval

### Scenario: Agent mode disabled
- **WHEN** enableAgent configuration is false or LLM service unavailable
- **THEN** HTTP Chat endpoint uses SmallToBigRetriever directly (fallback)

### Scenario: Agent provides retrieval function
- **WHEN** MedicalAgent is created
- **THEN** Agent receives SmallToBigRetriever as retrieval function for RAG

## Requirement: LLM generation receives Agent visualization events
The system SHALL broadcast Agent events via WebSocket before generation events.

### Scenario: Agent events broadcast before generation
- **WHEN** Agent executes query processing
- **THEN** agent:* events are broadcast in real-time before generation:* events

### Scenario: Visualization callback registered
- **WHEN** MedicalAgent is created for HTTP Chat
- **THEN** Agent receives visualizationCallback for event broadcasting

## Requirement: LLM service creates LLMCaller for Agent
The system SHALL provide LLMCaller function to Medical Agent for reasoning.

### Scenario: LLMCaller created
- **WHEN** MedicalAgent is instantiated
- **THEN** llmGenerationService.generateOnce is wrapped as LLMCaller function

### Scenario: LLMCaller used for Agent reasoning
- **WHEN** Agent needs LLM reasoning (think, decide, generate_answer)
- **THEN** LLMCaller is called with appropriate prompt

## Requirement: LLM service uses Agent result for generation
The system SHALL use Agent's answer structure for final generation output.

### Scenario: Agent answer used
- **WHEN** Agent execution completes successfully
- **THEN** generation:* events use Agent's answer.conclusion and answer.details

### Scenario: Agent sources used
- **WHEN** Agent provides retrieval results
- **THEN** generation events include sources from AgentResult.retrievalResults