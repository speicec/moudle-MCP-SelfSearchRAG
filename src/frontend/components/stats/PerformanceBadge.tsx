import React from 'react';
import { Badge } from '../ui/badge';
import type { PerformanceIndicator } from '../../store';

/**
 * Performance indicator badge - displays performance level
 */
const PerformanceBadge: React.FC<{ indicator: PerformanceIndicator }> = ({ indicator }) => {
  const variants = {
    excellent: 'high',
    good: 'medium',
    needs_optimization: 'low',
  } as const;

  const labels = {
    excellent: '优秀',
    good: '良好',
    needs_optimization: '需优化',
  };

  return (
    <Badge variant={variants[indicator]}>
      {labels[indicator]}
    </Badge>
  );
};

export default PerformanceBadge;