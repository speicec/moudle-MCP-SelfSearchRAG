import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStatsStore, type PerformanceIndicator } from '../store';
import { Check, Lightbulb, BarChart3, Database, Zap, FileText, Search, Clock } from 'lucide-react';
import Skeleton, { SkeletonGroup } from './ui/Skeleton';

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
      <h3 className="text-sm font-medium text-gray-900 dark:text-white">质量分布</h3>

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
            <span className="text-gray-600 dark:text-gray-400">高 (≥80%)</span>
            <span className="font-medium text-gray-900 dark:text-white">{distribution.high}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span className="text-gray-600 dark:text-gray-400">中</span>
            <span className="font-medium text-gray-900 dark:text-white">{distribution.medium}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span className="text-gray-600 dark:text-gray-400">低 (&lt;50%)</span>
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
    { name: '导入', value: distribution.ingest, color: 'bg-amber-500' },
    { name: '解析', value: distribution.parse, color: 'bg-violet-500' },
    { name: '嵌入', value: distribution.embed, color: 'bg-blue-500' },
    { name: '索引', value: distribution.index, color: 'bg-green-500' },
  ];

  const maxValue = Math.max(...stages.map(s => s.value));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white">阶段耗时分布</h3>

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
            <span className="flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              嵌入阶段耗时最长，建议使用更快的嵌入模型或启用缓存。
            </span>
          )}
          {distribution.parse > total * 0.5 && (
            <span className="flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              解析阶段耗时最长，建议优化文档大小或使用批量处理。
            </span>
          )}
          {total > 0 && distribution.embed <= total * 0.5 && distribution.parse <= total * 0.5 && (
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-green-500" />
              各阶段耗时均衡，运行状态良好。
            </span>
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
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Pipeline stats skeleton */}
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonGroup key={i} type="stat-card" />
          ))}
        </div>
        {/* Retrieval stats skeleton */}
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonGroup key={i} type="stat-card" />
          ))}
        </div>
        {/* Chunk stats skeleton */}
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonGroup key={i} type="stat-card" />
          ))}
        </div>
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
          系统统计
        </h2>
        {lastUpdate && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            最后更新：{new Date(lastUpdate).toLocaleTimeString('zh-CN')}
          </span>
        )}
      </div>

      {/* Pipeline Stats */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">管线性能</h3>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="已处理文档"
            value={pipelineStats.totalDocumentsProcessed}
            subtitle="总处理数"
            icon={<FileText className="w-4 h-4 text-gray-500" />}
          />
          <StatCard
            title="平均处理时间"
            value={`${(pipelineStats.averageProcessingTimeMs / 1000).toFixed(2)}s`}
            subtitle="每个文档"
            indicator={pipelinePerformance}
            icon={<Clock className="w-4 h-4 text-gray-500" />}
          />
          <StatCard
            title="总分块数"
            value={pipelineStats.totalChunksCreated}
            subtitle="所有文档"
            icon={<Database className="w-4 h-4 text-gray-500" />}
          />
          <StatCard
            title="平均分块/文档"
            value={pipelineStats.averageChunksPerDocument.toFixed(1)}
            subtitle="每个文档"
            icon={<BarChart3 className="w-4 h-4 text-gray-500" />}
          />
        </div>
      </div>

      {/* Retrieval Stats */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">检索性能</h3>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="总查询数"
            value={retrievalStats.totalQueries}
            subtitle="累计"
            icon={<Search className="w-4 h-4 text-gray-500" />}
          />
          <StatCard
            title="平均延迟"
            value={`${retrievalStats.averageRetrievalTimeMs.toFixed(0)}ms`}
            subtitle="每次查询"
            indicator={retrievalPerformance}
            icon={<Clock className="w-4 h-4 text-gray-500" />}
          />
          <StatCard
            title="平均结果数"
            value={retrievalStats.averageResultsPerQuery.toFixed(1)}
            subtitle="每次查询"
            icon={<Database className="w-4 h-4 text-gray-500" />}
          />
          <StatCard
            title="成功率"
            value={`${(retrievalStats.successRate * 100).toFixed(0)}%`}
            subtitle="成功查询"
            indicator={retrievalPerformance}
            icon={<Check className="w-4 h-4 text-gray-500" />}
          />
        </div>
      </div>

      {/* Chunk Stats */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">分块统计</h3>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="小块数量"
            value={chunkStats.totalSmallChunks}
            subtitle="精确检索用"
            icon={<Zap className="w-4 h-4 text-gray-500" />}
          />
          <StatCard
            title="父块数量"
            value={chunkStats.totalParentChunks}
            subtitle="完整上下文"
            icon={<Database className="w-4 h-4 text-gray-500" />}
          />
          <StatCard
            title="平均质量评分"
            value={`${(chunkStats.averageQualityScore * 100).toFixed(0)}%`}
            subtitle="所有分块"
            indicator={chunkQualityPerformance}
            icon={<BarChart3 className="w-4 h-4 text-gray-500" />}
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