import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStatsStore, useStatsStore as statsStore, type PerformanceIndicator } from '../store';

/**
 * Performance indicator badge
 */
const PerformanceBadge: React.FC<{ indicator: PerformanceIndicator }> = ({ indicator }) => {
  const colors = {
    excellent: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700',
    good: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700',
    needs_optimization: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700',
  };

  const labels = {
    excellent: '优秀',
    good: '良好',
    needs_optimization: '需优化',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[indicator]}`}>
      {labels[indicator]}
    </span>
  );
};

/**
 * Stat card component
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
      className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
            {icon}
          </div>
        )}
      </div>
      {indicator && (
        <div className="mt-2">
          <PerformanceBadge indicator={indicator} />
        </div>
      )}
    </motion.div>
  );
};

/**
 * Quality distribution chart
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
      <h3 className="text-sm font-medium text-gray-900 dark:text-white">Quality Distribution</h3>

      {/* Bar chart */}
      <div className="flex items-center gap-1 h-8 rounded-lg overflow-hidden">
        {percentages.high > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentages.high}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-green-500"
          />
        )}
        {percentages.medium > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentages.medium}%` }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="h-full bg-yellow-500"
          />
        )}
        {percentages.low > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentages.low}%` }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="h-full bg-red-500"
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-gray-600 dark:text-gray-400">High (≥80%)</span>
            <span className="font-medium text-gray-900 dark:text-white">{distribution.high}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span className="text-gray-600 dark:text-gray-400">Medium</span>
            <span className="font-medium text-gray-900 dark:text-white">{distribution.medium}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-gray-600 dark:text-gray-400">Low (&lt;50%)</span>
            <span className="font-medium text-gray-900 dark:text-white">{distribution.low}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Stage time distribution chart
 */
const StageTimeChart: React.FC<{
  distribution: { ingest: number; parse: number; embed: number; index: number };
}> = ({ distribution }) => {
  const total = distribution.ingest + distribution.parse + distribution.embed + distribution.index;
  const stages = [
    { name: 'Ingest', value: distribution.ingest, color: 'bg-amber-500' },
    { name: 'Parse', value: distribution.parse, color: 'bg-violet-500' },
    { name: 'Embed', value: distribution.embed, color: 'bg-blue-500' },
    { name: 'Index', value: distribution.index, color: 'bg-green-500' },
  ];

  const maxValue = Math.max(...stages.map(s => s.value));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white">Stage Time Distribution</h3>

      {/* Bar chart */}
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.name} className="flex items-center gap-2">
            <span className="w-16 text-xs text-gray-600 dark:text-gray-400">{stage.name}</span>
            <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: maxValue > 0 ? `${(stage.value / maxValue) * 100}%` : '0%' }}
                transition={{ duration: 0.5 }}
                className={`h-full ${stage.color}`}
              />
            </div>
            <span className="w-16 text-xs text-right text-gray-900 dark:text-white">
              {stage.value}ms
            </span>
          </div>
        ))}
      </div>

      {/* Optimization hint */}
      {total > 0 && (
        <div className="p-2 rounded bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400">
          {distribution.embed > total * 0.5 && (
            <span>💡 Embedding stage takes most time. Consider using a faster embedding model or caching.</span>
          )}
          {distribution.parse > total * 0.5 && (
            <span>💡 Parsing takes most time. Consider optimizing document size or using batch processing.</span>
          )}
          {total > 0 && distribution.embed <= total * 0.5 && distribution.parse <= total * 0.5 && (
            <span>✓ Stage times are well-balanced.</span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * StatsDashboard component
 * Displays global statistics and performance metrics
 */
const StatsDashboard: React.FC = () => {
  const {
    pipelineStats,
    retrievalStats,
    chunkStats,
    stageTimeDistribution,
    lastUpdate,
    isLoading,
    error,
    pipelinePerformance,
    retrievalPerformance,
    chunkQualityPerformance,
    fetchStats,
  } = useStatsStore();

  // Fetch stats on mount and periodically
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (isLoading && lastUpdate === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          System Statistics
        </h2>
        {lastUpdate && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Last updated: {new Date(lastUpdate).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Pipeline Stats */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Pipeline Performance</h3>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="Documents Processed"
            value={pipelineStats.totalDocumentsProcessed}
            subtitle="Total processed"
          />
          <StatCard
            title="Avg. Processing Time"
            value={`${(pipelineStats.averageProcessingTimeMs / 1000).toFixed(2)}s`}
            subtitle="Per document"
            indicator={pipelinePerformance}
          />
          <StatCard
            title="Total Chunks"
            value={pipelineStats.totalChunksCreated}
            subtitle="All documents"
          />
          <StatCard
            title="Avg. Chunks/Doc"
            value={pipelineStats.averageChunksPerDocument.toFixed(1)}
            subtitle="Per document"
          />
        </div>
      </div>

      {/* Retrieval Stats */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Retrieval Performance</h3>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="Total Queries"
            value={retrievalStats.totalQueries}
            subtitle="All time"
          />
          <StatCard
            title="Avg. Latency"
            value={`${retrievalStats.averageRetrievalTimeMs.toFixed(0)}ms`}
            subtitle="Per query"
            indicator={retrievalPerformance}
          />
          <StatCard
            title="Avg. Results"
            value={retrievalStats.averageResultsPerQuery.toFixed(1)}
            subtitle="Per query"
          />
          <StatCard
            title="Success Rate"
            value={`${(retrievalStats.successRate * 100).toFixed(0)}%`}
            subtitle="Successful queries"
            indicator={retrievalPerformance}
          />
        </div>
      </div>

      {/* Chunk Stats */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Chunk Statistics</h3>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="Small Chunks"
            value={chunkStats.totalSmallChunks}
            subtitle="For precise retrieval"
          />
          <StatCard
            title="Parent Chunks"
            value={chunkStats.totalParentChunks}
            subtitle="For full context"
          />
          <StatCard
            title="Avg. Quality Score"
            value={`${(chunkStats.averageQualityScore * 100).toFixed(0)}%`}
            subtitle="All chunks"
            indicator={chunkQualityPerformance}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <QualityDistributionChart distribution={chunkStats.qualityDistribution} />
        </div>
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <StageTimeChart distribution={stageTimeDistribution} />
        </div>
      </div>
    </div>
  );
};

export default StatsDashboard;