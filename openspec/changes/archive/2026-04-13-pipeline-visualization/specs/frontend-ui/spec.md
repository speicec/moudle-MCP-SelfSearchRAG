## ADDED Requirements

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