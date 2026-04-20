## ADDED Requirements

### Requirement: Knowledge base stores TypeScript type fix rules

The system SHALL maintain a knowledge base of TypeScript type error fix rules in Markdown format.

#### Scenario: Rule file structure
- **WHEN** a TypeScript error code is documented
- **THEN** the rule SHALL be stored in `eslint-type-fixes/rules/{error-code}.md` with detection description and fix suggestions

#### Scenario: Rule file contains fix suggestions
- **WHEN** Agent queries a rule
- **THEN** the rule file SHALL contain multiple fix suggestions with code examples and "when to use" guidance

### Requirement: Knowledge base maintains usage statistics

The system SHALL track fix usage statistics for self-evolving priority ranking.

#### Scenario: Usage log format
- **WHEN** Agent applies a fix
- **THEN** the usage SHALL be recorded in `eslint-type-fixes/stats/usage-log.json` with timestamp, rule_id, fix_type, and success

#### Scenario: Statistics drive priority
- **WHEN** Agent queries fix suggestions
- **THEN** the suggestions SHALL be sorted by priority calculated from success rate (0.7 weight) and usage frequency (0.3 weight)

### Requirement: Knowledge base provides rule index

The system SHALL provide an index file for quick rule lookup.

#### Scenario: Index format
- **WHEN** MCP Tool needs to list rules
- **THEN** the system SHALL read `eslint-type-fixes/index.json` containing rule metadata (tsCode, id, brief)