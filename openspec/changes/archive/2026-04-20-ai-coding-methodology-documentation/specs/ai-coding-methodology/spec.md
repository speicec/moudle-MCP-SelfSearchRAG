## ADDED Requirements

### Requirement: Methodology documentation provides complete workflow guide
The methodology documentation SHALL provide a complete guide for the four-phase workflow (Explore, Propose, Apply, Archive).

#### Scenario: Workflow phases documented
- **WHEN** user reads workflow-phases.md
- **THEN** user understands each phase's purpose, activities, and expected outputs

#### Scenario: Phase transitions clear
- **WHEN** user completes one phase
- **THEN** documentation clearly indicates what triggers the next phase and what artifacts are needed

### Requirement: Methodology documentation provides artifact templates
The methodology documentation SHALL provide ready-to-use templates for all core artifacts (proposal, design, specs, tasks).

#### Scenario: Proposal template available
- **WHEN** user needs to create a proposal
- **THEN** artifact-templates.md contains a fillable proposal template with section guidance

#### Scenario: Design template available
- **WHEN** user needs to create a design document
- **THEN** artifact-templates.md contains a fillable design template with decision documentation format

#### Scenario: Tasks template available
- **WHEN** user needs to create a task list
- **THEN** artifact-templates.md contains a checkbox-format task template

### Requirement: Methodology documentation defines coding traits
The methodology documentation SHALL define five coding traits with specific AI behavior specifications.

#### Scenario: All five traits documented
- **WHEN** user reads coding-traits.md
- **THEN** documentation covers: Test-First, Active-Testing, Follow-Conventions, Honest-Inquiry, Careful-Refactor

#### Scenario: Traits have behavior examples
- **WHEN** user reads a trait definition
- **THEN** trait includes concrete AI behavior examples for implementation

#### Scenario: Traits are enforceable
- **WHEN** AI agent operates under the methodology
- **THEN** each trait can be verified through observable AI actions

### Requirement: Methodology documentation provides Agent template
The methodology documentation SHALL provide a complete Agent.md template that can be copied to other projects.

#### Scenario: Template is self-contained
- **WHEN** user copies agent-template.md content
- **THEN** template contains all necessary sections without requiring project-specific edits

#### Scenario: Template固化 coding traits
- **WHEN** Agent template is applied
- **THEN** all five coding traits are encoded in the template's behavior guidelines

#### Scenario: Template固化 workflow
- **WHEN** Agent template is applied
- **THEN** four-phase workflow is encoded in the template's process guidelines

### Requirement: Methodology documentation explains decision documentation
The methodology documentation SHALL explain the decision documentation format (Choice + Rationale + Alternatives).

#### Scenario: Decision format explained
- **WHEN** user reads decision-documentation.md
- **THEN** user understands how to document technical decisions with alternatives considered

#### Scenario: Decision examples provided
- **WHEN** user needs to document a decision
- **THEN** documentation provides real decision examples from project history

### Requirement: Methodology documentation explains task granularity
The methodology documentation SHALL explain principles for atomic task decomposition.

#### Scenario: Atomic task principles
- **WHEN** user reads task-granularity.md
- **THEN** user understands how to break tasks into single-file, single-function, verifiable units

#### Scenario: Task verification explained
- **WHEN** user creates a task
- **THEN** documentation explains how to make tasks verifiable (testable, observable)

### Requirement: Methodology documentation is accessible
The methodology documentation SHALL be organized for easy navigation and quick reference.

#### Scenario: README provides overview
- **WHEN** user opens docs/ai-coding-methodology/
- **THEN** README.md provides quick overview with links to all sub-documents

#### Scenario: Cross-linking between documents
- **WHEN** user reads one document
- **THEN** related concepts are linked to other relevant documents

#### Scenario: Quick start available
- **WHEN** new user wants to adopt methodology
- **THEN** README provides a quick-start section with minimal steps

### Requirement: Methodology documentation is portable
The methodology documentation SHALL be usable independently of this project's specific code.

#### Scenario: No code dependencies
- **WHEN** user copies methodology to another project
- **THEN** no references to specific code files in this project are required

#### Scenario: Generic examples
- **WHEN** examples are provided
- **THEN** examples use generic patterns applicable to any project type