import React from 'react';
import { Upload, Trash2, CheckCircle, Clock, AlertCircle, Loader2, Layers } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import type { Document } from '../../store';

interface StatusBadgeProps {
  status: Document['status'];
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const icons = {
    pending: Clock,
    processing: Loader2,
    indexed: CheckCircle,
    error: AlertCircle,
  };

  const variants = {
    pending: 'pending',
    processing: 'processing',
    indexed: 'indexed',
    error: 'error',
  } as const;

  const labels = {
    pending: '等待中',
    processing: '处理中',
    indexed: '已索引',
    error: '错误',
  };

  const Icon = icons[status];

  return (
    <Badge variant={variants[status]} className="flex items-center gap-1">
      {status === 'processing' ? <Icon className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      {labels[status]}
    </Badge>
  );
};

export default StatusBadge;