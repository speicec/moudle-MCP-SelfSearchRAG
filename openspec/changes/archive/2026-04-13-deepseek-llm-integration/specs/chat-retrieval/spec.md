## ADDED Requirements

### Requirement: Chat retrieval triggers LLM generation after retrieval
The system SHALL trigger LLM generation phase after retrieval phase completes.

#### Scenario: Retrieval followed by generation
- **WHEN** retrieval phase completes with results
- **THEN** system automatically triggers LLM generation phase with retrieved context

#### Scenario: Retrieval with no results
- **WHEN** retrieval phase returns no results
- **THEN** system triggers LLM generation with empty context indicator

### Requirement: Chat retrieval provides context to LLM
The system SHALL provide retrieved chunks as context for LLM prompt.

#### Scenario: Context includes parent chunks
- **WHEN** constructing LLM prompt context
- **THEN** parentChunkContent from retrieval results is included

#### Scenario: Context limited by token count
- **WHEN** retrieved chunks exceed token limit
- **THEN** context is truncated to fit within maxContextTokens limit

## MODIFIED Requirements

### Requirement: Chat interface provides query input
The system SHALL provide a chat-style interface for users to submit queries about indexed documents.

#### Scenario: User submits query through chat
- **WHEN** user types a query in the chat input field and presses Enter or clicks Send
- **THEN** system sends the query initiating two-phase flow: retrieval then LLM generation

#### Scenario: Empty query is rejected
- **WHEN** user submits an empty query
- **THEN** system does not send request and shows validation message "Please enter a query"

### Requirement: Chat interface displays query results
The system SHALL display retrieval results AND LLM-generated answer in a structured format within the chat interface.

#### Scenario: Results are displayed with similarity scores
- **WHEN** query returns results with similarity scores
- **THEN** system displays each result with percentage score (e.g., "83%") and source document ID in thinking chain

#### Scenario: Results are expandable for content preview
- **WHEN** user clicks on a result card
- **THEN** system expands the card to show content preview (up to 500 characters)

#### Scenario: No results message is shown
- **WHEN** query returns empty results array
- **THEN** system displays message "No documents have been processed. Upload documents first."

#### Scenario: LLM answer is displayed
- **WHEN** LLM generation completes
- **THEN** system displays generated answer with sources reference section