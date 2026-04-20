import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { ChunkItem } from '../../store';

/**
 * Tree node component for tree view
 */
const TreeNode: React.FC<{
  chunk: ChunkItem;
  children?: ChunkItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onViewDetails: (chunk: ChunkItem) => void;
}> = ({ chunk, children, isExpanded, onToggle, onViewDetails }) => {
  const hasChildren = children && children.length > 0;

  return (
    <div className="flex flex-col">
      {/* Node */}
      <motion.div
        whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
        className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
          chunk.level === 'parent' ? 'font-medium' : ''
        }`}
        onClick={() => hasChildren ? onToggle() : onViewDetails(chunk)}
      >
        {/* Expand/collapse icon */}
        {hasChildren && (
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            className="w-4 h-4 text-muted-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </motion.div>
        )}
        {!hasChildren && (
          <div className="w-4 h-4 flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full ${
              chunk.level === 'parent' ? 'bg-primary' : 'bg-muted-foreground'
            }`} />
          </div>
        )}

        {/* Level badge */}
        <Badge variant={chunk.level === 'parent' ? 'secondary' : 'outline'}>
          {chunk.level}
        </Badge>

        {/* Content preview */}
        <span className="flex-1 text-sm text-foreground truncate">
          {chunk.contentPreview.slice(0, 50)}
        </span>

        {/* Quality */}
        <span className="text-xs text-muted-foreground">
          {(chunk.qualityScore * 100).toFixed(0)}%
        </span>

        {/* Tokens */}
        <span className="text-xs text-muted-foreground">
          {chunk.tokenCount}
        </span>
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pl-6 border-l ml-2"
          >
            {children.map((child) => (
              <TreeNode
                key={child.id}
                chunk={child}
                isExpanded={false}
                onToggle={() => {}}
                onViewDetails={onViewDetails}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TreeNode;