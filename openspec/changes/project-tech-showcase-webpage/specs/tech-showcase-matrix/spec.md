## ADDED Requirements

### Requirement: Tech capability matrix displays specs by domain
The system SHALL render a matrix grid showing all specs organized by technical domain.

#### Scenario: Matrix renders five domain categories
- **WHEN** user views the TechShowcase page
- **THEN** system displays five domain cards: Document Processing, Retrieval Strategy, Generation Service, Medical Agent, Frontend UI
- **AND** each card shows the spec count for that domain

#### Scenario: Matrix card displays domain icon and title
- **WHEN** matrix renders
- **THEN** each domain card has a distinct icon (emoji or SVG)
- **AND** card title is displayed in primary font

#### Scenario: Matrix card shows spec names on hover
- **WHEN** user hovers over a domain card
- **THEN** system displays a tooltip or panel listing all spec names in that domain
- **AND** spec names are clickable to view details

### Requirement: Matrix card supports spec detail expansion
The system SHALL allow users to view detailed spec content from matrix cards.

#### Scenario: Spec name click opens detail modal
- **WHEN** user clicks a spec name in the expanded panel
- **THEN** system opens a modal displaying the full spec content
- **AND** modal includes spec metadata (capability, version, created date)

#### Scenario: Modal close returns to matrix
- **WHEN** user closes the spec detail modal
- **THEN** system returns focus to the matrix card
- **AND** expanded panel remains visible

### Requirement: Matrix uses responsive grid layout
The system SHALL adapt matrix layout for different screen sizes.

#### Scenario: Desktop five-column layout
- **WHEN** viewport width >= 1024px
- **THEN** system displays five cards in a single row
- **AND** cards are equally sized

#### Scenario: Tablet two-column layout
- **WHEN** viewport width between 768px and 1023px
- **THEN** system displays cards in two rows (3 cards + 2 cards)
- **AND** cards maintain aspect ratio

#### Scenario: Mobile single-column layout
- **WHEN** viewport width < 768px
- **THEN** system displays cards in a vertical stack
- **AND** cards are full-width