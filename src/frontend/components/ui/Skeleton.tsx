import React from 'react';
import { motion } from 'framer-motion';

/**
 * Skeleton component for loading states
 * Provides animated placeholder content
 */

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'circle' | 'avatar';
  width?: string;
  height?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
}) => {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700 animate-pulse rounded';

  const variantClasses = {
    text: 'h-4 w-full',
    card: 'h-24 w-full',
    circle: 'rounded-full',
    avatar: 'h-10 w-10 rounded-full',
  };

  const style = {
    width: width,
    height: height,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
};

/**
 * Skeleton group for common loading patterns
 */
export const SkeletonGroup: React.FC<{
  type: 'stat-card' | 'document-list' | 'chunk-grid' | 'message';
  count?: number;
}> = ({ type, count = 3 }) => {
  if (type === 'stat-card') {
    return (
      <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  if (type === 'document-list') {
    return (
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'chunk-grid') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700">
            <Skeleton className="h-6 w-16 mb-2" />
            <Skeleton className="h-16 w-full mb-3" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'message') {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-[85%] bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return null;
};

export default Skeleton;