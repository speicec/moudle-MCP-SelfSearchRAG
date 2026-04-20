## Why

45 unit tests are failing across multiple modules, blocking reliable CI/CD and reducing code quality confidence. The failures span embedding services, retrieval pipeline, and query processing modules. Fixing these tests is critical before adding new features.

## What Changes

- Fix local embedding service tests (10 failures) - model loading and initialization issues
- Fix multimodal embedding tests (7 failures) - service initialization and mock configuration
- Fix enhanced retrieval E2E tests (9 failures) - mock service configuration and async handling
- Fix query decomposer tests (5 failures) - LLM mock and decomposition logic
- Fix Qdrant client configuration tests (4 failures) - config validation and initialization
- Fix query analyzer tests (3 failures) - filter detection and complexity heuristics
- Fix miscellaneous tests (7 failures) - layout OCR, hybrid embedding, chunking, performance, LLM generation

## Capabilities

### New Capabilities

None - this is a bug fix change, no new capabilities introduced.

### Modified Capabilities

- `local-embedding`: Fix test assertions for model initialization and embedding generation
- `multimodal-embedding`: Fix service mock configuration for test environment
- `enhanced-retrieval`: Fix mock services setup for E2E test scenarios
- `hybrid-retrieval`: Fix query decomposer mock LLM responses

## Impact

- **Test Files**: 13 test files with failing assertions
- **Services**: Local embedding, multimodal embedding, hybrid embedding, query decomposer
- **CI/CD**: All tests must pass for merge readiness