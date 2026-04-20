// StatsDashboard usage example demonstrating modern design patterns

import React from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import StatCard from './stats/StatCard';
import PerformanceBadge from './stats/PerformanceBadge';
import QualityDistributionChart from './stats/QualityDistributionChart';
import StageTimeChart from './stats/StageTimeChart';

/**
 * Example: StatsDashboard with modern design
 *
 * Key patterns:
 * - Use StatCard for metric displays (already uses Card internally)
 * - Use PerformanceBadge for performance indicators
 * - Use semantic colors in charts (bg-confidence-high/medium/low)
 * - Grid layout for responsive stat cards
 */

const StatsDashboardExample = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          系统统计
        </h2>
        <span className="text-xs text-muted-foreground">
          最后更新：{new Date().toLocaleTimeString()}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="已处理文档"
          value={42}
          subtitle="总处理数"
        />
        <StatCard
          title="平均处理时间"
          value="1.5s"
          subtitle="每个文档"
          indicator="excellent"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <QualityDistributionChart distribution={{ high: 30, medium: 15, low: 5 }} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <StageTimeChart distribution={{ ingest: 100, parse: 200, embed: 500, index: 150 }} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StatsDashboardExample;