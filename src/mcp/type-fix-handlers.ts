/**
 * MCP Tool Handlers for TypeScript type fix suggestions
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Resolve project root - works in both normal runtime and vitest
const getProjectRoot = (): string => {
  // Try process.cwd() first (normal runtime)
  const cwdPath = join(process.cwd(), 'eslint-type-fixes');
  if (existsSync(join(cwdPath, 'index.json'))) {
    return cwdPath;
  }

  // Fallback: use module path (vitest scenario)
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  // Walk up from src/mcp to project root
  const projectRoot = join(moduleDir, '..', '..', '..');
  return join(projectRoot, 'eslint-type-fixes');
};

const RULES_DIR = getProjectRoot();
const STATS_FILE = join(RULES_DIR, 'stats', 'usage-log.json');
const INDEX_FILE = join(RULES_DIR, 'index.json');

export interface FixSuggestion {
  type: string;
  description: string;
  code: string;
  whenToUse: string;
  priority?: number;
  stats?: { usageCount: number; successRate: number };
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface FixUsageRecord {
  rule_id: string;
  fix_type: string;
  success: boolean;
  file?: string | undefined;
  line?: number | undefined;
}

export class TypeFixHandlers {

  /**
   * Get fix suggestions for TypeScript error code
   * Tasks 2.3 + 2.6 combined
   */
  async typeFix(errorCode: number, errorMessage?: string): Promise<ToolResult> {
    try {
      // Find rule by error code
      const index = JSON.parse(readFileSync(INDEX_FILE, 'utf-8'));
      const rule = index.rules.find((r: { tsCode: number }) => r.tsCode === errorCode);

      if (!rule) {
        return {
          success: false,
          error: `No rule found for error code ${errorCode}`,
        };
      }

      // Read rule file
      const ruleFile = join(RULES_DIR, rule.file);
      const ruleContent = readFileSync(ruleFile, 'utf-8');

      // Parse fixes and stats from rule content
      const fixes = this.parseFixes(ruleContent);
      const stats = this.getStatsForRule(rule.id);

      // Prioritize fixes by success rate (task 2.6)
      const prioritizedFixes = this.prioritizeFixes(fixes, stats);

      return {
        success: true,
        data: {
          errorCode,
          ruleId: rule.id,
          brief: rule.brief,
          ruleContent,
          fixes: prioritizedFixes,
          stats,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `Error reading rule: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Record fix usage for self-evolving statistics (task 2.4)
   */
  async recordFix(record: FixUsageRecord): Promise<ToolResult> {
    try {
      const stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));

      // Add new record
      stats.records.push({
        timestamp: new Date().toISOString(),
        ...record,
      });

      // Update summary
      const ruleKey = record.rule_id;
      if (!stats.summary[ruleKey]) {
        stats.summary[ruleKey] = {
          totalHits: 0,
          fixDistribution: {},
          successRate: {},
        };
      }

      stats.summary[ruleKey].totalHits++;
      stats.summary[ruleKey].fixDistribution[record.fix_type] =
        (stats.summary[ruleKey].fixDistribution[record.fix_type] || 0) + 1;

      if (record.success) {
        stats.summary[ruleKey].successRate[record.fix_type] =
          (stats.summary[ruleKey].successRate[record.fix_type] || 0) + 1;
      }

      // Write back
      writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));

      return {
        success: true,
        data: {
          recorded: true,
          summary: stats.summary[ruleKey],
          suggestion: 'Statistics updated. Next query will prioritize successful fixes.',
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `Error recording fix: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Get list of covered rules (task 2.5)
   */
  async typeFixList(): Promise<ToolResult> {
    try {
      const index = JSON.parse(readFileSync(INDEX_FILE, 'utf-8'));

      return {
        success: true,
        data: {
          rules: index.rules.map((r: { tsCode: number; id: string; brief: string }) => ({
            errorCode: r.tsCode,
            ruleId: r.id,
            brief: r.brief,
          })),
          total: index.rules.length,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `Error reading index: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Parse fix suggestions from rule Markdown content
   */
  private parseFixes(content: string): FixSuggestion[] {
    const fixes: FixSuggestion[] = [];

    // Extract fix sections (### Fix N: ...)
    const fixRegex = /### Fix (\d+): ([^\n]+)\n```typescript\n\/\/ Before\n([^\n]+)\n\n\/\/ After\n([^\n]+)\n```\n\*\*When to use:\*\* ([^\n]+)/g;

    let match;
    while ((match = fixRegex.exec(content)) !== null) {
      const description = match[2] ?? '';
      const afterCode = match[4] ?? '';
      const whenToUse = match[5] ?? '';

      fixes.push({
        type: this.extractFixType(description),
        description,
        code: afterCode.trim(),
        whenToUse,
      });
    }

    return fixes;
  }

  /**
   * Extract fix type from description
   */
  private extractFixType(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes('default')) return 'default-value';
    if (lower.includes('assertion') || lower.includes('!')) return 'non-null-assert';
    if (lower.includes('conditional') || lower.includes('check')) return 'condition-check';
    if (lower.includes('guard') || lower.includes('function')) return 'type-guard';
    return 'other';
  }

  /**
   * Get stats for a specific rule
   */
  private getStatsForRule(ruleId: string): { totalHits: number; fixDistribution: Record<string, number>; successRate: Record<string, number> } {
    try {
      const stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));
      return stats.summary[ruleId] || { totalHits: 0, fixDistribution: {}, successRate: {} };
    } catch {
      return { totalHits: 0, fixDistribution: {}, successRate: {} };
    }
  }

  /**
   * Prioritize fixes by success rate (task 2.6)
   * priority = successRate * 0.7 + (usageCount / totalHits) * 0.3
   */
  private prioritizeFixes(fixes: FixSuggestion[], stats: { totalHits: number; fixDistribution: Record<string, number>; successRate: Record<string, number> }): FixSuggestion[] {
    if (!stats || stats.totalHits === 0) {
      // No stats yet, use default order (default-value first as recommended)
      return fixes;
    }

    return fixes.map(fix => {
      const usageCount = stats.fixDistribution[fix.type] || 0;
      const successCount = stats.successRate[fix.type] || 0;
      const successRate = usageCount > 0 ? successCount / usageCount : 0;

      return {
        ...fix,
        priority: successRate * 0.7 + (usageCount / stats.totalHits) * 0.3,
        stats: { usageCount, successRate },
      };
    }).sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
}

/**
 * Create TypeFixHandlers instance
 */
export function createTypeFixHandlers(): TypeFixHandlers {
  return new TypeFixHandlers();
}