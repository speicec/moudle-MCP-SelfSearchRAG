## ADDED Requirements

### Requirement: Context window extraction
The system SHALL extract a context window around the matched small chunk when expanding to parent chunks.

#### Scenario: Basic window extraction
- **WHEN** a small chunk matches a query
- **THEN** the system extracts surrounding context from the parent chunk
- **AND** the context window includes characters before and after the matched content

#### Scenario: Configurable window size
- **WHEN** context window extraction is performed
- **THEN** the system uses configurable `beforeChars` and `afterChars` parameters
- **AND** default values are 300 characters before and 500 characters after

#### Scenario: Sentence boundary respect
- **WHEN** `respectSentenceBoundary` is enabled
- **THEN** the system truncates the window at sentence boundaries
- **AND** avoids cutting mid-sentence

### Requirement: Context window in retrieval result
The system SHALL include the extracted context window in retrieval results.

#### Scenario: Context window field
- **WHEN** retrieval result is returned
- **THEN** the result includes `contextWindow` field with extracted content
- **AND** the result includes `windowStart` and `windowEnd` position fields

#### Scenario: Backward compatibility
- **WHEN** retrieval result is returned
- **THEN** the `parentChunkContent` field still contains the full parent chunk
- **AND** consumers can choose between `contextWindow` and `parentChunkContent`

### Requirement: Context window configuration
The system SHALL provide configuration options for context window extraction.

#### Scenario: Window configuration
- **WHEN** `SmallToBigRetriever` is instantiated
- **THEN** it accepts `contextWindowConfig` parameter
- **AND** the configuration includes `beforeChars`, `afterChars`, `respectSentenceBoundary`

#### Scenario: Default configuration
- **WHEN** no configuration is provided
- **THEN** the system uses sensible defaults
- **AND** defaults are: `{ beforeChars: 300, afterChars: 500, respectSentenceBoundary: true }`