## ADDED Requirements

### Requirement: Precheck execution trigger
The system SHALL execute precheck when `/check` command is invoked without any subcommand.

#### Scenario: Precheck on bare check command
- **WHEN** user invokes `/check` without subcommand
- **THEN** system executes precheck agent
- **AND** system outputs precheck report
- **AND** system persists report to `context/review/<timestamp>-precheck-default.md`

### Requirement: Git status scanning
The system SHALL scan Git status during precheck.

#### Scenario: Git branch and commit status
- **WHEN** precheck executes
- **THEN** system reports current branch name
- **AND** system reports uncommitted changes count (modified, untracked, staged)
- **AND** system reports commits ahead/behind main branch

#### Scenario: Git status unavailable
- **WHEN** current directory is not a Git repository
- **THEN** system reports "Git status unavailable"
- **AND** system continues with other checks

### Requirement: OpenSpec status scanning
The system SHALL scan OpenSpec change status during precheck.

#### Scenario: OpenSpec change exists
- **WHEN** OpenSpec is initialized and active changes exist
- **THEN** system reports each change name
- **AND** system reports task completion progress (completedTasks/totalTasks)
- **AND** system reports last modification time

#### Scenario: No OpenSpec changes
- **WHEN** no OpenSpec changes exist or OpenSpec not initialized
- **THEN** system reports "No active OpenSpec changes"
- **AND** system continues with other checks

### Requirement: File change quick scan
The system SHALL perform quick scan of changed files during precheck.

#### Scenario: Modified files detection
- **WHEN** precheck executes
- **THEN** system lists modified files (from Git status)
- **AND** system identifies test file changes
- **AND** system identifies config file changes

#### Scenario: Large change set warning
- **WHEN** modified files count exceeds 20
- **THEN** system outputs warning "Large change set detected"
- **AND** system suggests detailed review commands

### Requirement: Next step suggestions
The system SHALL output actionable next step suggestions after precheck.

#### Scenario: Suggest review commands
- **WHEN** precheck completes with OpenSpec changes present
- **THEN** system suggests `/check:review` for each active change
- **AND** system suggests `/check:code-reviewer` for code changes

#### Scenario: Suggest code checks
- **WHEN** precheck completes with modified code files
- **THEN** system suggests `/check --all` for comprehensive code check
- **AND** system suggests specific dimension checks based on file types

#### Scenario: All clear
- **WHEN** precheck completes with no issues found
- **THEN** system reports "All clear"
- **AND** system suggests ready to commit or merge