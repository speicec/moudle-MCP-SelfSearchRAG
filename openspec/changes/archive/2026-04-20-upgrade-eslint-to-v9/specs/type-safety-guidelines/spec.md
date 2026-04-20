## MODIFIED Requirements

### Requirement: ESLint configuration uses flat config format

The project SHALL use ESLint 9 flat config format (`eslint.config.js`) for all linting configuration.

#### Scenario: Flat config file exists
- **WHEN** running ESLint
- **THEN** the configuration SHALL be loaded from `eslint.config.js` using flat config array format

#### Scenario: Custom rules registered in plugins
- **WHEN** flat config defines custom rules
- **THEN** rules SHALL be registered in `plugins` object with `rules` property

#### Scenario: TypeScript parser configured
- **WHEN** linting TypeScript files
- **THEN** `typescript-eslint` config SHALL be applied with `project: './tsconfig.json'` in parserOptions

### Requirement: ESLint dependencies are up-to-date

The project SHALL use ESLint 9.x and typescript-eslint 8.x for linting.

#### Scenario: Package versions
- **WHEN** checking dependencies
- **THEN** `eslint` SHALL be version 9.x or higher
- **THEN** `typescript-eslint` SHALL be version 8.x or higher

#### Scenario: No legacy packages
- **WHEN** checking dependencies
- **THEN** `@typescript-eslint/eslint-plugin` SHALL NOT be present (replaced by `typescript-eslint`)
- **THEN** `@typescript-eslint/parser` SHALL NOT be present (replaced by `typescript-eslint`)