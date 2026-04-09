## ADDED Requirements

### Requirement: Cosine similarity cliff detection
The system SHALL detect semantic cliffs by computing cosine similarity between adjacent embeddings and identifying significant drops.

#### Scenario: Adjacent similarity calculation
- **WHEN** embeddings are generated for text segments
- **THEN** system computes cosine similarity between each adjacent pair

#### Scenario: Similarity sequence
- **WHEN** similarity calculations complete
- **THEN** system produces similarity sequence: [s1, s2, s3, ...] where si is similarity between segment i and i+1

#### Scenario: Cosine formula
- **WHEN** cosine similarity is computed
- **THEN** system uses standard cosine similarity formula: dot(a,b) / (norm(a) * norm(b))

### Requirement: Threshold-based cliff identification
The system SHALL identify potential cliffs when similarity drops below configured threshold.

#### Scenario: Threshold trigger
- **WHEN** similarity value si < similarityThreshold (default 0.7)
- **THEN** system marks position i as potential cliff candidate

#### Scenario: Threshold configuration
- **WHEN** similarityThreshold is configured
- **THEN** threshold value controls cliff detection sensitivity

#### Scenario: Multiple candidates
- **WHEN** multiple positions fall below threshold
- **THEN** system collects all as cliff candidates

### Requirement: Gradient validation for cliff confirmation
The system SHALL validate cliffs by checking similarity gradient between adjacent values.

#### Scenario: Gradient check
- **WHEN** cliff candidate is identified at position i
- **THEN** system computes gradient: |si - si-1|

#### Scenario: Gradient threshold
- **WHEN** gradient > gradientThreshold (default 0.15)
- **THEN** system confirms cliff at position i

#### Scenario: Gradient configuration
- **WHEN** gradientThreshold is configured
- **THEN** threshold controls minimum drop required for cliff confirmation

### Requirement: Noise filtering for cliff stability
The system SHALL filter noise by requiring minimum cliff width for confirmed cliffs.

#### Scenario: Cliff width requirement
- **WHEN** cliff is confirmed
- **THEN** system checks minimum cliff width (default 2 adjacent candidates)

#### Scenario: Noise rejection
- **WHEN** cliff width < minCliffWidth
- **THEN** system rejects cliff as noise spike

#### Scenario: Width configuration
- **WHEN** minCliffWidth is configured
- **THEN** width controls noise filtering sensitivity

### Requirement: Cliff boundary selection
The system SHALL select optimal boundary position from confirmed cliffs.

#### Scenario: Single cliff boundary
- **WHEN** single cliff is confirmed
- **THEN** system selects cliff position as chunk boundary

#### Scenario: Multiple cliff handling
- **WHEN** multiple cliffs are confirmed in proximity
- **THEN** system selects cliff with largest gradient as primary boundary

#### Scenario: Cliff prioritization
- **WHEN** cliffs are sorted
- **THEN** system prioritizes by gradient magnitude descending

### Requirement: Cliff detection configuration
The system SHALL provide configurable parameters for cliff detection tuning.

#### Scenario: Threshold parameters
- **WHEN** cliff detection is configured
- **THEN** system accepts similarityThreshold, gradientThreshold, minCliffWidth parameters

#### Scenario: Default values
- **WHEN** configuration is not provided
- **THEN** system uses defaults: similarityThreshold=0.7, gradientThreshold=0.15, minCliffWidth=2

#### Scenario: Parameter validation
- **WHEN** configuration is provided
- **THEN** system validates parameter ranges: threshold in [0,1], width >= 1

### Requirement: Cliff confidence scoring
The system SHALL compute confidence score for each detected cliff.

#### Scenario: Confidence calculation
- **WHEN** cliff is confirmed
- **THEN** system computes confidence based on gradient magnitude and width

#### Scenario: Confidence output
- **WHEN** cliff is reported
- **THEN** cliff includes confidence score in [0, 1] range

#### Scenario: High confidence threshold
- **WHEN** confidence > highConfidenceThreshold (default 0.8)
- **THEN** system marks cliff as high-quality boundary