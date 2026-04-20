## ADDED Requirements

### Requirement: ESLint rule detects nullable assignment

The system SHALL provide a custom ESLint rule that detects nullable type assignment errors.

#### Scenario: Null assignment detection
- **WHEN** code assigns `T | null` to `T` (non-null type)
- **THEN** the ESLint rule SHALL report error with message including MCP Tool hint `💡 Fix: type_fix(2322)`

#### Scenario: Undefined assignment detection
- **WHEN** code assigns `T | undefined` to `T` (non-null type)
- **THEN** the ESLint rule SHALL report error with message including MCP Tool hint

#### Scenario: Union type detection
- **WHEN** code assigns union type containing null/undefined to non-null type
- **THEN** the ESLint rule SHALL detect and report error

### Requirement: ESLint rule uses TypeScript type checker

The ESLint rule SHALL use TypeScript Compiler API for accurate type checking.

#### Scenario: Type checker access
- **WHEN** ESLint rule evaluates assignment
- **THEN** the rule SHALL use `ESLintUtils.getParserServices(context)` to access type checker

#### Scenario: Type compatibility check
- **WHEN** checking type assignment
- **THEN** the rule SHALL use `checker.isTypeAssignableTo(sourceType, targetType)` for compatibility

### Requirement: ESLint rule provides inline fix hint

The ESLint error message SHALL include MCP Tool call hint for Agent guidance.

#### Scenario: Error message format
- **WHEN** ESLint rule reports error
- **THEN** the message SHALL be format: `Type '{source}' is not assignable to type '{target}'. 💡 Fix: type_fix(2322)`