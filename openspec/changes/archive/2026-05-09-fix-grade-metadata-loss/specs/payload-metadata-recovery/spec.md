---
capability: payload-metadata-recovery
version: 1.0
created: 2026-04-27
---

# Spec: Payload Metadata Recovery

## ADDED Requirements

### Requirement: VectorPayload includes document-level metadata fields
The system SHALL extend VectorPayload interface to include document-level metadata fields for GRADE evaluation.

#### Scenario: documentYear field present in payload
- **WHEN** chunk is stored to Qdrant with metadata.documentYear defined
- **THEN** payload.documentYear equals metadata.documentYear

#### Scenario: documentTitle field present in payload
- **WHEN** chunk is stored to Qdrant with metadata.documentTitle defined
- **THEN** payload.documentTitle equals metadata.documentTitle

#### Scenario: documentAuthor field present in payload
- **WHEN** chunk is stored to Qdrant with metadata.documentAuthor defined
- **THEN** payload.documentAuthor equals metadata.documentAuthor

#### Scenario: guidelineSource field present in payload
- **WHEN** chunk is stored to Qdrant with metadata.guidelineSource defined
- **THEN** payload.guidelineSource equals metadata.guidelineSource

#### Scenario: Fields are optional when metadata undefined
- **WHEN** chunk metadata.documentYear is undefined
- **THEN** payload.documentYear is undefined (not stored)

### Requirement: recoverFromQdrant restores document-level metadata
The system SHALL restore document-level metadata fields from Qdrant payload to ChunkMetadata during chunk recovery.

#### Scenario: documentYear restored from payload
- **WHEN** recoverFromQdrant creates HierarchicalChunk from Qdrant payload
- **AND** payload.documentYear is defined
- **THEN** chunk.metadata.documentYear equals payload.documentYear

#### Scenario: documentTitle restored from payload
- **WHEN** recoverFromQdrant creates HierarchicalChunk from Qdrant payload
- **AND** payload.documentTitle is defined
- **THEN** chunk.metadata.documentTitle equals payload.documentTitle

#### Scenario: guidelineSource restored from payload
- **WHEN** recoverFromQdrant creates HierarchicalChunk from Qdrant payload
- **AND** payload.guidelineSource is defined
- **THEN** chunk.metadata.guidelineSource equals payload.guidelineSource

#### Scenario: Metadata undefined when payload lacks fields
- **WHEN** recoverFromQdrant creates HierarchicalChunk
- **AND** payload.documentYear is undefined
- **THEN** chunk.metadata.documentYear is undefined

#### Scenario: All new fields preserved in recovery
- **WHEN** chunk recovery completes
- **THEN** chunk.metadata includes: contentType, pageNumber, documentYear, documentTitle, documentAuthor, guidelineSource
- **AND** existing fields (contentType, pageNumber) remain unchanged

### Requirement: Backward compatibility with legacy payloads
The system SHALL handle payloads without document-level metadata fields gracefully.

#### Scenario: Legacy payload without new fields
- **WHEN** payload from older version lacks documentYear, documentTitle, guidelineSource
- **THEN** recovered chunk.metadata.documentYear is undefined
- **AND** recovered chunk.metadata.documentTitle is undefined
- **AND** recovered chunk.metadata.guidelineSource is undefined
- **AND** recovery succeeds without error