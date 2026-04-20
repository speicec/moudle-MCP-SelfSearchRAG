## ADDED Requirements

### Requirement: Server broadcasts startup progress events

The system SHALL broadcast WebSocket events during model preloading to inform clients of startup status.

#### Scenario: Startup progress event during model loading
- **WHEN** server is preloading embedding models
- **THEN** system broadcasts `startup:progress` event with stage, progress percentage, message, and optional model name

#### Scenario: Startup ready event when complete
- **WHEN** model preloading completes successfully
- **THEN** system broadcasts `startup:ready` event with completion message

#### Scenario: Startup error event on failure
- **WHEN** model preloading fails
- **THEN** system broadcasts `startup:error` event with error message

### Requirement: Frontend displays startup progress component

The system SHALL provide a frontend component that displays startup progress to users.

#### Scenario: Progress bar shows loading percentage
- **WHEN** frontend receives `startup:progress` event
- **THEN** progress bar updates to show current percentage and stage label

#### Scenario: Success indicator when ready
- **WHEN** frontend receives `startup:ready` event
- **THEN** component displays success state and allows document operations

#### Scenario: Error state with retry option
- **WHEN** frontend receives `startup:error` event
- **THEN** component displays error message and provides retry button

### Requirement: Setup script for model pre-download

The system SHALL provide a setup script for pre-downloading models before deployment.

#### Scenario: Setup downloads required models
- **WHEN** user runs `npm run setup`
- **THEN** script downloads models required by current EMBEDDING_MODE configuration

#### Scenario: Setup skips cached models
- **WHEN** model already exists in cache with complete files
- **THEN** script skips download and reports model as cached

#### Scenario: Setup shows download progress
- **WHEN** model is being downloaded
- **THEN** script displays progress bar with percentage and file name