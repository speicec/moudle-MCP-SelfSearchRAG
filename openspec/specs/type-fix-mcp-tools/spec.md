## ADDED Requirements

### Requirement: MCP Tool provides fix suggestions

The system SHALL provide an MCP Tool `type_fix` that returns fix suggestions for TypeScript errors.

#### Scenario: Query by error code
- **WHEN** Agent calls `type_fix(error_code)`
- **THEN** the system SHALL return rule explanation, fix suggestions sorted by priority, and statistics

#### Scenario: Error code not found
- **WHEN** Agent calls `type_fix` with unknown error code
- **THEN** the system SHALL return error message "No rule found for error code {code}"

### Requirement: MCP Tool records fix usage

The system SHALL provide an MCP Tool `record_fix` for self-evolving statistics.

#### Scenario: Record successful fix
- **WHEN** Agent calls `record_fix(rule_id, fix_type, success=true)`
- **THEN** the system SHALL update usage-log.json and return updated summary statistics

#### Scenario: Record failed fix
- **WHEN** Agent calls `record_fix(rule_id, fix_type, success=false)`
- **THEN** the system SHALL record the failure and NOT increment success rate

### Requirement: MCP Tool lists available rules

The system SHALL provide an MCP Tool `type_fix_list` that returns all covered error codes.

#### Scenario: List rules
- **WHEN** Agent calls `type_fix_list()`
- **THEN** the system SHALL return array of rules with errorCode, ruleId, and brief description

### Requirement: MCP Tool descriptions include trigger conditions

The MCP Tool definitions SHALL include WHEN TO CALL conditions in descriptions.

#### Scenario: Tool description format
- **WHEN** Agent views available MCP Tools
- **THEN** each tool description SHALL include WHEN TO CALL section and COVERED RULES list