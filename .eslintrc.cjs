const noNullableAssignment = require('./eslint-rules/no-nullable-assignment');

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json', // Required for type-aware rules
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'off',
    // Custom type-safety rule with MCP Tool hint
    'type-safety/no-nullable-assignment': 'error',
  },
  ignorePatterns: ['dist', 'node_modules', '*.test.ts', 'eslint-rules/*.ts'],
};