import React, { useEffect } from 'react';
import { useStatsStore } from '../store';
import { Check, Lightbulb, BarChart3, Database, Zap, FileText, Search, Clock } from 'lucide-react';
import Skeleton, { SkeletonGroup } from './ui/Skeleton';
import StatCard from './stats/StatCard';
import QualityDistributionChart from './stats/QualityDistributionChart';
import StageTimeChart from './stats/StageTimeChart';
import { Card, CardContent } from './ui/card';

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
      <div className="p-4 rounded-lg bg-destructive/20 border border-destructive">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          系统统计
        </h2>
        {lastUpdate && (
          <span className="text-xs text-muted-foreground">
            最后更新：{new Date(lastUpdate).toLocaleTimeString('zh-CN')}
          </span>
        )}
      </div>

      {/* Pipeline Stats */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">管线性能</h3>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="已处理文档"
            value={pipelineStats.totalDocumentsProcessed}
            subtitle="总处理数"
            icon={<FileText className="w-4 h-4 text-muted-foreground" />}
          />
          <StatCard
            title="平均处理时间"
            value={`${(pipelineStats.averageProcessingTimeMs / 1000).toFixed(2)}s`}
            subtitle="每个文档"
            indicator={pipelinePerformance}
            icon={<Clock className="w-4 h-4 text-muted-foreground" />}
          />
          <StatCard
            title="总分块数"
            value={pipelineStats.totalChunksCreated}
            subtitle="所有文档"
            icon={<Database className="w-4 h-4 text-muted-foreground" />}
          />
          <StatCard
            title="平均分块/文档"
            value={pipelineStats.averageChunksPerDocument.toFixed(1)}
            subtitle="每个文档"
            icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Retrieval Stats */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">检索性能</h3>
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            title="总查询数"
            value={retrievalStats.totalQueries}
            subtitle="累计"
            icon={<Search className="w-4 h-4 text-muted-foreground" />}
          />
          <StatCard
            title="平均延迟"
            value={`${retrievalStats.averageRetrievalTimeMs.toFixed(0)}ms`}
            subtitle="每次查询"
            indicator={retrievalPerformance}
            icon={<Clock className="w-4 h-4 text-muted-foreground" />}
          />
          <StatCard
            title="平均结果数"
            value={retrievalStats.averageResultsPerQuery.toFixed(1)}
            subtitle="每次查询"
            icon={<Database className="w-4 h-4 text-muted-foreground" />}
          />
          <StatCard
            title="成功率"
            value={`${(retrievalStats.successRate * 100).toFixed(0)}%`}
            subtitle="成功查询"
            indicator={retrievalPerformance}
            icon={<Check className="w-4 h-4 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Chunk Stats */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">分块统计</h3>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="小块数量"
            value={chunkStats.totalSmallChunks}
            subtitle="精确检索用"
            icon={<Zap className="w-4 h-4 text-muted-foreground" />}
          />
          <StatCard
            title="父块数量"
            value={chunkStats.totalParentChunks}
            subtitle="完整上下文"
            icon={<Database className="w-4 h-4 text-muted-foreground" />}
          />
          <StatCard
            title="平均质量评分"
            value={`${(chunkStats.averageQualityScore * 100).toFixed(0)}%`}
            subtitle="所有分块"
            indicator={chunkQualityPerformance}
            icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <QualityDistributionChart distribution={chunkStats.qualityDistribution} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <StageTimeChart distribution={stageTimeDistribution} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StatsDashboard;