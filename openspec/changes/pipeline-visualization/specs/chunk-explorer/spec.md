## ADDED Requirements

### Requirement: ChunkExplorer displays chunk hierarchy
The system SHALL display chunks in a hierarchical tree structure showing parent-child relationships.

#### Scenario: Tree view display
- **WHEN** ChunkExplorer loads with chunks data
- **THEN** system displays parent chunks with expandable child small chunks underneath

#### Scenario: Parent chunk expansion
- **WHEN** user clicks on a parent chunk
- **THEN** system expands to show all child small chunks with quality scores

#### Scenario: Grid view switch
- **WHEN** user selects grid view mode
- **THEN** system displays chunks as cards in a grid layout

### Requirement: ChunkExplorer supports filtering and sorting
The system SHALL allow users to filter and sort chunks.

#### Scenario: Level filtering
- **WHEN** user selects filter by level (all/small/parent)
- **THEN** system displays only chunks matching selected level

#### Scenario: Quality sorting
- **WHEN** user selects sort by quality
- **THEN** system sorts chunks descending by quality score

#### Scenario: Position sorting
- **WHEN** user selects sort by position
- **THEN** system sorts chunks by document position (start offset)

### Requirement: ChunkExplorer shows chunk detail modal
The system SHALL display detailed chunk information in a modal.

#### Scenario: Chunk detail display
- **WHEN** user clicks on a chunk card or tree node
- **THEN** system opens modal showing chunk ID, type, content, statistics

#### Scenario: Quality score visualization
- **WHEN** chunk detail modal opens
- **THEN** system displays quality score with color indicator (green for >0.8, yellow for 0.6-0.8, red for <0.6)

#### Scenario: Content copy
- **WHEN** user clicks "Copy Content" in detail modal
- **THEN** system copies full chunk content to clipboard

### Requirement: ChunkExplorer receives real-time chunk creation events
The system SHALL update chunk list in response to WebSocket events.

#### Scenario: chunk:created event handling
- **WHEN** frontend receives `chunk:created` event
- **THEN** system adds new chunk to list with fade-in animation

#### Scenario: Chunk count update
- **WHEN** new chunk is added
- **THEN** system updates total chunk count with number animation effect

### Requirement: ChunkExplorer supports pagination
The system SHALL paginate chunk display for large documents.

#### Scenario: Page navigation
- **WHEN** user clicks next/previous page
- **THEN** system loads and displays next/previous page of chunks

#### Scenario: Page size indicator
- **WHEN** pagination controls display
- **THEN** system shows current page range (e.g., "第 1-10 个 (共 47)")