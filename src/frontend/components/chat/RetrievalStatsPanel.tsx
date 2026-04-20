import React from 'react';
import { Badge } from '../ui/badge';
import type { RetrievalStats } from '../../store/retrievalStore';

/**
 * Retrieval stats panel component - displays retrieval statistics
 */
const RetrievalStatsPanel: React.FC<{
  stats: RetrievalStats | null;
  duration?: number;
}> = ({ stats, duration }) => {
  if (!stats) return null;

  return (
    <div className="bg-muted rounded p-2 mb-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <span className="text-muted-foreground">
          粗排: {stats.coarseTopK}
        </span>
        <span className="text-muted-foreground">
          精排: {stats.refinedCount}
        </span>
        <span className="text-muted-foreground">
          平均置信度: {(stats.avgConfidence * 100).toFixed(0)}%
        </span>
        {duration && (
          <span className="text-muted-foreground">
            耗时: {duration}ms
          </span>
        )}
        <Badge variant={stats.method === 'local-reranker' ? 'secondary' : 'outline'}>
          {stats.method === 'local-reranker' ? '本地模型' : '内部计算'}
        </Badge>
      </div>
    </div>
  );
};

export default RetrievalStatsPanel;