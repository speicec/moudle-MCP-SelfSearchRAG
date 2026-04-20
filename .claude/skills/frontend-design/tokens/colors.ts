/**
 * Color tokens for the design system
 *
 * Usage: Import and use in tailwind.config.js extensions
 */

export const colorTokens = {
  // Confidence colors (semantic)
  confidence: {
    high: 'hsl(142, 76%, 36%)',    // Green - excellent confidence
    medium: 'hsl(38, 92%, 50%)',   // Yellow - moderate confidence
    low: 'hsl(0, 84%, 60%)',       // Red - low confidence
  },

  // Status colors (semantic)
  status: {
    pending: 'hsl(48, 96%, 53%)',      // Yellow - waiting
    processing: 'hsl(214, 95%, 52%)',  // Blue - in progress
    indexed: 'hsl(142, 76%, 36%)',     // Green - complete
    error: 'hsl(0, 84%, 60%)',         // Red - failed
  },

  // shadcn/ui semantic colors
  semantic: {
    background: 'hsl(var(--background))',
    foreground: 'hsl(var(--foreground))',
    card: 'hsl(var(--card))',
    cardForeground: 'hsl(var(--card-foreground))',
    popover: 'hsl(var(--popover))',
    popoverForeground: 'hsl(var(--popover-foreground))',
    primary: 'hsl(var(--primary))',
    primaryForeground: 'hsl(var(--primary-foreground))',
    secondary: 'hsl(var(--secondary))',
    secondaryForeground: 'hsl(var(--secondary-foreground))',
    muted: 'hsl(var(--muted))',
    mutedForeground: 'hsl(var(--muted-foreground))',
    accent: 'hsl(var(--accent))',
    accentForeground: 'hsl(var(--accent-foreground))',
    destructive: 'hsl(var(--destructive))',
    destructiveForeground: 'hsl(var(--destructive-foreground))',
    border: 'hsl(var(--border))',
    input: 'hsl(var(--input))',
    ring: 'hsl(var(--ring))',
  },
};

export default colorTokens;