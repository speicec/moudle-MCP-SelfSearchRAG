---
capability: enhanced-evidence-evaluation
version: 1.0
created: 2026-04-23
---

# Spec: Enhanced Evidence Evaluation

## ADDED Requirements

### Requirement: Source authority classification
The system SHALL classify evidence sources by authority level: international, national, or local.

#### Scenario: International guideline recognized
- **WHEN** source documentName contains 'ADA', 'KDIGO', 'ESC', 'ATA', 'EASD'
- **THEN** sourceAuthority = 'international'
- **AND** authorityWeight = 1.0

#### Scenario: National guideline recognized
- **WHEN** source documentName contains 'CDS', 'CSH', 'CETA', '中国'
- **THEN** sourceAuthority = 'national'
- **AND** authorityWeight = 0.8

#### Scenario: Local guideline recognized
- **WHEN** source documentName does not match international or national keywords
- **THEN** sourceAuthority = 'local'
- **AND** authorityWeight = 0.6

#### Scenario: Unknown year defaults to medium weight
- **WHEN** source year is undefined
- **THEN** timeWeight = 0.7

### Requirement: Time weight calculation
The system SHALL calculate time weight based on publication year with linear decay.

#### Scenario: Current year maximum weight
- **WHEN** source year = current year (2026)
- **THEN** timeWeight = 1.0

#### Scenario: Recent publication
- **WHEN** source year = 2024
- **THEN** timeWeight = 0.9 (currentYear - 2024 * 0.05)

#### Scenario: Old publication minimum weight
- **WHEN** source year <= 2016 (10+ years old)
- **THEN** timeWeight = 0.5 (minimum threshold)

### Requirement: Evidence consistency check
The system SHALL check consistency between multiple evidence sources.

#### Scenario: High consistency detected
- **WHEN** multiple sources agree on conclusion (keyword similarity >= 0.8)
- **THEN** consistencyScore = 0.8+
- **AND** consistency status is marked as 'consistent'

#### Scenario: Conflict detected
- **WHEN** sources contain contradictory keywords (禁用 vs 可用)
- **THEN** consistencyScore < 0.5
- **AND** consistency status is marked as 'conflicting'
- **AND** answer includes conflict warning

#### Scenario: Single source defaults to consistent
- **WHEN** only one evidence source available
- **THEN** consistencyScore = 1.0

### Requirement: Enhanced composite score
The system SHALL calculate composite score combining multiple dimensions.

#### Scenario: Composite score calculation
- **WHEN** evaluateMultipleSourcesEnhanced() is called
- **THEN** compositeScore = gradeWeight * 0.4 + authorityWeight * 0.2 + timeWeight * 0.2 + consistencyScore * 0.1 + applicabilityScore * 0.1
- **AND** applicabilityScore defaults to 1.0 for endocrinology domain

#### Scenario: High quality evidence prioritized
- **WHEN** sorting evidence for answer generation
- **THEN** evidence sorted by compositeScore descending
- **AND** top 3 evidence included in context

### Requirement: Enhanced evidence output format
The system SHALL extend EvidenceEvaluation interface with new fields.

#### Scenario: Enhanced evaluation output
- **WHEN** evaluateEvidenceEnhanced() returns result
- **THEN** result includes: literatureType, grade, isCurrent, year
- **AND** result includes new fields: sourceAuthority, authorityWeight, timeWeight, consistencyScore, compositeScore
- **AND** new fields are optional (backward compatible)

### Requirement: Low quality evidence warning
The system SHALL warn when relying on low quality evidence.

#### Scenario: Low quality evidence used
- **WHEN** compositeScore < 0.5 for all evidence
- **THEN** answer.warnings includes '证据质量较低，建议查阅权威指南'
- **AND** evidenceGrade reflects lowest compositeScore

### Requirement: Backward compatibility
The system SHALL maintain backward compatibility with existing EvidenceEvaluation.

#### Scenario: Existing code uses old fields
- **WHEN** code accesses only literatureType, grade, isCurrent, year
- **THEN** behavior unchanged from previous version
- **AND** new fields are ignored if not needed