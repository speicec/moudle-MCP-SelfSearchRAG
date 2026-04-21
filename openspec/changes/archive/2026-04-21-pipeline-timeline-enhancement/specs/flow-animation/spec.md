## ADDED Requirements

### Requirement: Flow animation displays between connected stages
The system SHALL display animated flow lines between adjacent stage cards to indicate processing flow direction.

#### Scenario: Flow animation on running stage
- **WHEN** a stage is actively running
- **THEN** system displays animated particle flow from current stage to next stage

#### Scenario: Flow animation on completed stage
- **WHEN** a stage is completed
- **THEN** system displays static completed line (no animation) to next stage

#### Scenario: Flow animation on pending stage
- **WHEN** current stage is before a pending stage
- **THEN** system displays muted line without animation

#### Scenario: No flow animation between disconnected stages
- **WHEN** stages are in error state
- **THEN** system displays error-colored line without animation

### Requirement: Flow animation uses gradient particle effect
The system SHALL render flow animation using gradient particle moving along connection line.

#### Scenario: Particle gradient direction
- **WHEN** flow animation is active
- **THEN** particle gradient flows from transparent to primary color to transparent

#### Scenario: Particle animation loop
- **WHEN** stage remains running
- **THEN** particle animation loops infinitely with smooth transition

#### Scenario: Animation speed
- **WHEN** flow animation is displayed
- **THEN** particle completes one cycle in approximately 1.5 seconds

### Requirement: Flow animation respects theme colors
The system SHALL use semantic color tokens for flow animation instead of hardcoded colors.

#### Scenario: Light theme flow animation
- **WHEN** light theme is active and flow animation is running
- **THEN** particle uses primary color token

#### Scenario: Dark theme flow animation
- **WHEN** dark theme is active and flow animation is running
- **THEN** particle uses primary color token adapted for dark mode

#### Scenario: Completed flow line color
- **WHEN** stage is completed and connection line is static
- **THEN** line uses confidence-high (green) color token

### Requirement: Flow animation positioned correctly
The system SHALL position flow animation line between stage cards regardless of card height differences.

#### Scenario: Flow line horizontal position
- **WHEN** stage cards are in grid layout
- **THEN** flow line connects horizontally between adjacent card centers

#### Scenario: Flow line with expanded logs
- **WHEN** stage card expands to show logs
- **THEN** flow line remains positioned at card top area (not affected by card height)

#### Scenario: Flow line responsive layout
- **WHEN** viewport changes to smaller screens with different grid columns
- **THEN** flow lines adjust to connect adjacent cards in new layout