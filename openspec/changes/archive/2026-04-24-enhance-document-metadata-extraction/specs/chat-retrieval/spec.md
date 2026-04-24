## MODIFIED Requirements

### Requirement: Chat result format includes context
The system SHALL return retrieval results with full parent chunk content.

#### Scenario: Result structure
- **WHEN** retrieval completes
- **THEN** system returns array of results with smallChunkId, parentChunkContent, similarityScore, sourceDocumentId, and sourceMetadata (documentTitle, documentAuthor, documentYear, guidelineSource, pageNumber)

#### Scenario: Context assembly
- **WHEN** multiple results are returned
- **THEN** system includes assembled context text with token count

#### Scenario: Result truncation indication
- **WHEN** assembled context exceeds token limit
- **THEN** system includes truncated flag in response

### Requirement: Chat interface displays query results
The system SHALL display retrieval results AND LLM-generated answer in a structured format within the chat interface.

#### Scenario: Results are displayed with similarity scores
- **WHEN** query returns results with similarity scores
- **THEN** system displays each result with percentage score, human-readable document title, and page number in thinking chain

#### Scenario: Results are expandable for content preview
- **WHEN** user clicks on a result card
- **THEN** system expands the card to show content preview (up to 500 characters) and full metadata

#### Scenario: LLM answer is displayed
- **WHEN** LLM generation completes
- **THEN** system displays generated answer with source citations showing document titles, years, and page numbers

## ADDED Requirements

### Requirement: Source citation uses human-readable title
The system SHALL construct SourceCitation using document title instead of sourceDocumentId.

#### Scenario: Citation with document title
- **WHEN** retrieval result has documentTitle in metadata
- **THEN** SourceCitation.documentName equals documentTitle (human-readable)

#### Scenario: Citation fallback to filename
- **WHEN** retrieval result has no documentTitle
- **THEN** SourceCitation.documentName equals sourceDocumentId (filename fallback)

#### Scenario: Citation includes year
- **WHEN** retrieval result has documentYear in metadata
- **THEN** SourceCitation.year equals documentYear

#### Scenario: Citation includes page number
- **WHEN** retrieval result has pageNumber in metadata
- **THEN** SourceCitation.pageNumber equals pageNumber

### Requirement: Evidence evaluation uses document metadata
The system SHALL use document metadata for evidence evaluation enhancement.

#### Scenario: Authority level from guidelineSource
- **WHEN** chunk metadata has guidelineSource
- **THEN** evidence evaluation uses guidelineSource for authorityLevel mapping

#### Scenario: Year for timeliness check
- **WHEN** chunk metadata has documentYear
- **THEN** evidence evaluation uses documentYear for timeliness assessment

#### Scenario: Title for literature type classification
- **WHEN** chunk metadata has documentTitle
- **THEN** evidence evaluation uses documentTitle for literature type classification