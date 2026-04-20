## 1. Knowledge Base Setup

- [x] 1.1 Create `eslint-type-fixes/` directory structure
- [x] 1.2 Create `eslint-type-fixes/index.json` with rule metadata
- [x] 1.3 Create `eslint-type-fixes/rules/2322.md` (null-assignment rule)
- [x] 1.4 Create `eslint-type-fixes/stats/usage-log.json` with initial structure

## 2. MCP Tools Implementation

- [x] 2.1 Create `src/mcp/type-fix-tools.ts` with tool definitions
- [x] 2.2 Create `src/mcp/type-fix-handlers.ts` with handler implementation
- [x] 2.3 Implement `type_fix(error_code)` handler - read rule file and return fixes
- [x] 2.4 Implement `record_fix()` handler - update usage-log.json
- [x] 2.5 Implement `type_fix_list()` handler - return rule index
- [x] 2.6 Implement `prioritizeFixes()` function - sort by success rate
- [x] 2.7 Register MCP Tools in `src/mcp/server.ts`

## 3. ESLint Rule Implementation

- [x] 3.1 Create `eslint-rules/` directory
- [x] 3.2 Create `eslint-rules/no-nullable-assignment.ts` custom rule
- [x] 3.3 Implement `isNullable()` type checking helper
- [x] 3.4 Implement AssignmentExpression visitor with type checker
- [x] 3.5 Add error message with MCP Tool hint (`💡 Fix: type_fix(2322)`)
- [x] 3.6 Update ESLint config to include custom rule

## 4. Trigger Mode Configuration

- [x] 4.1 Create `CLAUDE.md` with trigger line only (10 tokens)
- [x] 4.2 Add detailed WHEN TO CALL in MCP Tool descriptions (done in 2.1)
- [x] 4.3 Verify ESLint error messages include fix hint (done in 3.5)

## 5. Testing & Validation

- [x] 5.1 Write unit tests for MCP Tool handlers
- [x] 5.2 Write unit tests for ESLint rule detection
- [x] 5.3 Test trigger mode - verify CLAUDE.md token count < 20
- [x] 5.4 Test self-evolving loop - apply fix, record, query again (agent-workflow.test.ts)
- [x] 5.5 Manual test: Agent workflow with type error (agent-workflow.test.ts integration tests)