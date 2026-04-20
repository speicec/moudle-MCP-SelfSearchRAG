/**
 * Custom ESLint rules index
 * Exports rules for use in .eslintrc.cjs
 */

// Note: This file is JavaScript because ESLint config is CommonJS
// The actual rule implementation is in no-nullable-assignment.ts
// After building, use: require('./dist/eslint-rules/no-nullable-assignment')

module.exports = {
  rules: {
    'no-nullable-assignment': {
      // Placeholder - actual implementation loaded after build
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow nullable type assignment without handling',
        },
        messages: {
          nullableAssignment: 'Type error detected. 💡 Fix: type_fix(2322)',
        },
        schema: [],
      },
      create(context) {
        // Simplified implementation for CommonJS
        // Full TypeScript implementation requires parserServices
        return {
          // This placeholder will be replaced by compiled TS rule
        };
      },
    },
  },
};