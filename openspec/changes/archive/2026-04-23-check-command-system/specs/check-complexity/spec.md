## ADDED Requirements

### Requirement: Complexity check execution trigger
The system SHALL execute complexity check when `/check:complexity` command is invoked.

#### Scenario: Complexity check invocation
- **WHEN** user invokes `/check:complexity`
- **THEN** system identifies code files in scope
- **AND** system executes complexity agent
- **AND** system outputs complexity statistics report

### Requirement: Cyclomatic complexity check
The system SHALL measure and check cyclomatic complexity of functions.

#### Scenario: Cyclomatic complexity calculation
- **WHEN** complexity check analyzes a function
- **THEN** system counts decision points (if/else/switch/case/loop/catch)
- **AND** system calculates cyclomatic complexity = decision_points + 1

#### Scenario: Cyclomatic complexity threshold
- **WHEN** function cyclomatic complexity exceeds threshold (default 10)
- **THEN** system reports function as "high complexity"
- **AND** report includes complexity value
- **AND** report suggests refactoring

### Requirement: Cognitive complexity check
The system SHALL measure and check cognitive complexity of functions.

#### Scenario: Cognitive complexity calculation
- **WHEN** complexity check analyzes a function
- **THEN** system adds penalty for nesting structures
- **AND** system adds penalty for control flow jumps (break/continue/return)
- **AND** system calculates total cognitive complexity

#### Scenario: Cognitive complexity threshold
- **WHEN** function cognitive complexity exceeds threshold (default 15)
- **THEN** system reports function as "high cognitive load"
- **AND** report includes complexity value
- **AND** report suggests simplification

### Requirement: Function length check
The system SHALL measure and check function length.

#### Scenario: Line count measurement
- **WHEN** complexity check analyzes a function
- **THEN** system counts lines from function start to end
- **AND** system excludes blank lines and comments optionally

#### Scenario: Function length threshold
- **WHEN** function length exceeds threshold (default 50 lines)
- **THEN** system reports function as "too long"
- **AND** report includes line count
- **AND** report suggests splitting

### Requirement: Nesting depth check
The system SHALL measure and check nesting depth.

#### Scenario: Nesting depth calculation
- **WHEN** complexity check analyzes a function
- **THEN** system tracks maximum nesting level of conditionals/loops
- **AND** system identifies deepest nesting point

#### Scenario: Nesting depth threshold
- **WHEN** nesting depth exceeds threshold (default 4 levels)
- **THEN** system reports function as "deeply nested"
- **AND** report includes nesting depth
- **AND** report suggests flattening

### Requirement: Branch count check
The system SHALL measure and check branch count.

#### Scenario: Branch count calculation
- **WHEN** complexity check analyzes a function
- **THEN** system counts switch/case branches
- **AND** system counts if/else branches
- **AND** system calculates total branch count

#### Scenario: Branch count threshold
- **WHEN** branch count exceeds threshold (default 10)
- **THEN** system reports function as "excessive branches"
- **AND** report includes branch count
- **AND** report suggests using polymorphism or table-driven approach

### Requirement: Parameter count check
The system SHALL measure and check parameter count.

#### Scenario: Parameter count measurement
- **WHEN** complexity check analyzes a function
- **THEN** system counts function parameters
- **AND** system identifies optional/required distinction

#### Scenario: Parameter count threshold
- **WHEN** parameter count exceeds threshold (default 4)
- **THEN** system reports function as "too many parameters"
- **AND** report includes parameter count
- **AND** report suggests using options object pattern

### Requirement: Complexity statistics aggregation
The system SHALL aggregate complexity statistics across files.

#### Scenario: Average complexity calculation
- **WHEN** complexity check completes
- **THEN** system calculates average cyclomatic complexity
- **AND** system calculates average cognitive complexity
- **AND** system calculates average function length

#### Scenario: Distribution report
- **WHEN** complexity check completes
- **THEN** report includes complexity distribution histogram
- **AND** report identifies functions exceeding thresholds
- **AND** report suggests refactoring priority order

### Requirement: Complexity report output
The system SHALL output structured complexity report.

#### Scenario: Report structure
- **WHEN** complexity check completes
- **THEN** report includes overall statistics summary
- **AND** report includes function-level details for exceeding functions
- **AND** report includes refactoring suggestions

#### Scenario: Report persistence
- **WHEN** complexity check completes
- **THEN** system persists report to `context/review/<timestamp>-complexity-<target>.md`