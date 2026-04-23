## ADDED Requirements

### Requirement: Report persistence directory
The system SHALL persist all review reports to `context/review/` directory.

#### Scenario: Directory existence check
- **WHEN** any check command completes
- **THEN** system ensures `context/review/` directory exists
- **AND** system creates directory if not exists
- **AND** system proceeds with report writing

#### Scenario: Directory location
- **WHEN** report is persisted
- **THEN** directory is at project root level `context/review/`
- **AND** directory is separate from `openspec/` directory
- **AND** directory is visible to users (not hidden)

### Requirement: Report file naming format
The system SHALL use standardized naming format for report files.

#### Scenario: Standard naming format
- **WHEN** report is persisted
- **THEN** file name follows format: `YYYY-MM-DD-HHmm-<command>-<target>.md`
- **AND** timestamp is in local time
- **AND** command is check subcommand name (precheck/review/design/security/etc.)
- **AND** target is change name or "default" for general checks

#### Scenario: Example names
- **WHEN** various check commands complete
- **THEN** possible file names include:
  - `2026-04-22-1530-precheck-default.md`
- **AND** possible file names include:
  - `2026-04-22-1530-review-agent-planning.md`
- **AND** possible file names include:
  - `2026-04-22-1530-all-code-review.md`

### Requirement: Report content structure
The system SHALL use consistent structure for all report files.

#### Scenario: Report header
- **WHEN** report file is written
- **THEN** first line includes report title with command name
- **AND** second line includes timestamp of generation
- **AND** third line includes target/context of check

#### Scenario: Report body
- **WHEN** report file is written
- **THEN** body includes findings organized by category
- **AND** body includes severity/priority classification
- **AND** body includes suggestions/recommendations

#### Scenario: Report footer
- **WHEN** report file is written
- **THEN** footer includes summary/conclusion
- **AND** footer includes next step suggestions

### Requirement: Report file format
The system SHALL use Markdown format for all report files.

#### Scenario: Markdown compliance
- **WHEN** report file is written
- **THEN** file uses standard Markdown syntax
- **AND** file uses proper heading hierarchy (# ## ### ####)
- **AND** file uses tables for structured data
- **AND** file uses code blocks for code references

#### Scenario: Encoding
- **WHEN** report file is written
- **THEN** file uses UTF-8 encoding
- **AND** file handles Chinese characters correctly
- **AND** file handles special characters in file paths

### Requirement: Report history management
The system SHALL allow historical report management.

#### Scenario: Historical accumulation
- **WHEN** multiple checks are performed over time
- **THEN** reports accumulate in `context/review/` directory
- **AND** file names include timestamp for ordering
- **AND** newer reports do not overwrite older reports

#### Scenario: Manual cleanup
- **WHEN** user wants to clean old reports
- **THEN** user can manually delete files from `context/review/`
- **AND** system does not auto-delete reports
- **AND** system recommends cleanup after 30 days

### Requirement: Combined execution report
The system SHALL generate combined report for `/check --all` execution.

#### Scenario: Combined report structure
- **WHEN** `/check --all` completes
- **THEN** single report file includes all 7 dimensions
- **AND** each dimension has dedicated section
- **AND** report includes overall summary
- **AND** file name uses command "all"

#### Scenario: Cross-dimension issues
- **WHEN** combined report identifies related issues across dimensions
- **THEN** report highlights cross-dimension patterns
- **AND** report suggests unified fix approach

### Requirement: Report accessibility
The system SHALL ensure reports are easily accessible.

#### Scenario: Report output notification
- **WHEN** report is persisted
- **THEN** system outputs file path in console
- **AND** system confirms persistence success
- **AND** system suggests viewing report

#### Scenario: Report content preview
- **WHEN** check command completes
- **THEN** system outputs summary in conversation
- **AND** system indicates full report location
- **AND** user can read full report from file