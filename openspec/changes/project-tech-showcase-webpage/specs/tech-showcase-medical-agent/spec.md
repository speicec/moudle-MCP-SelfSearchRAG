## ADDED Requirements

### Requirement: Medical Agent section displays ReAct cycle
The system SHALL render the Medical Agent ReAct cycle visualization showing the reasoning loop.

#### Scenario: ReAct cycle renders five stages
- **WHEN** user views the Medical Agent section
- **THEN** system displays circular flow diagram with stages: Think → Act → Observe → Decide → Answer
- **AND** stages are connected with directional arrows

#### Scenario: ReAct stage shows component details
- **WHEN** ReAct cycle renders
- **THEN** each stage displays its function (e.g., Think shows "实体识别", Act shows "检索执行")
- **AND** functions are displayed as inner labels

#### Scenario: ReAct cycle animation
- **WHEN** page loads
- **THEN** cycle highlights stages in sequence following the loop direction
- **AND** animation loops with configurable delay between stages

### Requirement: Safety Layer visualization displays three layers
The system SHALL render the Safety Layer architecture showing three protection mechanisms.

#### Scenario: Safety Layer renders three components
- **WHEN** user views the Medical Agent section
- **THEN** system displays three-layer diagram: Threshold Extraction → Safety Pre-Check → Three-Layer Answer
- **AND** layers are stacked vertically with connection arrows

#### Scenario: Layer shows detailed functions
- **WHEN** Safety Layer renders
- **THEN** each layer displays its functions (e.g., Safety Pre-Check shows "禁忌检查, 药物相互作用")
- **AND** functions are listed as bullet points

#### Scenario: Layer click expands spec detail
- **WHEN** user clicks a Safety Layer component
- **THEN** system opens modal with safety-layer spec content
- **AND** modal includes scenario coverage table

### Requirement: Medical Agent section shows entity recognition examples
The system SHALL display medical entity recognition examples for demonstration.

#### Scenario: Entity examples render as cards
- **WHEN** user views the Medical Agent section
- **THEN** system displays example cards showing entity recognition results
- **AND** cards show query text and recognized entities (disease, drug, indicator)

#### Scenario: Entity card interactive highlight
- **WHEN** user hovers over an entity in the card
- **THEN** system highlights the entity type and matched term
- **AND** displays entity metadata (canonical name, aliases)

### Requirement: Medical Agent section is collapsible
The system SHALL allow users to collapse/expand the Medical Agent section.

#### Scenario: Section collapse toggle
- **WHEN** user clicks collapse button
- **THEN** system minimizes section to summary view
- **AND** summary shows only ReAct cycle icon and spec count

#### Scenario: Section expand restores full view
- **WHEN** user clicks expand button on collapsed section
- **THEN** system restores full Medical Agent visualization
- **AND** animation smoothly expands section