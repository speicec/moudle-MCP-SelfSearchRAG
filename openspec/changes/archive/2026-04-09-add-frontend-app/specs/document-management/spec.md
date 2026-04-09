## ADDED Requirements

### Requirement: Document upload API accepts multipart form data
The system SHALL provide HTTP API endpoint for document upload via multipart form data.

#### Scenario: Successful upload
- **WHEN** client POSTs file to /api/documents/upload
- **THEN** system accepts file, generates document ID, and returns document metadata

#### Scenario: File size limit enforcement
- **WHEN** uploaded file exceeds size limit (50MB)
- **THEN** system rejects upload and returns 413 error

#### Scenario: Supported file types
- **WHEN** uploaded file is PDF, TXT, or MD
- **THEN** system accepts file and stores for processing

#### Scenario: Unsupported file type rejection
- **WHEN** uploaded file is unsupported type
- **THEN** system rejects upload and returns 400 error with message

### Requirement: Document list API returns all documents
The system SHALL provide HTTP API endpoint to list all uploaded documents.

#### Scenario: Empty document list
- **WHEN** no documents exist
- **THEN** system returns empty array []

#### Scenario: Document list with metadata
- **WHEN** documents exist
- **THEN** system returns array with id, filename, size, uploadedAt, and status fields

### Requirement: Document delete API removes document
The system SHALL provide HTTP API endpoint to delete specific document.

#### Scenario: Successful deletion
- **WHEN** client DELETEs /api/documents/:id
- **THEN** system removes document file and metadata, returns 200 success

#### Scenario: Document not found
- **WHEN** client DELETEs non-existent document ID
- **THEN** system returns 404 error

### Requirement: Document storage uses file system
The system SHALL store uploaded documents in file system directory.

#### Scenario: Default storage directory
- **WHEN** server starts without custom storage path
- **THEN** system uses ./data/documents/ as default storage

#### Scenario: Custom storage directory
- **WHEN** server starts with custom storage path configuration
- **THEN** system uses configured path for document storage

#### Scenario: Document file naming
- **WHEN** document is uploaded
- **THEN** system stores file with generated document ID as filename

### Requirement: Document status tracking
The system SHALL track processing status for each document.

#### Scenario: Initial status
- **WHEN** document is uploaded
- **THEN** system sets status to "pending"

#### Scenario: Processing status
- **WHEN** pipeline starts processing document
- **THEN** system updates status to "processing"

#### Scenario: Completed status
- **WHEN** pipeline completes processing
- **THEN** system updates status to "indexed"

#### Scenario: Error status
- **WHEN** pipeline encounters error
- **THEN** system updates status to "error" with error message

### Requirement: Document metadata persistence
The system SHALL persist document metadata separate from file storage.

#### Scenario: Metadata storage format
- **WHEN** document metadata is stored
- **THEN** system saves as JSON file with document ID as filename

#### Scenario: Metadata retrieval
- **WHEN** document list API is called
- **THEN** system reads metadata from persisted JSON files