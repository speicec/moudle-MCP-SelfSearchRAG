## ADDED Requirements

### Requirement: CLAUDE.md uses trigger mode

The project CLAUDE.md SHALL use trigger mode design to minimize context usage.

#### Scenario: Trigger mode format
- **WHEN** Agent enters the project
- **THEN** CLAUDE.md SHALL contain only: `TS error → type_fix(error_code)` (approximately 10 tokens)

#### Scenario: No detailed content
- **WHEN** CLAUDE.md is loaded
- **THEN** the file SHALL NOT contain rule lists, fix examples, or detailed descriptions

### Requirement: Three-layer trigger guarantee

The system SHALL provide three trigger layers to ensure Agent invokes MCP Tool.

#### Scenario: Layer 1 CLAUDE.md trigger
- **WHEN** Agent enters project and reads CLAUDE.md
- **THEN** Agent SHALL see the trigger line and know MCP Tool exists

#### Scenario: Layer 2 MCP Tool description
- **WHEN** Agent lists available MCP Tools
- **THEN** `type_fix` description SHALL include WHEN TO CALL and COVERED RULES

#### Scenario: Layer 3 ESLint error hint
- **WHEN** Agent sees ESLint error output
- **THEN** error message SHALL include `💡 Fix: type_fix(code)` hint

### Requirement: Context efficiency target

The trigger mode design SHALL achieve 80%+ reduction in context usage.

#### Scenario: Token count target
- **WHEN** comparing trigger mode vs paragraph mode
- **THEN** trigger mode SHALL use less than 20 tokens for CLAUDE.md