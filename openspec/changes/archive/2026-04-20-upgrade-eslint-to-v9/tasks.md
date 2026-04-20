## 1. Dependency Updates

- [x] 1.1 Remove legacy ESLint packages (`@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`)
- [x] 1.2 Install ESLint 9.x (`npm install eslint@^9 --save-dev`)
- [x] 1.3 Install typescript-eslint 8.x (`npm install typescript-eslint@^8 --save-dev`)
- [x] 1.4 Verify no dependency conflicts (`npm ls eslint typescript-eslint`)

## 2. Configuration Cleanup

- [x] 2.1 Delete legacy `.eslintrc.cjs` file
- [x] 2.2 Fix `eslint.config.js` flat config format (use `typescript-eslint` import)
- [x] 2.3 Register custom `no-nullable-assignment` rule in plugins object
- [x] 2.4 Configure parserOptions with `project: './tsconfig.json'`
- [x] 2.5 Update ignores pattern for flat config format

## 3. Script Updates

- [x] 3.1 Update `package.json` lint script (remove `--ext` flag, use `npx eslint src`)
- [x] 3.2 Verify lint script works (`npm run lint`)

## 4. Custom Rule Verification

- [x] 4.1 Verify `eslint-rules/no-nullable-assignment.ts` imports work with v8
- [x] 4.2 Create test file with nullable assignment to trigger rule
- [x] 4.3 Run ESLint and verify custom rule reports error with MCP Tool hint
- [x] 4.4 Verify error message format: `💡 Fix: type_fix(2322)`

## 5. Testing & Validation

- [x] 5.1 Run `npm test` to ensure no regression (607 passed, 3 pre-existing failures)
- [x] 5.2 Run type-fix handler tests (`npm test -- src/__tests__/type-fix-handlers.test.ts`) (10 passed)
- [x] 5.3 Manual test: lint a file with TypeScript errors (ESLint works correctly)
- [x] 5.4 Clean up test file created in 4.2