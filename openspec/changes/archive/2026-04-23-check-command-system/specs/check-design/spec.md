## ADDED Requirements

### Requirement: Design consistency execution trigger
The system SHALL execute design consistency check when `/check:design` command is invoked.

#### Scenario: Design check with design document
- **WHEN** user invokes `/check:design` and design.md exists
- **THEN** system loads design.md and specs/*/spec.md
- **AND** system loads implementation code files
- **AND** system compares implementation against design contract

#### Scenario: Design check without design document
- **WHEN** user invokes `/check:design` and no design document exists
- **THEN** system reports "No design document found"
- **AND** system skips design consistency check

### Requirement: Interface contract verification
The system SHALL verify implementation matches interface contracts defined in design.

#### Scenario: Function signature match
- **WHEN** design defines function signature
- **THEN** system checks if implementation function name matches
- **AND** system checks if parameter types match design definitions
- **AND** system checks if return type matches design contract

#### Scenario: API endpoint match
- **WHEN** design defines API endpoint
- **THEN** system checks if implementation endpoint path matches
- **AND** system checks if HTTP method matches
- **AND** system checks if request/response structure matches

### Requirement: Data structure verification
The system SHALL verify implementation matches data structures defined in design.

#### Scenario: Type definition match
- **WHEN** design defines type/interface
- **THEN** system checks if implementation type name matches
- **AND** system checks if field names follow design naming
- **AND** system checks if field types match design definitions

#### Scenario: Optional/required field annotation
- **WHEN** design defines optional/required fields
- **THEN** system checks if implementation correctly annotates optional fields
- **AND** system checks if required fields are enforced
- **AND** system checks if default values match design

### Requirement: Component relationship verification
The system SHALL verify implementation matches component relationships defined in design.

#### Scenario: Module dependency match
- **WHEN** design defines module dependencies
- **THEN** system checks if implementation imports match design dependencies
- **AND** system checks if layer hierarchy follows design layering

#### Scenario: Component boundary check
- **WHEN** design defines component boundaries
- **THEN** system checks if implementation respects component boundaries
- **AND** system identifies cross-boundary violations

### Requirement: State/flow verification
The system SHALL verify implementation matches state transitions and flows defined in design.

#### Scenario: State machine match
- **WHEN** design defines state machine transitions
- **THEN** system checks if implementation state transitions match design
- **AND** system identifies invalid state transitions

#### Scenario: Process flow match
- **WHEN** design defines process flow diagram
- **THEN** system checks if implementation execution order matches design flow
- **AND** system checks if condition branches match design decisions

### Requirement: Design deviation report
The system SHALL output design deviation report.

#### Scenario: Deviation detection
- **WHEN** implementation deviates from design
- **THEN** report includes deviation location (file:line)
- **AND** report includes design expectation
- **AND** report includes actual implementation
- **AND** report includes severity level

#### Scenario: Report persistence
- **WHEN** design check completes
- **THEN** system persists report to `context/review/<timestamp>-design-<target>.md`