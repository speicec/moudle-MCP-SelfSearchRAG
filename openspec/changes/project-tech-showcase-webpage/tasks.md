## 1. Setup & Data Preparation

- [ ] 1.1 Add framer-motion dependency to frontend package.json
- [ ] 1.2 Create frontend/src/pages/TechShowcase.tsx page component
- [ ] 1.3 Create frontend/src/components/showcase/ directory structure
- [ ] 1.4 Build static data generator script to read openspec directories
- [ ] 1.5 Generate frontend/src/data/showcase-data.json with specs and changes data
- [ ] 1.6 Add /tech-showcase route to frontend router

## 2. Timeline Component

- [ ] 2.1 Create Timeline.tsx component with Framer Motion
- [ ] 2.2 Implement timeline markers with date labels and change counts
- [ ] 2.3 Add horizontal scroll/drag navigation support
- [ ] 2.4 Implement entrance animation (left-to-right marker reveal)
- [ ] 2.5 Create TimelineDetailPanel.tsx for change list expansion
- [ ] 2.6 Add panel expand/collapse animation with spring physics
- [ ] 2.7 Integrate Timeline component into TechShowcase page

## 3. Tech Capability Matrix Component

- [ ] 3.1 Create Matrix.tsx component with five domain cards
- [ ] 3.2 Implement responsive grid layout (5-col → 2-col → 1-col)
- [ ] 3.3 Add domain icons and titles for each card
- [ ] 3.4 Create hover tooltip showing spec names list
- [ ] 3.5 Implement SpecDetailModal.tsx for spec content display
- [ ] 3.6 Add spec metadata display (capability, version, created)
- [ ] 3.7 Integrate Matrix component into TechShowcase page

## 4. Architecture Diagram Component

- [ ] 4.1 Create ArchitectureDiagram.tsx with SVG rendering
- [ ] 4.2 Implement pipeline nodes: PDF → Parse → Chunk → Embed → Store → Retrieve → Generate → Answer
- [ ] 4.3 Add animated flow lines with continuous loop
- [ ] 4.4 Implement node hover highlight and connection emphasis
- [ ] 4.5 Create ArchitectureDetailPanel.tsx for stage details
- [ ] 4.6 Add zoom and pan controls for diagram navigation
- [ ] 4.7 Implement responsive diagram (full → compact on mobile)
- [ ] 4.8 Integrate Architecture component into TechShowcase page

## 5. Medical Agent Visualization Component

- [ ] 5.1 Create MedicalAgentSection.tsx container component
- [ ] 5.2 Implement ReActCycleDiagram.tsx with circular flow (Think → Act → Observe → Decide → Answer)
- [ ] 5.3 Add stage animation highlighting in sequence
- [ ] 5.4 Implement SafetyLayerDiagram.tsx with three-layer stack
- [ ] 5.5 Add layer click to open safety-layer spec modal
- [ ] 5.6 Create EntityExampleCards.tsx for entity recognition demo
- [ ] 5.7 Implement section collapse/expand toggle
- [ ] 5.8 Integrate MedicalAgentSection into TechShowcase page

## 6. Decisions Table Component

- [ ] 6.1 Create DecisionsTable.tsx with comparison table layout
- [ ] 6.2 Implement decision rows with requirement, options, choice, reason
- [ ] 6.3 Add highlight styling for selected choice column
- [ ] 6.4 Implement row expand/collapse for detailed rationale
- [ ] 6.5 Add category filter dropdown (文档处理, 检索策略, 生成服务, 工程化)
- [ ] 6.6 Implement responsive layout (table → cards on mobile)
- [ ] 6.7 Integrate DecisionsTable into TechShowcase page

## 7. Integration & Polish

- [ ] 7.1 Add Hero section header with project title and description
- [ ] 7.2 Implement page entrance animation orchestration
- [ ] 7.3 Add section navigation with scroll-to-anchor links
- [ ] 7.4 Ensure all animations respect will-change CSS optimization
- [ ] 7.5 Test responsive breakpoints (desktop, tablet, mobile)
- [ ] 7.6 Verify all modals and panels work correctly
- [ ] 7.7 Add accessibility attributes (aria-labels, keyboard navigation)
- [ ] 7.8 Run build and verify production bundle size