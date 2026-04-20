## Context

45 unit tests are failing due to various issues:
- **Service initialization**: Tests expect services to initialize but models aren't loaded in test environment
- **Mock configuration**: Mocks don't properly simulate service behavior
- **Async handling**: Tests don't properly await async operations
- **Config validation**: Tests assert on default configs that have changed

## Goals / Non-Goals

**Goals:**
- Fix all 45 failing tests to restore CI/CD reliability
- Maintain existing test coverage (571 passing tests should remain passing)
- Document root causes for each category of failures

**Non-Goals:**
- Adding new test coverage
- Refactoring test architecture
- Changing actual service behavior

## Decisions

### D1: Fix tests by adjusting test expectations, not changing service behavior

Tests should adapt to actual service behavior. Services are correct; tests have outdated assumptions.

**Alternatives considered:**
- Changing services to match test expectations → Rejected: tests should verify behavior, not define it
- Skipping failing tests → Rejected: defeats purpose of test suite

### D2: Group fixes by module for efficient batch resolution

Fix tests by category:
1. Embedding services (local, multimodal, hybrid) - 18 failures
2. Retrieval pipeline (enhanced, query decomposer, analyzer) - 17 failures
3. Qdrant and misc - 10 failures

### D3: Use proper mocking patterns for external dependencies

Services that depend on models, LLM, or external APIs should use injected mocks, not attempt real initialization.

## Risks / Trade-offs

- [Fix breaks previously passing tests] → Run full test suite after each fix batch
- [Root cause misunderstood] → Investigate actual error messages before fixing
- [Mock behavior diverges from real service] → Keep mocks minimal, test real behavior in integration tests