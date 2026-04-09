## ADDED Requirements

### Requirement: Frontend UI provides DocumentManager component
The system SHALL provide a React component for document management with upload, list, and delete functionality.

#### Scenario: Document upload success
- **WHEN** user selects a file and clicks "Upload"
- **THEN** system uploads file to backend and displays success message

#### Scenario: Document list display
- **WHEN** DocumentManager component loads
- **THEN** system fetches and displays all uploaded documents with name, size, and upload date

#### Scenario: Document deletion
- **WHEN** user clicks "Delete" on a document
- **THEN** system deletes document and updates list

### Requirement: Frontend UI provides ChatWindow component
The system SHALL provide a React component for chat-based retrieval interaction.

#### Scenario: Query input and submission
- **WHEN** user enters a query and clicks "Send"
- **THEN** system sends query to backend and displays user message

#### Scenario: Retrieval result display
- **WHEN** backend returns retrieval results
- **THEN** system displays retrieved chunks with source document references

#### Scenario: Error handling in chat
- **WHEN** backend returns an error
- **THEN** system displays error message in chat window

### Requirement: Frontend UI provides PipelineVisualizer component
The system SHALL provide a React component for real-time pipeline execution visualization.

#### Scenario: Pipeline stages display
- **WHEN** PipelineVisualizer component receives stage:start event
- **THEN** system displays pipeline stages as progress nodes

#### Scenario: Stage progress update
- **WHEN** component receives stage:progress event
- **THEN** system updates progress bar for corresponding stage

#### Scenario: Pipeline completion
- **WHEN** component receives pipeline:complete event
- **THEN** system displays completion status and final statistics

### Requirement: Frontend uses Zustand state management
The system SHALL use Zustand for unified state management across all components.

#### Scenario: Document state management
- **WHEN** document is uploaded or deleted
- **THEN** Zustand store updates document list state

#### Scenario: WebSocket connection state
- **WHEN** WebSocket connection status changes
- **THEN** Zustand store updates connection state

#### Scenario: Pipeline event state
- **WHEN** pipeline event is received
- **THEN** Zustand store updates pipeline execution state

### Requirement: Frontend uses Tailwind CSS styling
The system SHALL use Tailwind CSS for responsive styling across all components.

#### Scenario: Component styling
- **WHEN** component renders
- **THEN** system applies Tailwind utility classes for layout and appearance

#### Scenario: Dark mode support
- **WHEN** user toggles dark mode
- **THEN** system switches to dark theme using Tailwind dark: variants

### Requirement: Frontend bundle is served by backend
The system SHALL bundle frontend assets and serve them from the Fastify server.

#### Scenario: Static file serving
- **WHEN** client requests / or /assets/*
- **THEN** Fastify serves bundled frontend files

#### Scenario: Bundle generation
- **WHEN** build process runs
- **THEN** Vite generates production bundle in dist/frontend/