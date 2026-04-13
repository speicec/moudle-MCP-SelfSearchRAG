# Chat Tab Interface Specification

## Requirement: Chat interface is independent tab
The system SHALL provide Chat as an independent main tab, not embedded in sidebar.

### Scenario: Chat tab visible in header
- **WHEN** user views the main interface
- **THEN** Chat tab is visible in header navigation alongside other tabs

### Scenario: Chat tab occupies main area
- **WHEN** user selects Chat tab
- **THEN** Chat interface occupies the main content area (col-span-8 or larger)

### Scenario: Chat tab is default active tab
- **WHEN** user first opens the application
- **THEN** Chat tab is the default active tab

## Requirement: Chat interface displays message history
The system SHALL display conversation history with user queries and assistant responses.

### Scenario: Messages displayed chronologically
- **WHEN** user views chat history
- **THEN** messages are displayed in chronological order with timestamps

### Scenario: User message styling
- **WHEN** user message is displayed
- **THEN** message appears with blue background on the right side

### Scenario: Assistant message styling
- **WHEN** assistant message is displayed
- **THEN** message appears with gray background on the left side

## Requirement: Chat interface supports streaming answer display
The system SHALL display LLM answers with streaming effect (character-by-character).

### Scenario: Answer streams in
- **WHEN** generation:answer WebSocket events are received
- **THEN** answer text is appended character-by-character with cursor animation

### Scenario: Streaming stops on completion
- **WHEN** generation:complete WebSocket event is received
- **THEN** streaming cursor animation stops and final answer is displayed

## Requirement: Chat interface shows sources with answer
The system SHALL display retrieved sources alongside the generated answer.

### Scenario: Sources summary shown
- **WHEN** answer generation completes
- **THEN** sources summary "📚 参考资料: X个片段" is shown with expand button

### Scenario: Source cards expandable
- **WHEN** user clicks expand sources
- **THEN** source cards with full chunk content and similarity score are shown

### Scenario: Source cards clickable
- **WHEN** user clicks a source card
- **THEN** full chunk content is displayed in expanded view

## Requirement: Chat interface has input area
The system SHALL provide input area at bottom for user queries.

### Scenario: Input text field
- **WHEN** user views chat interface
- **THEN** text input field is visible at bottom of chat area

### Scenario: Send button
- **WHEN** user types query
- **THEN** Send button becomes enabled and clicking submits query

### Scenario: Enter key submits
- **WHEN** user presses Enter key in input field
- **THEN** query is submitted

## Requirement: Chat interface shows loading state
The system SHALL indicate when query is being processed.

### Scenario: Loading indicator during retrieval
- **WHEN** retrieval phase is running
- **THEN** "正在检索..." indicator is shown

### Scenario: Loading indicator during generation
- **WHEN** LLM generation is running
- **THEN** "正在思考..." indicator is shown with thinking chain animation