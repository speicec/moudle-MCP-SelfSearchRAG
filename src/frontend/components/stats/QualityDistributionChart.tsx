import React from 'react';
import { motion } from 'framer-motion';

/**
 * Quality distribution chart - displays chunk quality distribution
 */
const QualityDistributionChart: React.FC<{
  distribution: { high: number; medium: number; low: number };
}> = ({ distribution }) => {
  const total = distribution.high + distribution.medium + distribution.low;
  const percentages = {
    high: total > 0 ? (distribution.high / total) * 100 : 0,
    medium: total > 0 ? (distribution.medium / total) * 100 : 0,
    low: total > 0 ? (distribution.low / total) * 100 : 0,
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-foreground">质量分布</h3>

      {/* Bar chart */}
      <div className="flex items-center gap-1 h-8 rounded-lg overflow-hidden">
        {percentages.high > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentages.high}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-confidence-high"
          />
        )}
        {percentages.medium > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentages.medium}%` }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="h-full bg-confidence-medium"
          />
        )}
        {percentages.low > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentages.low}%` }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="h-full bg-confidence-low"
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-confidence-high" />
            <span className="text-muted-foreground">高 (≥80%)</span>
            <span className="font-medium text-foreground">{distribution.high}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-confidence-medium" />
            <span className="text-muted-foreground">中</span>
            <span className="font-medium text-foreground">{distribution.medium}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-confidence-low" />
            <span className="text-muted-foreground">低 (&lt;50%)</span>
            <span className="font-medium text-foreground">{distribution.low}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityDistributionChart;