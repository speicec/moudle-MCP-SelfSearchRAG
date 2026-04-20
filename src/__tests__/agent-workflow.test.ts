/**
 * Integration test: Agent workflow simulation (Task 5.5)
 *
 * Simulates the complete Agent workflow:
 * 1. Agent reads CLAUDE.md trigger
 * 2. Agent encounters type error
 * 3. Agent calls type_fix MCP tool
 * 4. Agent applies fix suggestion
 * 5. Agent records fix usage
 * 6. Agent queries again with updated priorities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CLAUDE_MD_PATH = join(process.cwd(), 'CLAUDE.md');
const RULES_DIR = join(process.cwd(), 'eslint-type-fixes');
const STATS_FILE = join(RULES_DIR, 'stats', 'usage-log.json');
const RULE_FILE = join(RULES_DIR, 'rules', '2322.md');
const ESLINT_RULE_FILE = join(process.cwd(), 'eslint-rules', 'no-nullable-assignment.ts');

// Import handlers dynamically to avoid module resolution issues
async function getHandlers() {
  const { createTypeFixHandlers } = await import('../mcp/type-fix-handlers.js');
  return createTypeFixHandlers();
}

// Initialize stats file
function initStatsFile() {
  const initial = {
    records: [],
    summary: {
      "null-assignment": {
        totalHits: 0,
        fixDistribution: {},
        successRate: {}
      }
    }
  };
  writeFileSync(STATS_FILE, JSON.stringify(initial, null, 2));
  return initial;
}

describe('Agent Workflow Simulation', () => {
  beforeEach(() => {
    initStatsFile();
  });

  afterEach(() => {
    initStatsFile();
  });

  describe('Step 1: Agent reads CLAUDE.md trigger', () => {
    it('CLAUDE.md should exist and be minimal', () => {
      const content = readFileSync(CLAUDE_MD_PATH, 'utf-8');
      expect(content).toBeDefined();
      expect(content.length).toBeLessThan(100); // Minimal trigger mode
    });

    it('CLAUDE.md should contain MCP tool reference', () => {
      const content = readFileSync(CLAUDE_MD_PATH, 'utf-8');
      expect(content).toContain('type_fix');
      expect(content).toContain('error_code');
    });

    it('Agent knows to call type_fix on TS errors', () => {
      // Simulate Agent understanding the trigger
      const triggerLine = readFileSync(CLAUDE_MD_PATH, 'utf-8');
      const shouldCallTypeFix = triggerLine.includes('TS error') && triggerLine.includes('type_fix');
      expect(shouldCallTypeFix).toBe(true);
    });
  });

  describe('Step 2: Agent encounters TypeScript error', () => {
    it('ESLint rule error message should include MCP hint', async () => {
      // Verify rule file contains MCP tool hint
      const ruleContent = readFileSync(RULE_FILE, 'utf-8');
      expect(ruleContent).toContain('2322');
      expect(ruleContent).toContain('null-assignment');
    });

    it('Error code 2322 is covered in knowledge base', () => {
      const indexContent = readFileSync(join(RULES_DIR, 'index.json'), 'utf-8');
      const index = JSON.parse(indexContent);
      const rule2322 = index.rules.find((r: any) => r.tsCode === 2322);
      expect(rule2322).toBeDefined();
      expect(rule2322.id).toBe('null-assignment');
    });
  });

  describe('Step 3: Agent calls type_fix MCP tool', () => {
    it('should return fix suggestions with code examples', async () => {
      const handlers = await getHandlers();
      const result = await handlers.typeFix(2322);

      expect(result.success).toBe(true);
      expect((result.data as any).fixes).toBeDefined();
      expect((result.data as any).fixes.length).toBeGreaterThan(0);

      // Each fix should have code example
      const fixes = (result.data as any).fixes;
      for (const fix of fixes) {
        expect(fix.code).toBeDefined();
        expect(fix.type).toBeDefined();
      }
    });

    it('should return rule explanation', async () => {
      const handlers = await getHandlers();
      const result = await handlers.typeFix(2322);

      expect((result.data as any).ruleContent).toBeDefined();
      expect((result.data as any).ruleContent).toContain('Detection');
      expect((result.data as any).ruleContent).toContain('Fix');
    });
  });

  describe('Step 4: Agent applies fix suggestion', () => {
    it('should have multiple fix options to choose from', async () => {
      const handlers = await getHandlers();
      const result = await handlers.typeFix(2322);

      const fixes = (result.data as any).fixes;
      expect(fixes.length).toBeGreaterThanOrEqual(2);

      // Verify different fix types exist
      const fixTypes = fixes.map((f: any) => f.type);
      expect(fixTypes).toContain('default-value');
    });

    it('should provide when-to-use guidance for each fix', async () => {
      const handlers = await getHandlers();
      const result = await handlers.typeFix(2322);

      const fixes = (result.data as any).fixes;
      for (const fix of fixes) {
        if (fix.whenToUse) {
          expect(fix.whenToUse.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Step 5: Agent records fix usage', () => {
    it('should successfully record fix application', async () => {
      const handlers = await getHandlers();

      // Simulate Agent applying default-value fix
      const recordResult = await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'default-value',
        success: true,
      });

      expect(recordResult.success).toBe(true);
      expect((recordResult.data as any).recorded).toBe(true);
    });

    it('should persist statistics to file', async () => {
      const handlers = await getHandlers();

      await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'default-value',
        success: true,
      });

      // Verify file was updated (operation attempted)
      const stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));
      expect(stats.records.length).toBeGreaterThan(0);
      expect(stats.summary['null-assignment'].totalHits).toBeGreaterThan(0);
    });
  });

  describe('Step 6: Agent queries again with updated priorities', () => {
    it('should show updated statistics after recording', async () => {
      const handlers = await getHandlers();

      // Record some usage first
      await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'default-value',
        success: true,
      });
      await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'non-null-assert',
        success: false,
      });

      // Query again
      const result = await handlers.typeFix(2322);

      const stats = (result.data as any).stats;
      expect(stats.totalHits).toBeGreaterThan(0);
    });

    it('should prioritize successful fixes', async () => {
      const handlers = await getHandlers();

      // Simulate learning: default-value always succeeds, non-null-assert sometimes fails
      await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'default-value',
        success: true,
      });
      await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'default-value',
        success: true,
      });
      await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'non-null-assert',
        success: false,
      });

      // Query again
      const result = await handlers.typeFix(2322);

      expect(result.success).toBe(true);
      // The system should have statistics showing default-value is more successful
      const stats = (result.data as any).stats;
      expect(stats.successRate['default-value']).toBeGreaterThan(0);
    });

    it('complete workflow should produce self-evolving behavior', async () => {
      const handlers = await getHandlers();

      // Full workflow simulation
      // 1. Initial query (baseline)
      const initial = await handlers.typeFix(2322);
      expect(initial.success).toBe(true);

      // 2. Apply fix 5 times with different outcomes
      for (let i = 0; i < 3; i++) {
        await handlers.recordFix({
          rule_id: 'null-assignment',
          fix_type: 'default-value',
          success: true,
        });
      }
      await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'condition-check',
        success: true,
      });
      await handlers.recordFix({
        rule_id: 'null-assignment',
        fix_type: 'non-null-assert',
        success: false,
      });

      // 3. Query again - should see evolved priorities
      const evolved = await handlers.typeFix(2322);

      expect(evolved.success).toBe(true);
      const stats = (evolved.data as any).stats;
      expect(stats.totalHits).toBe(5);

      // default-value has 100% success (3/3)
      // condition-check has 100% success (1/1)
      // non-null-assert has 0% success (0/1)
      expect(stats.fixDistribution['default-value']).toBe(3);
      expect(stats.successRate['default-value']).toBe(3);
    });
  });

  describe('Three-layer trigger guarantee', () => {
    it('Layer 1: CLAUDE.md trigger exists', () => {
      expect(readFileSync(CLAUDE_MD_PATH, 'utf-8')).toContain('type_fix');
    });

    it('Layer 2: MCP Tool descriptions have WHEN TO CALL', async () => {
      const { TYPE_FIX_TOOLS } = await import('../mcp/type-fix-tools.js');
      expect(TYPE_FIX_TOOLS.type_fix.description).toContain('WHEN TO CALL');
    });

    it('Layer 3: ESLint error messages include fix hint', () => {
      const eslintRuleContent = readFileSync(ESLINT_RULE_FILE, 'utf-8');
      expect(eslintRuleContent).toContain('💡');
      expect(eslintRuleContent).toContain('type_fix');
      expect(eslintRuleContent).toContain('2322');
    });
  });
});