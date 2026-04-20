/**
 * MCP Tools for TypeScript type fix suggestions
 *
 * Self-evolving type fix system with:
 * - type_fix: Get fix suggestions for TypeScript errors
 * - record_fix: Record fix usage for statistics
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

RETURNS:
- Rule explanation
- Fix suggestions sorted by priority (success rate)
- Code examples for each fix

COVERED RULES:
- 2322: null-assignment (string|null → string)
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
          description: 'The error message text (optional, for context)',
        },
      },
      required: ['error_code'],
    },
  },

  record_fix: {
    name: 'record_fix',
    description: `
Record fix usage for self-evolving statistics.
Call this after applying a fix to update the knowledge base.

REQUIRED: rule_id, fix_type, success

EFFECT: Updates usage-log.json for priority ranking.
Next queries will prioritize successful fixes.
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
          description: 'The fix type applied (e.g., "default-value", "non-null-assert")',
        },
        success: {
          type: 'boolean',
          description: 'Whether the fix was successful',
        },
        file: {
          type: 'string',
          description: 'The file path (optional)',
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

RETURNS: Array of { errorCode, ruleId, brief }
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