/**
 * MCP Tools for TypeScript type fix suggestions
 *
 * Self-evolving type fix system with:
 * - type_fix: Get fix suggestions for TypeScript errors (with pattern recognition)
 * - type_fix_batch: Batch fix for all occurrences of same pattern
 * - record_fix: Record fix usage for statistics (with pattern signature)
 * - type_fix_list: Get list of covered rules
 */

export const TYPE_FIX_TOOLS = {
  type_fix: {
    name: 'type_fix',
    description: `
Get fix suggestions for TypeScript type errors.

WHEN TO CALL:
- TypeScript error code appears (2322, 2353, 2532, etc.)
- Type mismatch messages ("Type X is not assignable to type Y")
- Null/undefined assignment errors

FEATURES:
- Pattern recognition: identifies error pattern (e.g., "return-null-in-async")
- Batch fix support: can fix all occurrences of same pattern
- Statistics-based recommendation: prioritizes fixes with high success rate

RETURNS:
- Pattern signature (for matching similar errors)
- List of all occurrences in current lint output
- Fix suggestions sorted by priority (success rate)
- Recommended fix based on historical success
- Batch fix availability indicator

COVERED RULES:
- 2322: null-assignment (string|null → string, return null in async)
- More rules can be added in eslint-type-fixes/rules/
`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        error_code: {
          type: 'number',
          description: 'TypeScript error code (e.g., 2322)',
        },
        error_message: {
          type: 'string',
          description: 'The error message text (optional, for pattern matching)',
        },
        lint_output: {
          type: 'string',
          description: 'Full lint output from hook (optional, for batch analysis)',
        },
      },
      required: ['error_code'],
    },
  },

  type_fix_batch: {
    name: 'type_fix_batch',
    description: `
Get batch fix suggestions for all occurrences of the same error pattern.

WHEN TO CALL:
- After type_fix shows multiple occurrences
- Want to fix all similar errors at once

RETURNS:
- List of all files/lines affected
- Unified fix pattern that applies to all
- Fix command or code snippet for batch application
`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        error_code: {
          type: 'number',
          description: 'TypeScript error code',
        },
        pattern: {
          type: 'string',
          description: 'Error pattern identified from type_fix (e.g., "return-null-in-async")',
        },
        fix_type: {
          type: 'string',
          description: 'Fix type to apply (e.g., "return-promise-resolve")',
        },
      },
      required: ['error_code', 'pattern'],
    },
  },

  record_fix: {
    name: 'record_fix',
    description: `
Record fix usage for self-evolving statistics.
Call this after applying a fix to update the knowledge base.

REQUIRED: rule_id, fix_type, success

ENHANCED FEATURES:
- pattern: Record the error pattern for future matching
- pattern_signature: Error message signature for auto-detection
- fix_count: Number of fixes applied (for batch fixes)
- files_fixed: List of files that were fixed

EFFECT: Updates usage-log.json for priority ranking.
Next queries will prioritize successful fixes with matching patterns.
`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        rule_id: {
          type: 'string',
          description: 'The rule ID (e.g., "null-assignment")',
        },
        fix_type: {
          type: 'string',
          description: 'The fix type applied (e.g., "return-promise-resolve", "default-value")',
        },
        success: {
          type: 'boolean',
          description: 'Whether the fix was successful',
        },
        pattern: {
          type: 'string',
          description: 'Error pattern identified (e.g., "return-null-in-async")',
        },
        pattern_signature: {
          type: 'string',
          description: 'Error message signature for matching (e.g., "Type \'null\' is not assignable to type \'Promise<...| null>\'")',
        },
        fix_count: {
          type: 'number',
          description: 'Number of fixes applied (for batch fixes)',
        },
        files_fixed: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of files that were fixed',
        },
        file: {
          type: 'string',
          description: 'The file path (optional, for single fix)',
        },
        line: {
          type: 'number',
          description: 'The line number (optional)',
        },
      },
      required: ['rule_id', 'fix_type', 'success'],
    },
  },

  type_fix_list: {
    name: 'type_fix_list',
    description: `
Get list of all covered TypeScript error codes and rules.

RETURNS: Array of { errorCode, ruleId, brief, patterns }
`,
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
};

/**
 * Get tool list for MCP registration
 */
export function getTypeFixToolList() {
  return Object.values(TYPE_FIX_TOOLS).map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}