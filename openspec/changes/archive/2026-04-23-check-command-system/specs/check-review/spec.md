## ADDED Requirements

### Requirement: Review execution trigger
The system SHALL execute six-dimensional review when `/check:review` command is invoked.

#### Scenario: Review with change name
- **WHEN** user invokes `/check:review <change-name>`
- **THEN** system loads OpenSpec change documents for `<change-name>`
- **AND** system executes review agent with six dimensions in parallel
- **AND** system outputs weighted composite score

#### Scenario: Review without change name
- **WHEN** user invokes `/check:review` without argument
- **THEN** system uses first active OpenSpec change
- **AND** system outputs warning "Using default change: <name>"
- **AND** system proceeds with review

### Requirement: Completeness dimension (0.25 weight)
The system SHALL evaluate completeness of requirements documentation.

#### Scenario: Functional requirements completeness
- **WHEN** completeness dimension executes
- **THEN** system checks if functional requirements list is complete
- **AND** system checks if boundary conditions are covered
- **AND** system checks if exception handling is considered

#### Scenario: Background description completeness
- **WHEN** completeness dimension executes
- **THEN** system checks if problem background/motivation is clear
- **AND** system checks if target users/scenarios are defined
- **AND** system checks if business value is explained

#### Scenario: Non-functional requirements completeness
- **WHEN** completeness dimension executes
- **THEN** system checks if performance requirements are defined
- **AND** system checks if security requirements are defined
- **AND** system checks if compatibility requirements are defined

#### Scenario: Acceptance criteria completeness
- **WHEN** completeness dimension executes
- **THEN** system checks if acceptance criteria are testable
- **AND** system checks if success/failure criteria are defined
- **AND** system checks if priority levels (P0/P1/P2) are annotated

### Requirement: Consistency dimension (0.20 weight)
The system SHALL evaluate consistency of requirements documentation.

#### Scenario: Internal consistency check
- **WHEN** consistency dimension executes
- **THEN** system checks for contradictions between sections
- **AND** system checks if functional descriptions match acceptance criteria
- **AND** system checks if terminology usage is unified

#### Scenario: Existing specification consistency
- **WHEN** consistency dimension executes
- **THEN** system checks if requirements align with team technical specs
- **AND** system checks if requirements align with architecture principles
- **AND** system checks if naming conventions are followed

#### Scenario: Historical requirements consistency
- **WHEN** consistency dimension executes
- **THEN** system checks for conflicts with implemented features
- **AND** system checks for conflicts with existing requirement documents
- **AND** system identifies undocumented breaking changes

### Requirement: Traceability dimension (0.15 weight)
The system SHALL evaluate traceability of requirements documentation.

#### Scenario: Requirement source traceability
- **WHEN** traceability dimension executes
- **THEN** system checks if requirement sources are annotated (Issue/JIRA/User feedback)
- **AND** system checks if source links are valid
- **AND** system distinguishes original requirements from derived requirements

#### Scenario: Naming/ID convention check
- **WHEN** traceability dimension executes
- **THEN** system checks if requirement IDs follow naming convention
- **AND** system checks if spec document IDs are valid
- **AND** system checks if task IDs link to requirement IDs

#### Scenario: Change history tracking
- **WHEN** traceability dimension executes
- **THEN** system checks if change history is recorded
- **AND** system checks if version information is annotated
- **AND** system checks if change reasons are documented

### Requirement: Quality dimension (0.20 weight)
The system SHALL evaluate quality of requirements documentation.

#### Scenario: Vague word detection
- **WHEN** quality dimension executes
- **THEN** system detects vague words from blacklist
- **AND** system reports file location for each detected word
- **AND** system counts total vague word occurrences

#### Scenario: Metric quantification check
- **WHEN** quality dimension executes
- **THEN** system checks if performance metrics are specific numbers
- **AND** system checks if time limits are precise values
- **AND** system checks if capacity/scale is quantified

#### Scenario: Testability check
- **WHEN** quality dimension executes
- **THEN** system checks if each requirement has test method
- **AND** system checks if acceptance criteria are automatable
- **AND** system identifies untestable descriptions

### Requirement: Template compliance dimension (0.10 weight)
The system SHALL evaluate template compliance of requirements documentation.

#### Scenario: Standard structure check
- **WHEN** template compliance dimension executes
- **THEN** system checks if required sections exist
- **AND** system checks if section order is correct
- **AND** system checks if hierarchy structure is reasonable

#### Scenario: Required sections check
- **WHEN** template compliance dimension executes
- **THEN** system checks proposal.md for: background, goals, scope, impact
- **AND** system checks design.md for: architecture, components, data flow, decisions
- **AND** system checks spec.md for: requirements, scenarios, constraints
- **AND** system checks tasks.md for: task list, dependencies, priorities

#### Scenario: Format validation
- **WHEN** template compliance dimension executes
- **THEN** system checks if Markdown format is valid
- **AND** system checks if YAML frontmatter is complete
- **AND** system checks if tables/lists formatting is correct

### Requirement: Context reference dimension (0.10 weight)
The system SHALL evaluate context reference adequacy of requirements documentation.

#### Scenario: SOP reference check
- **WHEN** context reference dimension executes
- **THEN** system checks if relevant SOPs are referenced
- **AND** system checks if SOP links are valid
- **AND** system checks if applicable version is annotated

#### Scenario: Experience reference check
- **WHEN** context reference dimension executes
- **THEN** system checks if historical cases/experiences are referenced
- **AND** system checks if lessons learned/best practices are referenced
- **AND** system checks if sources are annotated

#### Scenario: Specification reference check
- **WHEN** context reference dimension executes
- **THEN** system checks if technical specification documents are referenced
- **AND** system checks if industry standards are referenced
- **AND** system checks if regulatory/compliance requirements are referenced

#### Scenario: Constraint justification check
- **WHEN** context reference dimension executes
- **THEN** system checks if technical decisions have rationale
- **AND** system checks if limitations have explanations
- **AND** system checks if assumptions are annotated

### Requirement: Weighted score calculation
The system SHALL calculate weighted composite score from six dimensions.

#### Scenario: Score calculation
- **WHEN** all six dimensions complete
- **THEN** system calculates composite score = Σ(dimension_score × weight)
- **AND** weights: completeness=0.25, consistency=0.20, traceability=0.15, quality=0.20, template=0.10, context=0.10

#### Scenario: Conclusion determination
- **WHEN** composite score is calculated
- **THEN** system determines conclusion based on thresholds
- **AND** threshold ≥85: pass
- **AND** threshold 70-84: conditional pass
- **AND** threshold 50-69: needs revision
- **AND** threshold <50: fail

### Requirement: Review report output
The system SHALL output structured review report.

#### Scenario: Report structure
- **WHEN** review completes
- **THEN** report includes score summary table with all dimensions
- **AND** report includes conclusion status
- **AND** report includes critical issues list
- **AND** report includes improvement suggestions

#### Scenario: Report persistence
- **WHEN** review completes
- **THEN** system persists report to `context/review/<timestamp>-review-<target>.md`