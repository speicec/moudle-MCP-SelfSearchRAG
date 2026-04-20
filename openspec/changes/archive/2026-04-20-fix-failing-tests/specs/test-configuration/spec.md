## ADDED Requirements

### Requirement: Tests properly mock external dependencies

Tests SHALL use proper mocking for services that depend on models, LLMs, or external APIs.

#### Scenario: Local embedding service mock
- **WHEN** testing local embedding service
- **THEN** tests SHALL use mock model loader instead of attempting real model initialization

#### Scenario: Multimodal embedding service mock
- **WHEN** testing multimodal embedding service
- **THEN** tests SHALL mock image processing and text embedding generation

### Requirement: Tests await async operations properly

Tests SHALL properly await all async operations before making assertions.

#### Scenario: Async service initialization
- **WHEN** testing service initialization
- **THEN** tests SHALL await initialization completion before asserting on service state

#### Scenario: Async retrieval operations
- **WHEN** testing retrieval pipeline
- **THEN** tests SHALL await query processing completion before asserting on results

### Requirement: Test assertions match actual service behavior

Tests SHALL assert on actual service behavior, not outdated assumptions.

#### Scenario: Config validation
- **WHEN** testing service configuration
- **THEN** tests SHALL assert on current default values, not historical values

#### Scenario: Service output format
- **WHEN** testing service output
- **THEN** tests SHALL assert on actual output format from service implementation