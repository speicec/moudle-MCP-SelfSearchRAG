import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { PerformanceIndicator } from '../../store';

/**
 * Stat card component - displays a single metric with optional indicator
 */
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  indicator?: PerformanceIndicator;
  icon?: React.ReactNode;
}> = ({ title, value, subtitle, indicator, icon }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
            {icon && (
              <div className="p-2 rounded-lg bg-muted">
                {icon}
              </div>
            )}
          </div>
          {indicator && (
            <div className="mt-2">
              <PerformanceBadge indicator={indicator} />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

import PerformanceBadge from './PerformanceBadge';

export default StatCard;