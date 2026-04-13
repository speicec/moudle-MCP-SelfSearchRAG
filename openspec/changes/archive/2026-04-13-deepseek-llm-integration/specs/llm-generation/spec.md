## ADDED Requirements

### Requirement: LLM service integrates with DeepSeek API
The system SHALL integrate with DeepSeek API for LLM-based answer generation.

#### Scenario: DeepSeek API call succeeds
- **WHEN** LLM generation service receives a query and context
- **THEN** system calls DeepSeek API with proper authentication and receives streaming response

#### Scenario: DeepSeek API call fails
- **WHEN** DeepSeek API call fails due to network or authentication error
- **THEN** system returns error message and optionally falls back to retrieval-only mode

### Requirement: LLM service supports streaming response
The system SHALL process DeepSeek SSE streaming response and convert to WebSocket events.

#### Scenario: SSE stream received
- **WHEN** DeepSeek API returns SSE stream with reasoning_content and content fields
- **THEN** system parses each SSE chunk and emits corresponding WebSocket events

#### Scenario: reasoning_content field extracted
- **WHEN** SSE chunk contains reasoning_content field
- **THEN** system emits generation:thinking WebSocket event with the thinking content

#### Scenario: content field extracted
- **WHEN** SSE chunk contains content field
- **THEN** system emits generation:answer WebSocket event with the answer content

### Requirement: LLM service uses deepseek-reasoner model
The system SHALL use the deepseek-reasoner model for native thinking chain support.

#### Scenario: Model configuration
- **WHEN** LLM generation service initializes
- **THEN** system uses deepseek-reasoner model by default (configurable via DEEPSEEK_MODEL env var)

#### Scenario: Thinking tokens separated
- **WHEN** DeepSeek returns response
- **THEN** thinking tokens (reasoning_content) and answer tokens (content) are separated for visualization

### Requirement: LLM service constructs RAG prompt
The system SHALL construct prompts combining user query with retrieved context.

#### Scenario: Prompt includes query
- **WHEN** constructing LLM prompt
- **THEN** prompt includes the user's original query text

#### Scenario: Prompt includes retrieved chunks
- **WHEN** constructing LLM prompt after retrieval phase
- **THEN** prompt includes retrieved document chunks as reference material section

#### Scenario: Prompt includes instructions
- **WHEN** constructing LLM prompt
- **THEN** prompt includes instructions to answer based on reference material

### Requirement: LLM service handles API configuration
The system SHALL support configurable DeepSeek API settings via environment variables.

#### Scenario: API key configuration
- **WHEN** DEEPSEEK_API_KEY environment variable is set
- **THEN** system uses the configured API key for authentication

#### Scenario: API URL configuration
- **WHEN** DEEPSEEK_BASE_URL environment variable is set
- **THEN** system uses the configured API endpoint (default: https://api.deepseek.com)

#### Scenario: Missing API key
- **WHEN** DEEPSEEK_API_KEY is not configured
- **THEN** system logs warning and LLM generation returns error