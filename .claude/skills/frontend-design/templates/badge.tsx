// Badge component template
// Use for labels, status indicators, confidence scores

import React from 'react';
import { Badge } from './ui/badge';
import { ShieldCheck, Shield, ShieldAlert, Loader2 } from 'lucide-react';

// Confidence badge pattern
const ConfidenceBadgeExample: React.FC<{
  level: 'high' | 'medium' | 'low';
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

// Status badge pattern
const StatusBadgeExample: React.FC<{
  status: 'pending' | 'processing' | 'indexed' | 'error';
}> = ({ status }) => {
  const labels = {
    pending: '等待中',
    processing: '处理中',
    indexed: '已索引',
    error: '错误',
  };

  return (
    <Badge variant={status} className="flex items-center gap-1">
      {status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
      {labels[status]}
    </Badge>
  );
};

export { ConfidenceBadgeExample, StatusBadgeExample };