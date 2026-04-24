## Requirements

### Requirement: PDF metadata extraction preserves document info
The system SHALL extract and preserve PDF document metadata from pdf-parse library's data.info field.

#### Scenario: Title extraction
- **WHEN** PDF document has Title in info field
- **THEN** system extracts Title as document title

#### Scenario: Author extraction
- **WHEN** PDF document has Author in info field
- **THEN** system extracts Author as document author

#### Scenario: CreationDate extraction
- **WHEN** PDF document has CreationDate in info field
- **THEN** system parses PDF date format and extracts CreationDate

#### Scenario: Subject extraction
- **WHEN** PDF document has Subject in info field
- **THEN** system extracts Subject as document subject

#### Scenario: Missing metadata fallback
- **WHEN** PDF document has no info field or empty info
- **THEN** system uses filename (without extension) as fallback title

### Requirement: Year inference from multiple sources
The system SHALL infer document publication year from multiple sources with priority order.

#### Scenario: Year from title
- **WHEN** document title contains year pattern (e.g., "Standards of Care 2024")
- **THEN** system extracts year from title as primary source

#### Scenario: Year from filename
- **WHEN** title has no year but filename contains year pattern (e.g., "ADA_2024.pdf")
- **THEN** system extracts year from filename as secondary source

#### Scenario: Year from CreationDate
- **WHEN** neither title nor filename has year but CreationDate exists
- **THEN** system uses CreationDate year as tertiary source

#### Scenario: No year available
- **WHEN** all sources have no year information
- **THEN** system returns undefined for year field

### Requirement: Metadata propagation to chunk level
The system SHALL propagate document-level metadata to each chunk's metadata field.

#### Scenario: Chunk metadata includes document title
- **WHEN** chunk is created from parsed document
- **THEN** chunk.metadata.documentTitle equals document title

#### Scenario: Chunk metadata includes document author
- **WHEN** chunk is created from parsed document
- **THEN** chunk.metadata.documentAuthor equals document author

#### Scenario: Chunk metadata includes document year
- **WHEN** chunk is created from parsed document with inferred year
- **THEN** chunk.metadata.documentYear equals inferred year

#### Scenario: Chunk metadata backward compatibility
- **WHEN** chunk is created from legacy data without metadata
- **THEN** chunk.metadata documentTitle/Author/Year are undefined and system uses fallback