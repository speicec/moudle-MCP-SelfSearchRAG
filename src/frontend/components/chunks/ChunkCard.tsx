import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import type { ChunkItem } from '../../store';

/**
 * Chunk card component for grid view
 */
const ChunkCard: React.FC<{
  chunk: ChunkItem;
  onViewDetails: (chunk: ChunkItem) => void;
  isNew?: boolean;
}> = ({ chunk, onViewDetails, isNew }) => {
  return (
    <motion.div
      initial={isNew ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className={`cursor-pointer transition-colors ${
          chunk.level === 'parent'
            ? 'border-primary'
            : ''
        }`}
        onClick={() => onViewDetails(chunk)}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <Badge variant={chunk.level === 'parent' ? 'secondary' : 'outline'}>
              {chunk.level === 'parent' ? '父块' : '小块'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {chunk.tokenCount} 词
            </span>
          </div>

          {/* Content preview */}
          <p className="text-sm text-foreground line-clamp-3 mb-3">
            {chunk.contentPreview}
          </p>

          {/* Quality score */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              质量：{(chunk.qualityScore * 100).toFixed(0)}%
            </span>
            <div className="w-20 h-1.5 bg-muted rounded-full">
              <div
                className={`h-full rounded-full ${
                  chunk.qualityScore >= 0.8 ? 'bg-confidence-high' :
                  chunk.qualityScore >= 0.5 ? 'bg-confidence-medium' : 'bg-confidence-low'
                }`}
                style={{ width: `${chunk.qualityScore * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ChunkCard;