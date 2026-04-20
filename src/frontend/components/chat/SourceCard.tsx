import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import ConfidenceBadge from './ConfidenceBadge';
import type { RetrievalResult } from '../../store';
import type { ConfidenceLevel } from '../../store/retrievalStore';

/**
 * Source card component - displays individual retrieval result with confidence
 */
const SourceCard: React.FC<{
  result: RetrievalResult;
  index: number;
  confidenceScore?: number;
  confidenceLevel?: ConfidenceLevel;
}> = ({ result, index, confidenceScore, confidenceLevel }) => {
  const [expanded, setExpanded] = useState(false);

  const effectiveLevel = confidenceLevel || (
    result.similarityScore >= 0.7 ? 'high' :
    result.similarityScore >= 0.5 ? 'medium' : 'low'
  );
  const effectiveScore = confidenceScore || result.similarityScore;

  return (
    <Card className="mb-2">
      <CardContent className="p-2">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              #{index + 1}
            </Badge>
            {confidenceLevel && (
              <ConfidenceBadge level={effectiveLevel} score={effectiveScore} />
            )}
            {!confidenceLevel && (
              <Badge variant="outline">
                {(result.similarityScore * 100).toFixed(0)}% 相似
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
        </div>
        {expanded && (
          <ScrollArea className="mt-2 h-48 bg-muted rounded">
            <div className="p-2 text-sm text-foreground whitespace-pre-wrap">
              {result.parentChunkContent.slice(0, 500)}
              {result.parentChunkContent.length > 500 && '...'}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default SourceCard;