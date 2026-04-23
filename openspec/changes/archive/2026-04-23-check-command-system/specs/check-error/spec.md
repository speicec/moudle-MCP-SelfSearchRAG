## ADDED Requirements

### Requirement: Error handling check execution trigger
The system SHALL execute error handling check when `/check:error` command is invoked.

#### Scenario: Error check invocation
- **WHEN** user invokes `/check:error`
- **THEN** system identifies code files with error handling patterns
- **AND** system executes error handling agent
- **AND** system outputs error handling findings report

### Requirement: Error ignore check
The system SHALL check for improperly ignored errors.

#### Scenario: Empty catch block detection
- **WHEN** error check finds catch blocks
- **THEN** system identifies empty catch blocks
- **AND** system identifies catch blocks with only logging
- **AND** system reports ignored error locations

#### Scenario: Unhandled Promise rejection
- **WHEN** error check finds Promise operations
- **THEN** system checks if .catch() handler exists
- **AND** system identifies Promises without rejection handling
- **AND** system identifies await without try-catch

#### Scenario: Unused error variable
- **WHEN** error check finds caught errors
- **THEN** system checks if error variable is used
- **AND** system identifies catch(e) where e is never referenced
- **AND** system reports unused error patterns

### Requirement: Error wrapping check
The system SHALL check for proper error wrapping patterns.

#### Scenario: Error chain preservation
- **WHEN** error check finds error rethrowing
- **THEN** system checks if original error is preserved
- **AND** system identifies errors lost during wrapping
- **AND** system identifies missing cause information

#### Scenario: Context addition
- **WHEN** error check finds error wrapping
- **THEN** system checks if contextual information is added
- **AND** system identifies errors wrapped without additional context
- **AND** system reports patterns lacking operation context

#### Scenario: Error type consistency
- **WHEN** error check finds error creation
- **THEN** system checks if appropriate error type is used
- **AND** system identifies generic Error usage for specific cases
- **AND** system suggests using custom error types

### Requirement: Panic/throw usage check
The system SHALL check for proper panic/throw usage.

#### Scenario: Panic/throw justification
- **WHEN** error check finds panic/throw statements
- **THEN** system checks if panic is for unrecoverable conditions
- **AND** system identifies panic for recoverable errors
- **AND** system identifies panic in library code

#### Scenario: Panic information adequacy
- **WHEN** error check finds panic statements
- **THEN** system checks if panic message is informative
- **AND** system identifies panic with generic messages
- **AND** system suggests adding context information

### Requirement: Recover/catch pairing check
The system SHALL check for proper recover/catch pairing.

#### Scenario: Recover placement
- **WHEN** error check finds recover statements
- **THEN** system checks if recover is in deferred function
- **AND** system identifies incorrectly placed recover
- **AND** system checks if recover handles expected panic types

#### Scenario: Panic coverage
- **WHEN** error check finds panic sources
- **THEN** system checks if corresponding recover exists
- **AND** system identifies uncovered panic sources
- **AND** system suggests adding recover handlers

#### Scenario: Post-recover state
- **WHEN** error check finds recover handlers
- **THEN** system checks if state is restored after recover
- **AND** system identifies recover without cleanup
- **AND** system identifies recover that leaves system in inconsistent state

### Requirement: Error propagation check
The system SHALL check for proper error propagation patterns.

#### Scenario: Error return
- **WHEN** error check finds error-producing functions
- **THEN** system checks if errors are properly returned
- **AND** system identifies swallowed errors (not returned/handled)
- **AND** system identifies implicit error suppression

#### Scenario: Stack trace preservation
- **WHEN** error check finds error propagation
- **THEN** system checks if call stack information is preserved
- **AND** system identifies errors losing stack trace
- **AND** system suggests using error wrapping libraries

#### Scenario: Error classification
- **WHEN** error check finds error handling
- **THEN** system checks if recoverable/unrecoverable errors are distinguished
- **AND** system identifies mixed error handling strategies
- **AND** system suggests consistent error classification

### Requirement: Error handling pattern check
The system SHALL check for consistent error handling patterns.

#### Scenario: Unified strategy
- **WHEN** error check analyzes module/package
- **THEN** system checks if consistent error handling strategy is used
- **AND** system identifies mixed strategies (throw/return/callback)
- **AND** system suggests unified approach

#### Scenario: Business vs technical error separation
- **WHEN** error check finds error handling
- **THEN** system checks if business errors are distinguished from technical errors
- **AND** system identifies mixed error types
- **AND** system suggests error taxonomy

#### Scenario: Degradation handling
- **WHEN** error check finds error handlers
- **THEN** system checks if fallback/degradation logic exists
- **AND** system identifies errors without recovery plan
- **AND** system suggests adding degradation strategies

### Requirement: Error handling report output
The system SHALL output structured error handling report.

#### Scenario: Risk classification
- **WHEN** error handling findings exist
- **THEN** report classifies issues by risk (High/Medium/Low)
- **AND** report includes pattern description
- **AND** report includes fix suggestion

#### Scenario: Report persistence
- **WHEN** error check completes
- **THEN** system persists report to `context/review/<timestamp>-error-<target>.md`