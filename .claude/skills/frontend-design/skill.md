# frontend-design

Modern frontend design system for SelfSearchRAG using shadcn/ui and semantic design tokens.

## Overview

This skill provides design templates, tokens, and examples for building modern, consistent frontend components in the SelfSearchRAG project.

## Design System

### Components (shadcn/ui)

- **Card**: Container with header, content, footer sections
- **Badge**: Semantic color variants (confidence, status)
- **Button**: Multiple variants and sizes
- **Input**: Consistent form input styling
- **Collapsible**: Expand/collapse content areas
- **ScrollArea**: Custom scrollable containers

### Design Tokens

- **Colors**: Semantic confidence/status colors, shadcn semantic colors
- **Spacing**: Standardized padding/margins for components
- **Variants**: Predefined style variations for badges, buttons, cards

## Usage

### Component Templates

Templates are located in `templates/` directory:
- `templates/card.tsx` - Card component template
- `templates/badge.tsx` - Badge component template  
- `templates/collapsible.tsx` - Collapsible template

### Examples

Usage examples are in `examples/` directory:
- `examples/chat-window.tsx` - ChatWindow modern design
- `examples/stats-dashboard.tsx` - StatsDashboard modern design

## Design Guidelines

### Color Usage

- **Confidence**: Use semantic colors for confidence indicators
  - `high` → green (hsl(142, 76%, 36%))
  - `medium` → yellow (hsl(38, 92%, 50%))
  - `low` → red (hsl(0, 84%, 60%))

- **Status**: Use semantic colors for document/process status
  - `pending` → yellow
  - `processing` → blue
  - `indexed` → green
  - `error` → red

### Component Patterns

1. **Card Pattern**: Use Card for container, CardHeader for title, CardContent for body
2. **Badge Pattern**: Use Badge with semantic variants instead of manual colors
3. **Button Pattern**: Use Button with variant prop for consistent styling
4. **Collapsible Pattern**: Use Collapsible for expandable panels

### Directory Structure

```
src/frontend/components/
├── ui/           ← shadcn base components
├── chat/         ← chat-related components
├── stats/        ← statistics components
├── chunks/       ← chunk explorer components
├── common/       ← shared components
└── documents/    ← document management components
```