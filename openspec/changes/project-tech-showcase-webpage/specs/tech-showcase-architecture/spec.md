## ADDED Requirements

### Requirement: Architecture diagram displays system flow
The system SHALL render an SVG architecture diagram showing the document processing and retrieval pipeline.

#### Scenario: Diagram renders pipeline stages
- **WHEN** user views the TechShowcase page
- **THEN** system displays SVG diagram with stages: PDF → Parse → Chunk → Embed → Store → Retrieve → Generate → Answer
- **AND** stages are connected by animated flow lines

#### Scenario: Diagram shows stage components
- **WHEN** diagram renders
- **THEN** each stage node displays its key component (e.g., "OCR + VLM" under Parse)
- **AND** components are styled as sub-labels within nodes

#### Scenario: Diagram flow animation
- **WHEN** page loads
- **THEN** flow lines animate from left to right indicating data direction
- **AND** animation loops continuously with configurable speed

### Requirement: Architecture node supports click interaction
The system SHALL allow users to click nodes to view detailed design documentation.

#### Scenario: Node click opens design detail
- **WHEN** user clicks a pipeline stage node
- **THEN** system opens a side panel with design documentation for that stage
- **AND** panel includes links to relevant specs and design files

#### Scenario: Node highlight on hover
- **WHEN** user hovers over a stage node
- **THEN** system highlights the node with accent color
- **AND** connected flow lines are emphasized

### Requirement: Architecture diagram supports zoom and pan
The system SHALL allow users to zoom and pan the architecture diagram.

#### Scenario: Diagram zoom controls
- **WHEN** user clicks zoom in/out buttons
- **THEN** system scales the SVG diagram proportionally
- **AND** zoom range is limited (50% to 200%)

#### Scenario: Diagram pan on drag
- **WHEN** user drags on the diagram canvas
- **THEN** system pans the diagram view
- **AND** pan respects diagram boundaries

### Requirement: Architecture diagram is responsive
The system SHALL adapt diagram size for different viewports.

#### Scenario: Full-width diagram on desktop
- **WHEN** viewport width >= 1024px
- **THEN** system displays full diagram with all details visible
- **AND** diagram height is 400px

#### Scenario: Compact diagram on mobile
- **WHEN** viewport width < 768px
- **THEN** system displays simplified diagram with stage labels only
- **AND** component sub-labels are hidden