## ADDED Requirements

### Requirement: Optional properties must explicitly include undefined
Interface optional properties SHALL be defined with explicit `| undefined` type union when the property may receive an explicit `undefined` value.

#### Scenario: Optional property with undefined assignment
- **WHEN** interface defines optional property that can be explicitly set to undefined
- **THEN** property type SHALL include `| undefined` in its type definition

### Requirement: Array index access must handle undefined
Code accessing array elements by index SHALL handle the possibility of `undefined` when `noUncheckedIndexedAccess` is enabled.

#### Scenario: Array element access with check
- **WHEN** accessing array element by index
- **THEN** code SHALL either check for undefined or use non-null assertion only when existence is guaranteed

### Requirement: Import exports must not have naming conflicts
Module exports SHALL not have duplicate names when re-exporting from multiple modules.

#### Scenario: Multiple module re-export
- **WHEN** re-exporting from multiple modules
- **THEN** explicitly select which export to use to avoid name conflicts

### Requirement: Abstract classes must not be instantiated directly
Abstract classes SHALL NOT be instantiated using `new`; concrete implementations SHALL be used instead.

#### Scenario: Abstract class usage
- **WHEN** needing to use abstract class functionality
- **THEN** create a concrete subclass or use an existing concrete implementation

### Requirement: Type imports must be consistent
Type imports using `import type` SHALL NOT be used as values in runtime code.

#### Scenario: Type-only import usage
- **WHEN** importing a type for type annotations only
- **THEN** use `import type` syntax; for runtime values, use regular `import`

### Requirement: Async functions must contain await properly
`await` expressions SHALL only be used within async functions or at module top level.

#### Scenario: Async function definition
- **WHEN** using await expression
- **THEN** ensure containing function is declared async

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