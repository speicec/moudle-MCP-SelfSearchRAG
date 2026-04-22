## ADDED Requirements

### Requirement: Code reviewer execution trigger
The system SHALL execute overall code review when `/check:code-reviewer` command is invoked.

#### Scenario: Code reviewer invocation
- **WHEN** user invokes `/check:code-reviewer`
- **THEN** system identifies code files in scope (Git diff or specified)
- **AND** system loads design documents if available
- **AND** system loads spec documents if available
- **AND** system executes code reviewer agent
- **AND** system outputs comprehensive review report

### Requirement: Overall architecture review
The system SHALL review overall architecture quality.

#### Scenario: Design合理性 assessment
- **WHEN** code reviewer analyzes code
- **THEN** system checks if overall design is reasonable
- **AND** system identifies architectural issues
- **AND** system suggests architectural improvements

#### Scenario: Layer separation
- **WHEN** code reviewer analyzes structure
- **THEN** system checks if layers are clearly separated
- **AND** system identifies cross-layer violations
- **AND** system suggests layer boundary fixes

#### Scenario: Responsibility assignment
- **WHEN** code reviewer analyzes modules
- **THEN** system checks if responsibilities are properly assigned
- **AND** system identifies misplaced responsibilities
- **AND** system suggests responsibility redistribution

### Requirement: Code quality synthesis
The system SHALL synthesize overall code quality assessment.

#### Scenario: Cleanliness assessment
- **WHEN** code reviewer completes analysis
- **THEN** system assesses overall code cleanliness
- **AND** system identifies major cleanliness issues
- **AND** system suggests cleanup actions

#### Scenario: Readability assessment
- **WHEN** code reviewer completes analysis
- **THEN** system assesses overall readability
- **AND** system identifies readability barriers
- **AND** system suggests readability improvements

#### Scenario: Maintainability assessment
- **WHEN** code reviewer completes analysis
- **THEN** system assesses overall maintainability
- **AND** system identifies maintainability risks
- **AND** system suggests maintainability improvements

### Requirement: Contract consistency validation
The system SHALL validate implementation against design/spec contracts.

#### Scenario: Design decision compliance
- **WHEN** design document exists
- **THEN** system checks if implementation follows design decisions
- **AND** system identifies deviations from design
- **AND** system reports deviation severity

#### Scenario: Spec requirement satisfaction
- **WHEN** spec document exists
- **THEN** system checks if implementation satisfies spec requirements
- **AND** system identifies unsatisfied requirements
- **AND** system reports requirement gaps

#### Scenario: Scope creep detection
- **WHEN** code reviewer compares implementation to spec
- **THEN** system identifies features beyond spec scope
- **AND** system identifies unnecessary implementations
- **AND** system reports scope creep items

### Requirement: Priority classification
The system SHALL classify findings by priority level.

#### Scenario: Critical priority
- **WHEN** finding is bug, security issue, data loss risk, or functional error
- **THEN** system classifies as "Critical"
- **AND** system marks as must-fix before merge

#### Scenario: Important priority
- **WHEN** finding is architectural issue, missing feature, insufficient error handling, or test gap
- **THEN** system classifies as "Important"
- **AND** system marks as should-fix before merge

#### Scenario: Minor priority
- **WHEN** finding is code style, optimization opportunity, or documentation improvement
- **THEN** system classifies as "Minor"
- **AND** system marks as can-improve later

### Requirement: Action recommendations
The system SHALL provide actionable recommendations.

#### Scenario: Fix priority ordering
- **WHEN** review completes with issues
- **THEN** system orders fix priorities (Critical > Important > Minor)
- **AND** system suggests fix sequence
- **AND** system identifies blocking issues

#### Scenario: Refactoring suggestions
- **WHEN** review identifies code quality issues
- **THEN** system provides specific refactoring suggestions
- **AND** system suggests refactoring approach
- **AND** system estimates refactoring effort

#### Scenario: Test suggestions
- **WHEN** review identifies test gaps
- **THEN** system suggests specific test cases to add
- **AND** system suggests test approach
- **AND** system identifies high-value test targets

### Requirement: Review report output
The system SHALL output structured review report.

#### Scenario: Report structure
- **WHEN** code reviewer completes
- **THEN** report includes "Strengths" section
- **AND** report includes "Issues" section with Critical/Important/Minor subsections
- **AND** each issue includes file:line reference and fix suggestion
- **AND** report includes "Assessment" section with merge decision

#### Scenario: Merge decision
- **WHEN** review completes
- **THEN** system outputs merge decision: Yes/No/Fix first
- **AND** system provides rationale for decision
- **AND** system identifies blocking issues if No

#### Scenario: Report persistence
- **WHEN** code reviewer completes
- **THEN** system persists report to `context/review/<timestamp>-code-reviewer-<target>.md`