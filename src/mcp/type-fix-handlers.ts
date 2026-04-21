/**
 * MCP Tool Handlers for TypeScript type fix suggestions
 * Enhanced with pattern recognition and batch fix support
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
const PATTERNS_FILE = join(RULES_DIR, 'stats', 'patterns.json');

export interface FixSuggestion {
  type: string;
  description: string;
  code: string;
  whenToUse: string;
  priority?: number;
  stats?: { usageCount: number; successRate: number };
  appliesTo?: 'all' | 'case-by-case';
  batchFix?: boolean;
}

export interface PatternInfo {
  pattern: string;
  signature: string;
  description: string;
  recommendedFix: string;
  occurrences?: PatternOccurrence[];
}

export interface PatternOccurrence {
  file: string;
  line: number;
  column: number;
  sourceType: string;
  targetType: string;
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
  pattern?: string;
  pattern_signature?: string;
  fix_count?: number;
  files_fixed?: string[];
  file?: string | undefined;
  line?: number | undefined;
}

/**
 * Pattern signatures for common error patterns
 */
const PATTERN_SIGNATURES: Record<number, PatternInfo[]> = {
  2322: [
    {
      pattern: 'return-null-in-async',
      signature: "Type 'null' is not assignable to type 'Promise<",
      description: 'Returning null in async function instead of Promise.resolve(null)',
      recommendedFix: 'return-promise-resolve',
    },
    {
      pattern: 'assign-null-to-non-null',
      signature: "Type 'null' is not assignable to type '",
      description: 'Direct null assignment to non-null type',
      recommendedFix: 'default-value',
    },
    {
      pattern: 'nullable-to-non-null',
      signature: "Type '| null' is not assignable to type '",
      description: 'Nullable type assigned to non-null type',
      recommendedFix: 'null-check',
    },
  ],
};

export class TypeFixHandlers {

  /**
   * Get fix suggestions for TypeScript error code
   * Enhanced with pattern recognition
   */
  async typeFix(errorCode: number, errorMessage?: string, lintOutput?: string): Promise<ToolResult> {
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

      // Pattern recognition
      const patternInfo = this.identifyPattern(errorCode, errorMessage);
      const occurrences = lintOutput ? this.parseOccurrences(lintOutput, errorCode) : [];

      // Prioritize fixes by success rate and pattern match
      const prioritizedFixes = this.prioritizeFixes(fixes, stats, patternInfo);

      // Get pattern-based stats
      const patternStats = this.getPatternStats(errorCode, patternInfo?.pattern);

      return {
        success: true,
        data: {
          errorCode,
          ruleId: rule.id,
          brief: rule.brief,
          pattern: patternInfo?.pattern,
          patternDescription: patternInfo?.description,
          occurrences,
          totalOccurrences: occurrences.length,
          ruleContent,
          fixes: prioritizedFixes,
          recommendedFix: patternStats?.recommendedFix || patternInfo?.recommendedFix || prioritizedFixes[0]?.type,
          batchFixAvailable: occurrences.length > 1 && patternInfo?.pattern === 'return-null-in-async',
          stats,
          patternStats,
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
   * Get batch fix suggestions
   */
  async typeFixBatch(errorCode: number, pattern: string, fixType?: string): Promise<ToolResult> {
    try {
      const patternInfo = PATTERN_SIGNATURES[errorCode]?.find(p => p.pattern === pattern);

      if (!patternInfo) {
        return {
          success: false,
          error: `Pattern '${pattern}' not found for error code ${errorCode}`,
        };
      }

      // Get fix details
      const index = JSON.parse(readFileSync(INDEX_FILE, 'utf-8'));
      const rule = index.rules.find((r: { tsCode: number }) => r.tsCode === errorCode);
      const ruleFile = join(RULES_DIR, rule.file);
      const ruleContent = readFileSync(ruleFile, 'utf-8');
      const fixes = this.parseFixes(ruleContent);

      const selectedFix = fixType
        ? fixes.find(f => f.type === fixType)
        : fixes.find(f => f.type === patternInfo.recommendedFix);

      if (!selectedFix) {
        return {
          success: false,
          error: `Fix type '${fixType || patternInfo.recommendedFix}' not found`,
        };
      }

      // Generate batch fix instructions
      const batchInstructions = this.generateBatchFixInstructions(pattern, selectedFix);

      return {
        success: true,
        data: {
          errorCode,
          pattern,
          fixType: selectedFix.type,
          fixDescription: selectedFix.description,
          fixCode: selectedFix.code,
          batchInstructions,
          appliesTo: 'all',
          note: pattern === 'return-null-in-async'
            ? 'This fix applies to all async functions returning null. Change: return null → return Promise.resolve(null)'
            : 'Apply fix to each occurrence individually',
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `Error generating batch fix: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Record fix usage for self-evolving statistics
   * Enhanced with pattern recording
   */
  async recordFix(record: FixUsageRecord): Promise<ToolResult> {
    try {
      const stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));

      // Add new record with pattern info
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
          patterns: {},
        };
      }

      stats.summary[ruleKey].totalHits++;
      stats.summary[ruleKey].fixDistribution[record.fix_type] =
        (stats.summary[ruleKey].fixDistribution[record.fix_type] || 0) + 1;

      if (record.success) {
        stats.summary[ruleKey].successRate[record.fix_type] =
          (stats.summary[ruleKey].successRate[record.fix_type] || 0) + 1;
      }

      // Record pattern info
      if (record.pattern) {
        const patternKey = record.pattern;
        if (!stats.summary[ruleKey].patterns) {
          stats.summary[ruleKey].patterns = {};
        }
        if (!stats.summary[ruleKey].patterns[patternKey]) {
          stats.summary[ruleKey].patterns[patternKey] = {
            hits: 0,
            fixDistribution: {},
            recommendedFix: null,
          };
        }
        stats.summary[ruleKey].patterns[patternKey].hits++;
        stats.summary[ruleKey].patterns[patternKey].fixDistribution[record.fix_type] =
          (stats.summary[ruleKey].patterns[patternKey].fixDistribution[record.fix_type] || 0) + 1;

        // Update recommended fix based on success
        if (record.success && record.fix_count && record.fix_count > 1) {
          stats.summary[ruleKey].patterns[patternKey].recommendedFix = record.fix_type;
        }
      }

      // Write back
      writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));

      // Update patterns file
      this.updatePatternsFile(record);

      return {
        success: true,
        data: {
          recorded: true,
          pattern: record.pattern,
          fixCount: record.fix_count || 1,
          summary: stats.summary[ruleKey],
          suggestion: 'Statistics updated. Next query will prioritize this fix for matching patterns.',
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
   * Get list of covered rules (enhanced with patterns)
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
            patterns: PATTERN_SIGNATURES[r.tsCode]?.map(p => ({
              pattern: p.pattern,
              description: p.description,
              recommendedFix: p.recommendedFix,
            })) || [],
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
   * Identify error pattern from error message
   */
  private identifyPattern(errorCode: number, errorMessage?: string): PatternInfo | null {
    if (!errorMessage) return null;

    const patterns = PATTERN_SIGNATURES[errorCode];
    if (!patterns) return null;

    for (const pattern of patterns) {
      if (errorMessage.includes(pattern.signature)) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Parse occurrences from lint output
   */
  private parseOccurrences(lintOutput: string, errorCode: number): PatternOccurrence[] {
    const occurrences: PatternOccurrence[] = [];
    const lines = lintOutput.split('\n');

    for (const line of lines) {
      // Match file:line:col pattern
      const match = line.match(/^([^:]+):(\d+):(\d+)\s+error/);
      if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined && line.includes('type_fix')) {
        occurrences.push({
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          sourceType: '',
          targetType: '',
        });
      }
    }

    return occurrences;
  }

  /**
   * Get stats for a specific pattern
   */
  private getPatternStats(errorCode: number, pattern?: string): { hits: number; recommendedFix: string | null } | null {
    if (!pattern) return null;

    try {
      const stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));
      const ruleId = `null-assignment`; // For 2322
      return stats.summary[ruleId]?.patterns?.[pattern] || null;
    } catch {
      return null;
    }
  }

  /**
   * Generate batch fix instructions
   */
  private generateBatchFixInstructions(pattern: string, fix: FixSuggestion): string {
    if (pattern === 'return-null-in-async') {
      return `
Batch Fix Instructions:
1. Search for all occurrences: grep -rn "return null" src/
2. For async functions returning Promise<T | null>:
   - Change: return null
   - To: return Promise.resolve(null)
3. Or use non-null assertion if confident: return null!
`;
    }
    return `Apply fix: ${fix.description}\nCode: ${fix.code}`;
  }

  /**
   * Update patterns file with new pattern data
   */
  private updatePatternsFile(record: FixUsageRecord): void {
    try {
      let patternsData: { patterns: Record<string, unknown> } = { patterns: {} };

      if (existsSync(PATTERNS_FILE)) {
        patternsData = JSON.parse(readFileSync(PATTERNS_FILE, 'utf-8'));
      }

      if (record.pattern && record.pattern_signature) {
        patternsData.patterns[record.pattern] = {
          signature: record.pattern_signature,
          recommendedFix: record.fix_type,
          lastUsed: new Date().toISOString(),
          successCount: record.success ? 1 : 0,
        };
      }

      writeFileSync(PATTERNS_FILE, JSON.stringify(patternsData, null, 2));
    } catch {
      // Ignore errors in pattern file update
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
        appliesTo: 'case-by-case',
      });
    }

    // Add pattern-specific fixes for 2322
    fixes.push({
      type: 'return-promise-resolve',
      description: 'Return Promise.resolve(null) in async functions',
      code: 'return Promise.resolve(null);',
      whenToUse: 'Async function returning null instead of Promise',
      appliesTo: 'all',
      batchFix: true,
    });

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
  private getStatsForRule(ruleId: string): { totalHits: number; fixDistribution: Record<string, number>; successRate: Record<string, number>; patterns?: Record<string, unknown> } {
    try {
      const stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));
      return stats.summary[ruleId] || { totalHits: 0, fixDistribution: {}, successRate: {} };
    } catch {
      return { totalHits: 0, fixDistribution: {}, successRate: {} };
    }
  }

  /**
   * Prioritize fixes by success rate and pattern match
   */
  private prioritizeFixes(fixes: FixSuggestion[], stats: { totalHits: number; fixDistribution: Record<string, number>; successRate: Record<string, number>; patterns?: Record<string, unknown> }, patternInfo?: PatternInfo | null): FixSuggestion[] {
    if (!stats || stats.totalHits === 0) {
      // No stats yet, prioritize by pattern match
      if (patternInfo) {
        const patternFix = fixes.find(f => f.type === patternInfo.recommendedFix);
        if (patternFix) {
          return [patternFix, ...fixes.filter(f => f !== patternFix)];
        }
      }
      return fixes;
    }

    return fixes.map(fix => {
      const usageCount = stats.fixDistribution[fix.type] || 0;
      const successCount = stats.successRate[fix.type] || 0;
      const successRate = usageCount > 0 ? successCount / usageCount : 0;

      // Boost priority for pattern-matched fix
      const patternBoost = patternInfo && fix.type === patternInfo.recommendedFix ? 0.2 : 0;

      return {
        ...fix,
        priority: successRate * 0.7 + (usageCount / stats.totalHits) * 0.3 + patternBoost,
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