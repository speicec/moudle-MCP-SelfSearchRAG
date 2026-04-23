## ADDED Requirements

### Requirement: Concurrency check execution trigger
The system SHALL execute concurrency check when `/check:concurrency` command is invoked.

#### Scenario: Concurrency check invocation
- **WHEN** user invokes `/check:concurrency`
- **THEN** system identifies code files with async/concurrent patterns
- **AND** system executes concurrency agent
- **AND** system outputs concurrency findings report

### Requirement: Race condition check
The system SHALL check for race condition vulnerabilities.

#### Scenario: Shared state protection
- **WHEN** concurrency check finds shared mutable state
- **THEN** system checks if synchronization mechanism exists
- **AND** system identifies unprotected shared variables
- **AND** system identifies read/write conflicts

#### Scenario: Async operation order
- **WHEN** concurrency check finds async operations
- **THEN** system checks if execution order is deterministic
- **AND** system identifies potential order violations

#### Scenario: Promise/async-await pattern
- **WHEN** concurrency check finds Promise chains
- **THEN** system checks if error handling covers all branches
- **AND** system identifies unhandled Promise rejections
- **AND** system identifies missing await on critical operations

### Requirement: Deadlock risk check
The system SHALL check for deadlock vulnerabilities.

#### Scenario: Lock acquisition order
- **WHEN** concurrency check finds multiple locks
- **THEN** system checks if lock acquisition order is consistent
- **AND** system identifies potential lock inversion

#### Scenario: Lock nesting
- **WHEN** concurrency check finds nested lock operations
- **THEN** system identifies lock nesting patterns
- **AND** system checks if nested locks have timeout mechanism

#### Scenario: Circular dependency
- **WHEN** concurrency check finds resource dependencies
- **THEN** system checks for circular resource dependencies
- **AND** system identifies potential deadlock cycles

### Requirement: Resource leak check
The system SHALL check for resource leak vulnerabilities.

#### Scenario: Goroutine/thread termination
- **WHEN** concurrency check finds goroutine/thread creation
- **THEN** system checks if termination condition exists
- **AND** system identifies potentially infinite goroutines
- **AND** system checks if context cancellation is handled

#### Scenario: Channel closure
- **WHEN** concurrency check finds channel operations
- **THEN** system checks if channels are properly closed
- **AND** system identifies writes to closed channels
- **AND** system identifies channel closure without receiver handling

#### Scenario: Connection/resource release
- **WHEN** concurrency check finds resource acquisition
- **THEN** system checks if release/cleanup is guaranteed
- **AND** system identifies resources without cleanup in error paths

#### Scenario: Event listener cleanup
- **WHEN** concurrency check finds event listener registration
- **THEN** system checks if listener removal exists
- **AND** system identifies listeners without cleanup

### Requirement: Channel usage check (Go/TypeScript event streams)
The system SHALL check for proper channel/event stream usage.

#### Scenario: Unbuffered channel risk
- **WHEN** concurrency check finds unbuffered channels
- **THEN** system identifies potential blocking points
- **AND** system checks if sender/receiver synchronization is safe

#### Scenario: Closed channel operation
- **WHEN** concurrency check finds channel operations
- **THEN** system checks if closed channel handling exists
- **AND** system identifies potential panic on closed channel

#### Scenario: Select default branch
- **WHEN** concurrency check finds select statements with default
- **THEN** system identifies non-blocking patterns that may skip important cases
- **AND** system checks if default branch is intentional

### Requirement: Concurrency pattern validation
The system SHALL check for correct concurrency patterns.

#### Scenario: Synchronization mechanism selection
- **WHEN** concurrency check finds synchronization needs
- **THEN** system checks if appropriate mechanism is used (Mutex/RWMutex/Atomic/Channel)
- **AND** system identifies misused synchronization primitives

#### Scenario: Atomic operation correctness
- **WHEN** concurrency check finds atomic operations
- **THEN** system checks if atomic operations cover entire critical section
- **AND** system identifies mixed atomic/non-atomic operations on same data

#### Scenario: Concurrent collection safety
- **WHEN** concurrency check finds shared collections
- **THEN** system checks if thread-safe collection is used
- **AND** system identifies unsafe concurrent map/array operations

### Requirement: Concurrency report output
The system SHALL output structured concurrency report.

#### Scenario: Risk level classification
- **WHEN** concurrency findings exist
- **THEN** report classifies issues by risk level (High/Medium/Low)
- **AND** report includes pattern description
- **AND** report includes fix suggestion

#### Scenario: Report persistence
- **WHEN** concurrency check completes
- **THEN** system persists report to `context/review/<timestamp>-concurrency-<target>.md`