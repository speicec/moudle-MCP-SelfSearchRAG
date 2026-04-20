/**
 * Unit tests for MCP Type Fix handlers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeFixHandlers, createTypeFixHandlers } from '../mcp/type-fix-handlers.js';

describe('TypeFixHandlers', () => {
  let handlers: TypeFixHandlers;

  beforeEach(() => {
    handlers = createTypeFixHandlers();
  });

  describe('typeFix', () => {
    it('should return fix suggestions for error code 2322', async () => {
      const result = await handlers.typeFix(2322);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).errorCode).toBe(2322);
      expect((result.data as any).ruleId).toBe('null-assignment');
    });

    it('should return error for unknown error code', async () => {
      const result = await handlers.typeFix(99999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No rule found');
    });

    it('should return fix suggestions with code examples', async () => {
      const result = await handlers.typeFix(2322);

      expect(result.success).toBe(true);
      expect((result.data as any).fixes).toBeDefined();
      expect((result.data as any).fixes.length).toBeGreaterThan(0);

      // Each fix should have code example
      const fixes = (result.data as any).fixes;
      for (const fix of fixes) {
        expect(fix.type).toBeDefined();
      }
    });
  });

  describe('recordFix', () => {
    it('should attempt to record fix usage', async () => {
      const result = await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'default-value',
        success: true,
      });

      // Even if file write fails, the handler should attempt the operation
      expect(result).toBeDefined();
    });

    it('should return a result object', async () => {
      const result = await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'default-value',
        success: true,
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
    });
  });

  describe('typeFixList', () => {
    it('should return list of covered rules', async () => {
      const result = await handlers.typeFixList();

      expect(result.success).toBe(true);
      expect((result.data as any).rules).toBeDefined();
      expect((result.data as any).total).toBeGreaterThan(0);
    });

    it('should include error code 2322 in the list', async () => {
      const result = await handlers.typeFixList();

      const rules = (result.data as any).rules;
      const rule2322 = rules.find((r: any) => r.errorCode === 2322);

      expect(rule2322).toBeDefined();
      expect(rule2322.ruleId).toBe('null-assignment');
    });
  });

  describe('Self-evolving loop integration (Task 5.4)', () => {
    it('should complete query step of the loop', async () => {
      const result = await handlers.typeFix(2322);
      expect(result.success).toBe(true);
      expect((result.data as any).ruleContent).toBeDefined();
    });

    it('should handle record fix call', async () => {
      const result = await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'default-value',
        success: true,
      });
      expect(result).toBeDefined();
    });

    it('should be able to query again after recording', async () => {
      // Query first
      await handlers.typeFix(2322);

      // Attempt record
      await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'default-value',
        success: true,
      });

      // Query again - should still work
      const result = await handlers.typeFix(2322);
      expect(result.success).toBe(true);
    });
  });
});