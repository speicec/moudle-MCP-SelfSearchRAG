## 1. Setup & Data Preparation

- [ ] 1.1 Add framer-motion and gsap dependencies to frontend package.json
- [ ] 1.2 Create frontend/src/pages/TechShowcase.tsx page component
- [ ] 1.3 Create frontend/src/components/showcase/ directory structure
- [ ] 1.4 Build static data generator script to read openspec directories
- [ ] 1.5 Generate frontend/src/data/showcase-data.json with specs and changes data
- [ ] 1.6 Add /tech-showcase route to frontend router

## 2. Hero Section

- [ ] 2.1 Create HeroSection.tsx component
- [ ] 2.2 Implement Logo SVG with Framer Motion scale entrance animation
- [ ] 2.3 Add core slogan text animation (GSAP SplitText style)
- [ ] 2.4 Implement tech stack badges stagger entrance animation
- [ ] 2.5 Add ScrollTrigger "Scroll to explore" hint animation
- [ ] 2.6 Configure GSAP ScrollTrigger for Hero section fade-out on scroll

## 3. Medical Agent Section - ReAct Cycle

- [ ] 3.1 Create MedicalAgentSection.tsx container component
- [ ] 3.2 Create ReActCycleDiagram.tsx with SVG circular layout (Think→Act→Observe→Decide→Answer)
- [ ] 3.3 Implement flowing particle animation on connection lines (CSS Keyframes)
- [ ] 3.4 Add current stage highlight animation (scale + glow effect)
- [ ] 3.5 Implement 2-second interval stage cycling animation
- [ ] 3.6 Add hover tooltip for each stage showing detailed explanation
- [ ] 3.7 Create stage detail modal on click

## 4. Medical Agent Section - Planning Mode

- [ ] 4.1 Create PlanningDAGDiagram.tsx with grid node layout
- [ ] 4.2 Implement node types: retrieve/evaluate/check/generate with icons
- [ ] 4.3 Add parallel group dashed box with simultaneous execution animation
- [ ] 4.4 Implement dependency connection lines with direction arrows
- [ ] 4.5 Add failure node red warning animation + DAG restructuring animation
- [ ] 4.6 Implement Framer Motion Layout Animation for node entrance
- [ ] 4.7 Add ComplexityJudge → TemplateMatcher → LLM Planning flow demo

## 5. Medical Agent Section - Safety Layer

- [ ] 5.1 Create SafetyLayerDiagram.tsx with three-layer stack layout
- [ ] 5.2 Implement layer styling: Knowledge Layer (blue), Rule Layer (orange), Monitor Layer (green)
- [ ] 5.3 Add dangerous Query animation (red flow blocked at filter)
- [ ] 5.4 Add safe Query animation (green flow passing through)
- [ ] 5.5 Implement layer click to show protection rules detail modal
- [ ] 5.6 Create mode switch toggle (ReAct ↔ Planning) with spring animation

## 6. Retrieval Visualization Section

- [ ] 6.1 Create RetrievalVisualization.tsx container component
- [ ] 6.2 Implement example Query input box with text entrance animation
- [ ] 6.3 Create entity recognition animation (keyword flash → entity label popup)
- [ ] 6.4 Implement entity expansion animation (alias mapping display)
- [ ] 6.5 Create query rewrite animation (original → rewritten comparison)
- [ ] 6.6 Implement retrieval execution animation (vector DB icon + result cards entrance)
- [ ] 6.7 Add white-box trace timeline layout with Hover detail display
- [ ] 6.8 Configure ScrollTrigger for sequential animation trigger

## 7. Timeline Component

- [ ] 7.1 Create TimelineSection.tsx component with GSAP ScrollTrigger
- [ ] 7.2 Implement horizontal scroll timeline with date markers
- [ ] 7.3 Add ScrollTrigger node entrance animation (left-to-right)
- [ ] 7.4 Create change count badge for each node
- [ ] 7.5 Implement change list expansion panel with Framer Motion spring
- [ ] 7.6 Add change card icons (feat/fix/refactor/chore)
- [ ] 7.7 Configure ScrollTrigger for timeline section

## 8. Tech Capability Matrix Component

- [ ] 8.1 Create TechMatrix.tsx component with five domain cards
- [ ] 8.2 Implement responsive grid layout (5-col → 2-col → 1-col)
- [ ] 8.3 Add domain icons and titles for each card
- [ ] 8.4 Implement stagger entrance animation (Framer Motion)
- [ ] 8.5 Create hover tooltip showing spec names list
- [ ] 8.6 Implement SpecDetailModal.tsx for spec content display
- [ ] 8.7 Add spec metadata display (capability, version, created)
- [ ] 8.8 Configure ScrollTrigger for matrix section

## 9. Architecture Diagram Component

- [ ] 9.1 Create ArchitectureDiagram.tsx with SVG rendering
- [ ] 9.2 Implement pipeline nodes: PDF → Parse → Chunk → Embed → Store → Retrieve → Generate → Answer
- [ ] 9.3 Add animated flow lines with continuous loop
- [ ] 9.4 Implement node hover highlight and connection emphasis
- [ ] 9.5 Create ArchitectureDetailPanel.tsx for stage details
- [ ] 9.6 Add zoom and pan controls for diagram navigation
- [ ] 9.7 Implement responsive diagram (full → compact on mobile)
- [ ] 9.8 Configure ScrollTrigger for architecture section

## 10. Footer Section

- [ ] 10.1 Create FooterSection.tsx component
- [ ] 10.2 Implement tech stack summary table
- [ ] 10.3 Add project links (GitHub, OpenSpec, Medical Agent Guide)
- [ ] 10.4 Add copyright statement
- [ ] 10.5 Implement footer entrance animation

## 11. Integration & Polish

- [ ] 11.1 Add Hero section header with project title and description
- [ ] 11.2 Implement page entrance animation orchestration
- [ ] 11.3 Add section navigation with scroll-to-anchor links
- [ ] 11.4 Ensure all animations respect will-change CSS optimization
- [ ] 11.5 Test responsive breakpoints (desktop, tablet, mobile)
- [ ] 11.6 Verify all modals and panels work correctly
- [ ] 11.7 Add accessibility attributes (aria-labels, keyboard navigation)
- [ ] 11.8 Implement mobile simplified animation mode (remove particle flow)
- [ ] 11.9 Run build and verify production bundle size
- [ ] 11.10 Test GSAP ScrollTrigger on various scroll speeds