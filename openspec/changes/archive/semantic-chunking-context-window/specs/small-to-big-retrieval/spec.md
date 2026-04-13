## MODIFIED Requirements

### Requirement: Parent chunk expansion
The system SHALL expand retrieved small chunks to their parent chunks for final response.

#### Scenario: Parent lookup
- **WHEN** small chunk is retrieved
- **THEN** system looks up its parent chunk via parentId reference

#### Scenario: Duplicate parent merging
- **WHEN** multiple small chunks belong to same parent
- **THEN** system returns single parent chunk instead of duplicates

#### Scenario: Context window extraction
- **WHEN** parent chunk is expanded
- **THEN** system extracts context window around the matched small chunk
- **AND** returns both `contextWindow` and `parentChunkContent` fields

#### Scenario: Window position tracking
- **WHEN** context window is extracted
- **THEN** system records `windowStart` and `windowEnd` positions
- **AND** positions are relative to parent chunk content

## ADDED Requirements

### Requirement: Context window extraction utility
The system SHALL provide a utility function for extracting context windows from parent content.

#### Scenario: Basic extraction
- **WHEN** `extractContextWindow()` is called with parent content and small chunk content
- **THEN** the function returns the substring around the small chunk match

#### Scenario: Match position finding
- **WHEN** extracting context window
- **THEN** the system finds the position of small chunk content within parent content
- **AND** handles cases where small chunk appears multiple times

#### Scenario: Boundary handling
- **WHEN** context window would extend beyond parent content boundaries
- **THEN** the system clips the window to valid content range