---
capability: enhanced-evidence-evaluation
version: 1.1
modified_from: openspec/specs/enhanced-evidence-evaluation/spec.md
---

# Spec: Enhanced Evidence Evaluation (Modified)

## ADDED Requirements

### Requirement: Metadata prerequisite for accurate evaluation
The system SHALL require document-level metadata for accurate GRADE evaluation.

#### Scenario: Year required for time weight calculation
- **WHEN** evidence source lacks year metadata
- **THEN** timeWeight defaults to 0.7 (medium weight)
- **AND** evaluation logs warning "year unavailable, using default timeWeight"

#### Scenario: Title required for literature type classification
- **WHEN** evidence source lacks title metadata
- **THEN** system uses sourceDocumentId as fallback for documentName
- **AND** classifyLiteratureType may return incorrect type (defaults to expert_opinion)

#### Scenario: guidelineSource required for authority classification
- **WHEN** evidence source lacks guidelineSource metadata
- **THEN** system attempts to extract guidelineSource from documentName
- **AND** if extraction fails, sourceAuthority defaults to 'local'

#### Scenario: Complete metadata enables accurate evaluation
- **WHEN** evidence source has documentYear, documentTitle, guidelineSource
- **THEN** timeWeight calculated from actual year
- **AND** literatureType classified from actual title/content
- **AND** sourceAuthority determined from actual guidelineSource

## MODIFIED Requirements

### Requirement: Unknown year defaults to medium weight
The system SHALL use default timeWeight when year is unavailable.

#### Scenario: Unknown year defaults to medium weight
- **WHEN** source year is undefined
- **THEN** timeWeight = 0.7
- **AND** evaluation result includes warning about missing year metadata