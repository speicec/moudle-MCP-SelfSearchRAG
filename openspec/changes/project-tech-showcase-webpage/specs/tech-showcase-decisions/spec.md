## ADDED Requirements

### Requirement: Decisions table displays technical choices
The system SHALL render a comparison table showing key technical decisions and alternatives.

#### Scenario: Table renders decision rows
- **WHEN** user views the TechShowcase page
- **THEN** system displays table with rows for: PDF切分, 检索策略, OCR引擎, VLM服务, LLM服务, 嵌入模型, 向量存储
- **AND** each row shows requirement, option A, option B, selected choice, and reason

#### Scenario: Table highlights selected option
- **WHEN** table renders
- **THEN** selected choice column is highlighted with accent background
- **AND** checkmark icon indicates the selection

#### Scenario: Table shows reasoning
- **WHEN** user reads a decision row
- **THEN** reason column explains why the choice was made
- **AND** reason is concise (one sentence)

### Requirement: Decisions table supports expandable details
The system SHALL allow users to expand rows for detailed decision rationale.

#### Scenario: Row expand shows design reference
- **WHEN** user clicks expand icon on a row
- **THEN** system expands row showing link to relevant design document
- **AND** expansion displays additional context about alternatives considered

#### Scenario: Row collapse restores compact view
- **WHEN** user clicks collapse icon on expanded row
- **THEN** system collapses row to single-line view
- **AND** animation smoothly collapses expansion

### Requirement: Decisions table is filterable
The system SHALL allow users to filter decisions by category.

#### Scenario: Category filter dropdown
- **WHEN** user clicks category filter
- **THEN** system shows dropdown with categories: 文档处理, 检索策略, 生成服务, 工程化
- **AND** selecting category shows only relevant decisions

#### Scenario: Clear filter shows all decisions
- **WHEN** user clears category filter
- **THEN** system displays all decision rows
- **AND** filter indicator shows "全部"

### Requirement: Decisions table is responsive
The system SHALL adapt table layout for different screen sizes.

#### Scenario: Desktop full-width table
- **WHEN** viewport width >= 1024px
- **THEN** system displays all columns visible
- **AND** columns are equally distributed

#### Scenario: Mobile card layout
- **WHEN** viewport width < 768px
- **THEN** system transforms table into vertical card list
- **AND** each card shows one decision with stacked fields