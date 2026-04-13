## ADDED Requirements

### Requirement: Chat interface provides query input
The system SHALL provide a chat-style interface for users to submit queries about indexed documents.

#### Scenario: User submits query through chat
- **WHEN** user types a query in the chat input field and presses Enter or clicks Send
- **THEN** system sends the query to `/api/chat/query` endpoint and displays the response

#### Scenario: Empty query is rejected
- **WHEN** user submits an empty query
- **THEN** system does not send request and shows validation message "Please enter a query"

### Requirement: Chat interface displays query results
The system SHALL display retrieval results in a structured format within the chat interface.

#### Scenario: Results are displayed with similarity scores
- **WHEN** query returns results with similarity scores
- **THEN** system displays each result with percentage score (e.g., "83%") and source document ID

#### Scenario: Results are expandable for content preview
- **WHEN** user clicks on a result card
- **THEN** system expands the card to show content preview (up to 500 characters)

#### Scenario: No results message is shown
- **WHEN** query returns empty results array
- **THEN** system displays message "No documents have been processed. Upload documents first."

### Requirement: Chat interface maintains conversation history
The system SHALL maintain a conversation history showing all queries and responses.

#### Scenario: History is displayed chronologically
- **WHEN** user views the chat interface
- **THEN** system displays all previous messages in chronological order with timestamps

#### Scenario: History can be cleared
- **WHEN** user clicks Clear button
- **THEN** system clears all conversation history and calls `/api/chat/history` DELETE endpoint

### Requirement: Chat interface shows loading state
The system SHALL indicate when a query is being processed.

#### Scenario: Loading indicator during query
- **WHEN** query request is in progress
- **THEN** system displays "Thinking..." message with animation

#### Scenario: Loading ends on response
- **WHEN** query response is received or error occurs
- **THEN** system removes loading indicator and displays result or error

### Requirement: Chat interface handles errors gracefully
The system SHALL display error messages when queries fail.

#### Scenario: API error is displayed
- **WHEN** query request fails with error
- **THEN** system displays error message in red/yellow banner at bottom of chat area

#### Scenario: Network error is handled
- **WHEN** network connection fails during query
- **THEN** system displays "Network error. Please check connection and try again."