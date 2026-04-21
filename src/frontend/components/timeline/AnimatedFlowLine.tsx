import React from 'react';
import { motion } from 'framer-motion';

/**
 * AnimatedFlowLine - displays animated flow between stage cards
 *
 * Uses gradient particle animation to indicate processing flow direction
 */
const AnimatedFlowLine: React.FC<{
  isActive: boolean;
  isCompleted: boolean;
}> = ({ isActive, isCompleted }) => {
  // Static completed line (green)
  if (isCompleted) {
    return (
      <div className="relative h-0.5 w-8 flex items-center justify-center">
        <div className="absolute inset-0 bg-confidence-high rounded" />
      </div>
    );
  }

  // Muted inactive line
  if (!isActive) {
    return (
      <div className="relative h-0.5 w-8 flex items-center justify-center">
        <div className="absolute inset-0 bg-muted rounded" />
      </div>
    );
  }

  // Animated flowing line with gradient particle
  return (
    <div className="relative h-0.5 w-8 flex items-center justify-center overflow-hidden">
      {/* Background line */}
      <div className="absolute inset-0 bg-status-processing/30 rounded" />

      {/* Flowing particle */}
      <motion.div
        className="absolute h-full w-4 bg-gradient-to-r from-transparent via-primary to-transparent rounded"
        initial={{ x: '-100%' }}
        animate={{ x: '200%' }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
};

export default AnimatedFlowLine;