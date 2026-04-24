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

### Requirement: Frontend UI provides Tab-based visualization layout
The system SHALL provide a tabbed layout for visualization components.

#### Scenario: Tab navigation
- **WHEN** user clicks on a tab (处理进度/分块结构/检索过程/系统统计)
- **THEN** system switches to display corresponding visualization component

#### Scenario: Tab state persistence
- **WHEN** user switches tabs
- **THEN** system maintains state for all tabs, allowing seamless switching without data loss

### Requirement: Frontend UI provides left panel with quick actions
The system SHALL provide a fixed left panel for quick upload and query actions.

#### Scenario: Quick upload panel
- **WHEN** left panel renders
- **THEN** system displays file upload area with drag-and-drop support

#### Scenario: Quick query panel
- **WHEN** left panel renders
- **THEN** system displays query input field with send button

#### Scenario: Document list preview
- **WHEN** left panel renders
- **THEN** system displays condensed document list with status indicators

### Requirement: Frontend UI provides WebSocket connection indicator
The system SHALL display WebSocket connection status.

#### Scenario: Connected indicator
- **WHEN** WebSocket is connected
- **THEN** system displays green "已连接 WebSocket" indicator in header

#### Scenario: Disconnected indicator
- **WHEN** WebSocket is disconnected
- **THEN** system displays red "未连接 WebSocket" indicator in header

### Requirement: Frontend UI provides visualization state stores
The system SHALL provide Zustand stores for visualization components.

#### Scenario: timelineStore initialization
- **WHEN** visualization module loads
- **THEN** system initializes timelineStore with documentId, startTime, stages array, and status

#### Scenario: chunkStore initialization
- **WHEN** visualization module loads
- **THEN** system initializes chunkStore with documentId, chunks array, selectedChunkId, viewMode, filterLevel, and pagination state

#### Scenario: statsStore initialization
- **WHEN** visualization module loads
- **THEN** system initializes statsStore with pipelineStats, retrievalStats, chunkStats, and stageTimeDistribution

### Requirement: EvidenceCard displays GRADE evidence metadata
The system SHALL extend EvidenceCard component to display GRADE evidence metadata when available.

#### Scenario: EvidenceCard receives GRADE data
- **WHEN** EvidenceCard receives result with evidenceEvaluation
- **THEN** component displays GRADE badge instead of quality badge based on similarityScore
- **AND** badge shows grade (A/B/C/D) with literature type label

#### Scenario: EvidenceCard expanded view shows full metadata
- **WHEN** user expands EvidenceCard
- **THEN** expanded view shows: literatureType, sourceAuthority, timeWeight, compositeScore
- **AND** displays expirationWarning if present

#### Scenario: EvidenceCard shows authority indicator
- **WHEN** evidenceEvaluation contains sourceAuthority
- **THEN** EvidenceCard header shows authority level indicator
- **AND** indicator uses different icon for international/national/local

### Requirement: EvidencePanel shows GRADE statistics
The system SHALL extend EvidencePanel to show GRADE distribution statistics.

#### Scenario: EvidencePanel header shows grade distribution
- **WHEN** EvidencePanel receives results with evidenceEvaluation
- **THEN** header shows grade distribution bar chart (A/B/C/D segments)
- **AND** shows average compositeScore in statistics section

#### Scenario: EvidencePanel quality distribution chart
- **WHEN** results contain evidenceEvaluation
- **THEN** quality distribution chart uses GRADE grades instead of similarityScore-based grades
- **AND** chart labels show GRADE A/B/C/D

### Requirement: RetrievalResult type includes evidenceEvaluation
The system SHALL extend frontend RetrievalResult type to include optional evidenceEvaluation.

#### Scenario: RetrievalResult type extension
- **WHEN** frontend store processes retrieval results
- **THEN** RetrievalResult interface includes optional evidenceEvaluation field
- **AND** evidenceEvaluation type matches backend EvidenceEvaluation interface

#### Scenario: Store handles results with or without GRADE
- **WHEN** WebSocket event contains results
- **THEN** store handles both results with evidenceEvaluation and without
- **AND** components gracefully handle missing evidenceEvaluation

### Requirement: AnswerCard displays overall evidence grade
The system SHALL display overall evidence grade in AnswerCard footer.

#### Scenario: AnswerCard shows evidence grade summary
- **WHEN** answer includes evidenceGrade field
- **THEN** AnswerCard footer displays "证据等级: GRADE X" with description
- **AND** shows number of sources per grade level

#### Scenario: AnswerCard shows conflict warning
- **WHEN** evidenceStatistics.conflictDetected is true
- **THEN** AnswerCard displays conflict warning in warnings section
- **AND** warning highlights conflicting sources