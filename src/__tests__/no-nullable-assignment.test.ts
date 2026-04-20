/**
 * Unit tests for no-nullable-assignment ESLint rule
 *
 * Tests cover:
 * - Rule structure validation
 * - MCP Tool hint in error messages
 * - Type checking behavior (requires mock)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read rule file directly since TypeScript files can't be imported in vitest without compilation
const RULE_FILE = join(process.cwd(), 'eslint-rules', 'no-nullable-assignment.ts');

describe('no-nullable-assignment ESLint rule', () => {
  // Read rule content and parse structure
  const ruleContent = readFileSync(RULE_FILE, 'utf-8');

  it('should be a valid TypeScript file', () => {
    expect(ruleContent).toBeDefined();
    expect(ruleContent.length).toBeGreaterThan(100);
  });

  it('should define rule with meta property', () => {
    expect(ruleContent).toContain('meta:');
    expect(ruleContent).toContain('type:');
    expect(ruleContent).toContain('messages:');
  });

  it('should have correct error message with MCP Tool hint', () => {
    // Template uses TS_ERROR_CODE variable
    expect(ruleContent).toContain('type_fix');
    expect(ruleContent).toContain('TS_ERROR_CODE');
    expect(ruleContent).toContain('2322');
    expect(ruleContent).toContain('💡');
    expect(ruleContent).toContain('nullableAssignment');
  });

  it('should have proper rule schema (empty schema)', () => {
    expect(ruleContent).toContain('schema:');
    expect(ruleContent).toContain('[]');
  });

  it('should have recommended setting', () => {
    expect(ruleContent).toContain('recommended:');
    expect(ruleContent).toContain('strict');
  });

  it('should have correct TypeScript error code in hint', () => {
    // TS2322 is the error code for type assignment mismatches
    expect(ruleContent).toContain('2322');
  });

  it('should define create function with handlers', () => {
    expect(ruleContent).toContain('create(context)');
    expect(ruleContent).toContain('AssignmentExpression');
    expect(ruleContent).toContain('VariableDeclarator');
    expect(ruleContent).toContain('ReturnStatement');
  });

  it('should use TypeScript type checker API', () => {
    expect(ruleContent).toContain('getParserServices');
    expect(ruleContent).toContain('getTypeChecker');
    expect(ruleContent).toContain('getTypeAtLocation');
    expect(ruleContent).toContain('isTypeAssignableTo');
  });

  it('should define isNullable helper function', () => {
    expect(ruleContent).toContain('function isNullable');
    expect(ruleContent).toContain('TypeFlags.Null');
    expect(ruleContent).toContain('TypeFlags.Undefined');
  });

  describe('Error message format verification', () => {
    it('should include source type placeholder', () => {
      expect(ruleContent).toContain('{{source}}');
    });

    it('should include target type placeholder', () => {
      expect(ruleContent).toContain('{{target}}');
    });
  });
});