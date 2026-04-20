import tseslint from 'typescript-eslint';
import noNullableAssignment from './eslint-rules/no-nullable-assignment.ts';

export default tseslint.config(
  tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: {
      'type-safety': {
        rules: {
          'no-nullable-assignment': noNullableAssignment,
        },
      },
    },
    rules: {
      'type-safety/no-nullable-assignment': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.test.ts', 'eslint-rules/*.ts'],
  },
);