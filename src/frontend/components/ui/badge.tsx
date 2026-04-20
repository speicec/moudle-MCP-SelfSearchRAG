import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        // Confidence variants
        high: 'border-transparent bg-confidence-high/20 text-confidence-high',
        medium: 'border-transparent bg-confidence-medium/20 text-confidence-medium',
        low: 'border-transparent bg-confidence-low/20 text-confidence-low',
        // Status variants
        pending: 'border-transparent bg-status-pending/20 text-status-pending',
        processing: 'border-transparent bg-status-processing/20 text-status-processing',
        indexed: 'border-transparent bg-status-indexed/20 text-status-indexed',
        error: 'border-transparent bg-status-error/20 text-status-error',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };