## ADDED Requirements

### Requirement: Indicator value parsing
The system SHALL parse indicator values from user queries.

#### Scenario: Indicator with value
- **WHEN** query contains indicator with numeric value (e.g., "eGFR=35", "HbA1c 7.5")
- **THEN** IndicatorMatch includes value field with parsed number
- **AND** unit field populated if unit detected

#### Scenario: Indicator without value
- **WHEN** query contains indicator name only
- **THEN** IndicatorMatch.value remains undefined
- **AND** indicator recognized for retrieval purposes

#### Scenario: Value range detection
- **WHEN** query contains range (e.g., "eGFR 30-45")
- **THEN** IndicatorMatch includes minValue and maxValue fields
- **AND** range used for threshold comparison

### Requirement: Indicator threshold inference
The system SHALL infer clinical significance from indicator values.

#### Scenario: Threshold crossing detection
- **WHEN** indicator value parsed and clinicalThresholds defined
- **THEN** system determines threshold zone (normal/caution/critical)
- **AND** zone stored in IndicatorMatch.thresholdZone

#### Scenario: Contraindication relevance flag
- **WHEN** indicator value in critical zone (< 30 for eGFR)
- **THEN** system flags contraindication relevance
- **AND** retrieval prioritizes contraindication evidence

#### Scenario: Threshold lookup from dictionary
- **WHEN** indicator recognized
- **THEN** clinicalThresholds retrieved from IndicatorEntity
- **AND** thresholds used for zone calculation