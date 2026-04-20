/**
 * Variant tokens for component states
 *
 * Usage: Use with class-variance-authority (cva) for component variants
 */

export const badgeVariants = {
  confidence: {
    high: 'border-transparent bg-confidence-high/20 text-confidence-high',
    medium: 'border-transparent bg-confidence-medium/20 text-confidence-medium',
    low: 'border-transparent bg-confidence-low/20 text-confidence-low',
  },
  status: {
    pending: 'border-transparent bg-status-pending/20 text-status-pending',
    processing: 'border-transparent bg-status-processing/20 text-status-processing',
    indexed: 'border-transparent bg-status-indexed/20 text-status-indexed',
    error: 'border-transparent bg-status-error/20 text-status-error',
  },
};

export const buttonVariants = {
  variant: {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  },
  size: {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10',
  },
};

export const cardVariants = {
  default: 'rounded-lg border bg-card text-card-foreground shadow-sm',
  interactive: 'rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer transition-colors hover:border-primary',
};

export default {
  badgeVariants,
  buttonVariants,
  cardVariants,
};