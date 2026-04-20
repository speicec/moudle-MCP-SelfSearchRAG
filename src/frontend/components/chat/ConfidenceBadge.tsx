import React from 'react';
import { ShieldCheck, Shield, ShieldAlert } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { ConfidenceLevel } from '../../store/retrievalStore';

/**
 * Confidence badge component - displays confidence level with icon
 */
const ConfidenceBadge: React.FC<{
  level: ConfidenceLevel;
  score: number;
}> = ({ level, score }) => {
  const icons = {
    high: ShieldCheck,
    medium: Shield,
    low: ShieldAlert,
  };

  const Icon = icons[level];

  return (
    <Badge variant={level} className="flex items-center gap-1">
      <Icon className="w-3 h-3" />
      {(score * 100).toFixed(0)}%
    </Badge>
  );
};

export default ConfidenceBadge;