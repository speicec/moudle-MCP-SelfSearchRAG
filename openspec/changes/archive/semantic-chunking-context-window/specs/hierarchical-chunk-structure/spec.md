## MODIFIED Requirements

### Requirement: Parent chunk context preservation
The system SHALL create parent chunks that preserve complete semantic context.

#### Scenario: Parent chunk sizing
- **WHEN** parent chunks are created
- **THEN** parent chunks target configurable size (default 500-1500 tokens)

#### Scenario: Parent chunk embedding
- **WHEN** parent chunks are created
- **THEN** parent chunks have embeddings derived from constituent small chunks

#### Scenario: Parent chunk completeness
- **WHEN** parent chunk is formed
- **THEN** parent chunk contains complete semantic unit (paragraph, section, or topic)

#### Scenario: Structure boundary respect
- **WHEN** grouping small chunks into parent chunks
- **THEN** the system detects and respects structure boundaries
- **AND** does not merge small chunks across chapter or section boundaries

## ADDED Requirements

### Requirement: Structure boundary detection
The system SHALL detect structural boundaries in document content.

#### Scenario: Chapter boundary detection
- **WHEN** document contains chapter headings (e.g., "第一章", "Chapter 1")
- **THEN** the system identifies these as structure boundaries

#### Scenario: List start detection
- **WHEN** document contains numbered lists (e.g., "1.", "2.", "一、", "二、")
- **THEN** the system identifies list start as potential boundary

#### Scenario: Boundary confidence score
- **WHEN** structure boundary is detected
- **THEN** the system assigns a confidence score
- **AND** high-confidence boundaries are enforced during parent grouping

### Requirement: Structure-aware parent grouping
The system SHALL use structure boundaries during parent chunk creation.

#### Scenario: Boundary-enforced split
- **WHEN** grouping small chunks would cross a high-confidence structure boundary
- **THEN** the system splits the parent chunk at the boundary

#### Scenario: Boundary configuration
- **WHEN** HierarchicalStore is configured
- **THEN** it accepts `respectStructureBoundaries` parameter
- **AND** default is `true`

#### Scenario: Boundary pattern customization
- **WHEN** custom boundary patterns are provided
- **THEN** the system uses custom patterns in addition to defaults
- **AND** patterns are regular expressions matching boundary indicators