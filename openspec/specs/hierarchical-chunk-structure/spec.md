## ADDED Requirements

### Requirement: Hierarchical chunk structure
The system SHALL maintain a two-level hierarchical structure for chunks: small chunks for retrieval and parent chunks for context.

#### Scenario: Two-level hierarchy
- **WHEN** document is chunked
- **THEN** the system creates both small-level chunks and parent-level chunks

#### Scenario: Parent-child relationship
- **WHEN** small chunks are created
- **THEN** each small chunk references its parent chunk via parentId

#### Scenario: Parent contains children
- **WHEN** parent chunk is created
- **THEN** parent chunk maintains list of childIds for all contained small chunks

### Requirement: Small chunk optimization
The system SHALL create small chunks optimized for precise retrieval matching.

#### Scenario: Small chunk sizing
- **WHEN** small chunks are created
- **THEN** small chunks target configurable size (default 100-300 tokens)

#### Scenario: Small chunk embedding
- **WHEN** small chunks are created
- **THEN** each small chunk has its own embedding for retrieval

#### Scenario: Small chunk boundary
- **WHEN** small chunk boundary is determined
- **THEN** boundary aligns with semantic cliff or natural sentence boundary

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

### Requirement: Hierarchical chunk data structure
The system SHALL define standard data structure for hierarchical chunks.

#### Scenario: Chunk interface
- **WHEN** hierarchical chunk is created
- **THEN** chunk includes: id, content, embedding, level, parentId/childIds, position, qualityScore

#### Scenario: Level identification
- **WHEN** chunk level is set
- **THEN** level is either 'small' or 'parent'

#### Scenario: Embedding vector
- **WHEN** chunk is created
- **THEN** chunk includes embedding vector for similarity calculations

### Requirement: Hierarchical storage and retrieval
The system SHALL store and retrieve chunks maintaining hierarchical relationships.

#### Scenario: Bidirectional lookup
- **WHEN** small chunk is retrieved
- **THEN** system can lookup its parent chunk

#### Scenario: Children enumeration
- **WHEN** parent chunk is retrieved
- **THEN** system can enumerate all child small chunks

#### Scenario: Hierarchical persistence
- **WHEN** chunks are stored
- **THEN** parent-child relationships are preserved in storage

### Requirement: Parent chunk size limits
The system SHALL enforce maximum size limits on parent chunks to prevent context overflow.

#### Scenario: Max parent size
- **WHEN** parent chunk would exceed configured maximum size
- **THEN** system splits parent into multiple parent chunks at semantic boundary

#### Scenario: Size configuration
- **WHEN** parent chunk size limit is configured
- **THEN** system applies limit to all parent chunk creation

#### Scenario: Overflow handling
- **WHEN** parent chunk exceeds limit with no clear boundary
- **THEN** system creates overflow parent with reduced context

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