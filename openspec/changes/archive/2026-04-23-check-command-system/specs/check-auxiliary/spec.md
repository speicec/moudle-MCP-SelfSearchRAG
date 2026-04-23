## ADDED Requirements

### Requirement: Auxiliary check execution trigger
The system SHALL execute auxiliary check when `/check:auxiliary` command is invoked.

#### Scenario: Auxiliary check invocation
- **WHEN** user invokes `/check:auxiliary`
- **THEN** system identifies code files in scope
- **AND** system executes auxiliary agent
- **AND** system outputs auxiliary findings report

### Requirement: Code standards check
The system SHALL check for code standards compliance.

#### Scenario: Naming conventions
- **WHEN** auxiliary check analyzes code
- **THEN** system checks if variable names follow conventions (camelCase/snake_case/PascalCase)
- **AND** system checks if function names are descriptive
- **AND** system checks if class/interface names follow conventions
- **AND** system reports naming violations with location

#### Scenario: Comment standards
- **WHEN** auxiliary check finds comments
- **THEN** system checks if public functions have documentation comments
- **AND** system checks if complex logic has explanation comments
- **AND** system identifies outdated/misleading comments
- **AND** system reports comment issues

#### Scenario: Format standards
- **WHEN** auxiliary check analyzes code
- **THEN** system checks if indentation is consistent
- **AND** system checks if spacing is consistent
- **AND** system identifies formatting violations

#### Scenario: Import/export standards
- **WHEN** auxiliary check finds imports
- **THEN** system checks if imports are organized (external/internal/types)
- **AND** system checks if unused imports exist
- **AND** system checks if exports are properly declared

### Requirement: Performance check
The system SHALL check for performance issues.

#### Scenario: Loop optimization
- **WHEN** auxiliary check finds loops
- **THEN** system identifies repeated calculations in loops
- **AND** system identifies expensive operations in loops
- **AND** system suggests loop optimization

#### Scenario: Memory allocation
- **WHEN** auxiliary check finds memory operations
- **THEN** system identifies unnecessary allocations
- **AND** system identifies large object creation in hot paths
- **AND** system suggests memory optimization

#### Scenario: Data structure selection
- **WHEN** auxiliary check finds data structure usage
- **THEN** system checks if appropriate data structure is selected
- **AND** system identifies Array used for lookup (suggest Map/Set)
- **AND** system suggests optimal data structure

#### Scenario: N+1 query detection
- **WHEN** auxiliary check finds database operations
- **THEN** system identifies N+1 query patterns
- **AND** system suggests batch query optimization

#### Scenario: Cache opportunity
- **WHEN** auxiliary check finds repeated expensive operations
- **THEN** system identifies cache opportunities
- **AND** system suggests caching strategy

### Requirement: Maintainability check
The system SHALL check for maintainability issues.

#### Scenario: Code duplication (DRY)
- **WHEN** auxiliary check analyzes code
- **THEN** system identifies duplicated code blocks (>5 lines identical)
- **AND** system calculates duplication percentage
- **AND** system suggests extraction to shared function

#### Scenario: Modularity assessment
- **WHEN** auxiliary check analyzes code
- **THEN** system checks if modules have clear boundaries
- **AND** system identifies oversized modules
- **AND** system suggests module splitting

#### Scenario: Dependency clarity
- **WHEN** auxiliary check analyzes dependencies
- **THEN** system checks if dependencies are explicit
- **AND** system identifies implicit dependencies (globals, environment)
- **AND** system suggests explicit dependency injection

#### Scenario: Configuration externalization
- **WHEN** auxiliary check finds hardcoded configuration
- **THEN** system identifies hardcoded values that should be configurable
- **AND** system suggests configuration externalization

### Requirement: Test coverage check
The system SHALL check for test coverage adequacy.

#### Scenario: Unit test coverage
- **WHEN** auxiliary check analyzes tests
- **THEN** system checks if unit tests exist for public functions
- **AND** system identifies untested public functions
- **AND** system suggests test creation

#### Scenario: Edge case test coverage
- **WHEN** auxiliary check analyzes tests
- **THEN** system checks if edge cases are tested
- **AND** system identifies functions without edge case tests
- **AND** system suggests edge case test scenarios

#### Scenario: Error path test coverage
- **WHEN** auxiliary check analyzes tests
- **THEN** system checks if error scenarios are tested
- **AND** system identifies missing error path tests
- **AND** system suggests error test cases

#### Scenario: Integration test coverage
- **WHEN** auxiliary check analyzes tests
- **THEN** system checks if integration tests exist for key flows
- **AND** system identifies missing integration tests
- **AND** system suggests integration test scenarios

### Requirement: Documentation completeness check
The system SHALL check for documentation completeness.

#### Scenario: Function documentation
- **WHEN** auxiliary check finds public functions
- **THEN** system checks if documentation exists (JSDoc/Doc comment)
- **AND** system checks if parameter descriptions exist
- **AND** system checks if return value descriptions exist
- **AND** system identifies undocumented functions

#### Scenario: Type documentation
- **WHEN** auxiliary check finds types/interfaces
- **THEN** system checks if type documentation exists
- **AND** system checks if field descriptions exist
- **AND** system identifies undocumented types

#### Scenario: Usage examples
- **WHEN** auxiliary check finds public APIs
- **THEN** system checks if usage examples exist
- **AND** system identifies APIs without examples
- **AND** system suggests adding examples

#### Scenario: README/CHANGELOG
- **WHEN** auxiliary check analyzes project
- **THEN** system checks if README exists and is current
- **AND** system checks if CHANGELOG exists for version history
- **AND** system reports documentation gaps

### Requirement: Auxiliary report output
The system SHALL output structured auxiliary report.

#### Scenario: Report structure
- **WHEN** auxiliary check completes
- **THEN** report includes standards violations
- **AND** report includes performance issues
- **AND** report includes maintainability issues
- **AND** report includes test coverage assessment
- **AND** report includes documentation gaps

#### Scenario: Report persistence
- **WHEN** auxiliary check completes
- **THEN** system persists report to `context/review/<timestamp>-auxiliary-<target>.md`