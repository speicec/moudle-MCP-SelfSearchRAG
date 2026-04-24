## MODIFIED Requirements

### Requirement: Document metadata persistence
The system SHALL persist document metadata separate from file storage.

#### Scenario: Metadata storage format
- **WHEN** document metadata is stored
- **THEN** system saves as JSON file with document ID as filename, including title, author, year, and guidelineSource fields

#### Scenario: Metadata retrieval
- **WHEN** document list API is called
- **THEN** system reads metadata from persisted JSON files, including all extracted fields

#### Scenario: Metadata includes extracted PDF info
- **WHEN** document is processed from PDF
- **THEN** metadata includes title (from PDF info or filename fallback), author, year (inferred), and guidelineSource (if medical)

## ADDED Requirements

### Requirement: Document metadata extraction during parsing
The system SHALL extract PDF metadata during document parsing stage.

#### Scenario: PDF info extraction
- **WHEN** PDF document is parsed
- **THEN** system extracts Title, Author, Subject, CreationDate from pdf-parse data.info

#### Scenario: Year inference
- **WHEN** document is parsed
- **THEN** system infers year from title, filename, or CreationDate with priority order

#### Scenario: Guideline source identification
- **WHEN** document is parsed and title matches medical guideline pattern
- **THEN** system identifies and stores guidelineSource

### Requirement: Document list API includes extracted metadata
The system SHALL return extracted metadata in document list API response.

#### Scenario: Metadata in document list
- **WHEN** client GETs /api/documents
- **THEN** each document includes title, author, year, and guidelineSource fields

#### Scenario: Fallback for missing metadata
- **WHEN** document has no extracted title
- **THEN** system returns filename (without extension) as title