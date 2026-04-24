## ADDED Requirements

### Requirement: Medical guideline source identification
The system SHALL identify medical guideline sources from document metadata and content.

#### Scenario: ADA source identification
- **WHEN** document title contains "ADA", "American Diabetes Association", or "Standards of Care"
- **THEN** system identifies guidelineSource as "ADA"

#### Scenario: KDIGO source identification
- **WHEN** document title contains "KDIGO" or "Kidney Disease: Improving Global Outcomes"
- **THEN** system identifies guidelineSource as "KDIGO"

#### Scenario: ESC source identification
- **WHEN** document title contains "ESC" or "European Society of Cardiology"
- **THEN** system identifies guidelineSource as "ESC"

#### Scenario: CDS source identification (Chinese)
- **WHEN** document title contains "CDS", "中国糖尿病学会", or "中华医学会糖尿病"
- **THEN** system identifies guidelineSource as "CDS"

#### Scenario: ATA source identification
- **WHEN** document title contains "ATA" or "American Thyroid Association"
- **THEN** system identifies guidelineSource as "ATA"

#### Scenario: Unknown source
- **WHEN** document title does not match any known guideline patterns
- **THEN** system leaves guidelineSource as undefined

### Requirement: Guideline source metadata propagation
The system SHALL propagate identified guideline source to chunk metadata.

#### Scenario: Chunk metadata includes guideline source
- **WHEN** chunk is created from document with identified guideline source
- **THEN** chunk.metadata.guidelineSource equals identified source

#### Scenario: Evidence evaluation uses guideline source
- **WHEN** evidence evaluation processes chunk with guidelineSource
- **THEN** evidence evaluation uses guidelineSource for authority level determination

### Requirement: Medical source authority level mapping
The system SHALL map guideline sources to authority levels for evidence evaluation.

#### Scenario: International authority sources
- **WHEN** guidelineSource is ADA, KDIGO, ESC, ATA, or EASD
- **THEN** system assigns authorityLevel as "international" with weight 1.0

#### Scenario: National authority sources (Chinese)
- **WHEN** guidelineSource is CDS, CSH, or CETA
- **THEN** system assigns authorityLevel as "national" with weight 0.8

#### Scenario: Local or unknown sources
- **WHEN** guidelineSource is undefined or not recognized
- **THEN** system assigns authorityLevel as "local" with weight 0.6