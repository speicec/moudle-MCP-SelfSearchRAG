---
capability: qdrant-vector-store
version: 1.1
modified_from: openspec/specs/qdrant-vector-store/spec.md
---

# Spec: Qdrant Vector Store Integration (Modified)

## MODIFIED Requirements

### Requirement: Payload fields specification
The system SHALL support the following payload fields for text_chunks and parent_chunks collections.

#### Scenario: Small chunk payload includes document-level metadata
- **WHEN** small chunk is upserted to text_chunks collection
- **THEN** payload includes: documentId, chunkId, parentId, level, modality, qualityScore, pageNumber, contentType, position, content
- **AND** payload includes: documentYear (optional), documentTitle (optional), documentAuthor (optional), guidelineSource (optional)

#### Scenario: Parent chunk payload includes document-level metadata
- **WHEN** parent chunk is upserted to parent_chunks collection
- **THEN** payload includes: documentId, chunkId, level, modality, qualityScore, pageNumber, contentType, position, childIds, content
- **AND** payload includes: documentYear (optional), documentTitle (optional), documentAuthor (optional), guidelineSource (optional)

#### Scenario: Metadata fields optional when not available
- **WHEN** chunk metadata lacks documentYear or documentTitle
- **THEN** payload does not include those fields (undefined values not stored)

## ADDED Requirements

### Requirement: Document-level metadata field types
The system SHALL define the following types for document-level metadata fields in VectorPayload.

#### Scenario: documentYear type definition
- **WHEN** VectorPayload interface is defined
- **THEN** documentYear is `number | undefined`

#### Scenario: documentTitle type definition
- **WHEN** VectorPayload interface is defined
- **THEN** documentTitle is `string | undefined`

#### Scenario: documentAuthor type definition
- **WHEN** VectorPayload interface is defined
- **THEN** documentAuthor is `string | undefined`

#### Scenario: guidelineSource type definition
- **WHEN** VectorPayload interface is defined
- **THEN** guidelineSource is `string | undefined`