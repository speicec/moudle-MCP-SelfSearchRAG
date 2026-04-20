## 1. Setup & Infrastructure

- [x] 1.1 Create feature domain directories (chat/, stats/, chunks/, documents/, common/)
- [x] 1.2 Initialize shadcn/ui configuration with `npx shadcn-ui@latest init`
- [x] 1.3 Add shadcn/ui components (Card, Badge, Collapsible, ScrollArea, Input, Button)
- [x] 1.4 Install required dependencies (class-variance-authority, clsx, tailwind-merge)
- [x] 1.5 Create frontend-design skill directory structure

## 2. ChatWindow Component Extraction

- [x] 2.1 Extract ConfidenceBadge to chat/ConfidenceBadge.tsx
- [x] 2.2 Extract RetrievalStatsPanel to chat/RetrievalStatsPanel.tsx
- [x] 2.3 Extract SourceCard to chat/SourceCard.tsx
- [x] 2.4 Extract StreamingIndicator to chat/StreamingIndicator.tsx
- [x] 2.5 Refactor main ChatWindow component with imported sub-components
- [x] 2.6 Update VisualApp.tsx import path for ChatWindow

## 3. StatsDashboard Component Extraction

- [x] 3.1 Extract PerformanceBadge to stats/PerformanceBadge.tsx
- [x] 3.2 Extract StatCard to stats/StatCard.tsx
- [x] 3.3 Extract QualityDistributionChart to stats/QualityDistributionChart.tsx
- [x] 3.4 Extract StageTimeChart to stats/StageTimeChart.tsx
- [x] 3.5 Refactor main StatsDashboard component with imported sub-components
- [x] 3.6 Update VisualApp.tsx import path for StatsDashboard

## 4. ChunkExplorer Component Extraction

- [x] 4.1 Extract ChunkCard to chunks/ChunkCard.tsx
- [x] 4.2 Extract TreeNode to chunks/TreeNode.tsx
- [x] 4.3 Refactor main ChunkExplorer component with imported sub-components
- [x] 4.4 Update VisualApp.tsx import path for ChunkExplorer

## 5. VisualApp Component Extraction

- [x] 5.1 Extract ConnectionIndicator to common/ConnectionIndicator.tsx
- [x] 5.2 Extract DocumentSelector to common/DocumentSelector.tsx
- [x] 5.3 Refactor main VisualApp component with imported sub-components

## 6. Design Tokens Implementation

- [x] 6.1 Extend tailwind.config.js with semantic color tokens (confidence, status)
- [x] 6.2 Add CSS variables for light/dark theme support
- [x] 6.3 Create tokens/colors.ts with token definitions
- [x] 6.4 Create tokens/spacing.ts with spacing definitions
- [x] 6.5 Create tokens/variants.ts with variant definitions

## 7. shadcn/ui Integration

- [x] 7.1 Replace ConfidenceBadge manual colors with shadcn Badge variants
- [x] 7.2 Replace PerformanceBadge manual colors with shadcn Badge variants
- [x] 7.3 Replace StatusBadge manual colors with shadcn Badge variants
- [x] 7.4 Replace StatCard container with shadcn Card
- [x] 7.5 Replace SourceCard container with shadcn Card
- [x] 7.6 Replace ChunkCard container with shadcn Card
- [x] 7.7 Implement Collapsible for RetrievalStatsPanel expand/collapse
- [x] 7.8 Implement ScrollArea for message list scrolling

## 8. frontend-design Skill Creation

- [x] 8.1 Create skill.md with skill definition
- [x] 8.2 Create templates/card.tsx with Card component template
- [x] 8.3 Create templates/badge.tsx with Badge component template
- [x] 8.4 Create templates/collapsible.tsx with Collapsible template
- [x] 8.5 Create examples/chat-window.tsx with usage example
- [x] 8.6 Create examples/stats-dashboard.tsx with usage example

## 9. DocumentManager Enhancement

- [x] 9.1 Extract UploadArea to documents/UploadArea.tsx
- [x] 9.2 Extract DocumentList to documents/DocumentList.tsx
- [x] 9.3 Replace status badge colors with design tokens
- [x] 9.4 Replace progress bar with shadcn Progress component

## 10. Verification

- [x] 10.1 Run TypeScript compilation and verify no errors
- [x] 10.2 Run existing frontend tests and verify all pass
- [x] 10.3 Visual verification of all 6 tabs in VisualApp
- [x] 10.4 Document component migration in frontend-design skill