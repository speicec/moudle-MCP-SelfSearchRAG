## 1. Dependency Updates

- [ ] 1.1 Remove legacy ESLint packages (`@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`)
- [ ] 1.2 Install ESLint 9.x (`npm install eslint@^9 --save-dev`)
- [ ] 1.3 Install typescript-eslint 8.x (`npm install typescript-eslint@^8 --save-dev`)
- [ ] 1.4 Verify no dependency conflicts (`npm ls eslint typescript-eslint`)

## 2. Configuration Cleanup

- [ ] 2.1 Delete legacy `.eslintrc.cjs` file
- [ ] 2.2 Fix `eslint.config.js` flat config format (use `typescript-eslint` import)
- [ ] 2.3 Register custom `no-nullable-assignment` rule in plugins object
- [ ] 2.4 Configure parserOptions with `project: './tsconfig.json'`
- [ ] 2.5 Update ignores pattern for flat config format

## 3. Script Updates

- [ ] 3.1 Update `package.json` lint script (remove `--ext` flag, use `npx eslint src`)
- [ ] 3.2 Verify lint script works (`npm run lint`)

## 4. Custom Rule Verification

- [ ] 4.1 Verify `eslint-rules/no-nullable-assignment.ts` imports work with v8
- [ ] 4.2 Create test file with nullable assignment to trigger rule
- [ ] 4.3 Run ESLint and verify custom rule reports error with MCP Tool hint
- [ ] 4.4 Verify error message format: `💡 Fix: type_fix(2322)`

## 5. Testing & Validation

- [ ] 5.1 Run `npm test` to ensure no regression
- [ ] 5.2 Run type-fix handler tests (`npm test -- src/__tests__/type-fix-handlers.test.ts`)
- [ ] 5.3 Manual test: lint a file with TypeScript errors
- [ ] 5.4 Clean up test file created in 4.2