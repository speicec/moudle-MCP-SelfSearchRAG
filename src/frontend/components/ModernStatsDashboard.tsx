/**
 * ModernStatsDashboard - 重构后的系统统计仪表盘
 *
 * 设计目标:
 * - 清晰的分组布局，使用 Card 包装每个统计组
 * - 使用 shadcn/ui 组件和语义化颜色
 * - 响应式网格布局
 * - 滚动区域支持，避免页面溢出
 * - 动画流畅的数据展示
 */
import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStatsStore, type PerformanceIndicator } from '../store';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import Skeleton from './ui/Skeleton';
import {
  Activity,
  FileText,
  Clock,
  Database,
  BarChart3,
  Search,
  Check,
  Zap,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  HeartPulse,
  Link2,
  BookOpen,
  MessageSquare,
  FileSearch,
  CircleCheck,
} from 'lucide-react';

// ==================== 性能指示器徽章 ====================

const PerformanceBadge: React.FC<{ indicator: PerformanceIndicator }> = ({ indicator }) => {
  const config = {
    excellent: { label: '优秀', class: 'bg-green-100 text-green-700 border-green-200', icon: TrendingUp },
    good: { label: '良好', class: 'bg-blue-100 text-blue-700 border-blue-200', icon: Minus },
    needs_optimization: { label: '需优化', class: 'bg-orange-100 text-orange-700 border-orange-200', icon: TrendingDown },
  };
  const { label, class: className, icon: Icon } = config[indicator];

  return (
    <Badge variant="outline" className={`${className} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
};

// ==================== 统计指标卡片 ====================

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  indicator?: PerformanceIndicator;
  trend?: 'up' | 'down' | 'stable';
}> = ({ title, value, subtitle, icon, indicator, trend }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-muted/50">
              {icon}
            </div>
            {trend && (
              <div className={`p-1 rounded ${trend === 'up' ? 'bg-green-100' : trend === 'down' ? 'bg-red-100' : 'bg-gray-100'}`}>
                {trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-600" /> :
                 trend === 'down' ? <TrendingDown className="w-3 h-3 text-red-600" /> :
                 <Minus className="w-3 h-3 text-gray-500" />}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {indicator && (
            <div className="mt-3 pt-2 border-t border-muted">
              <PerformanceBadge indicator={indicator} />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// ==================== 质量分布图表 ====================

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
    <div className="space-y-3">
      {/* 堆叠条形图 */}
      <div className="flex h-6 rounded-lg overflow-hidden bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentages.high}%` }}
          transition={{ duration: 0.5 }}
          className="h-full bg-green-500"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentages.medium}%` }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="h-full bg-yellow-500"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentages.low}%` }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="h-full bg-red-400"
        />
      </div>

      {/* 图例 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex items-center gap-2 p-2 rounded bg-green-50">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">高</span>
          <span className="text-sm font-bold text-green-700">{distribution.high}</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded bg-yellow-50">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-xs text-muted-foreground">中</span>
          <span className="text-sm font-bold text-yellow-700">{distribution.medium}</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded bg-red-50">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <span className="text-xs text-muted-foreground">低</span>
          <span className="text-sm font-bold text-red-600">{distribution.low}</span>
        </div>
      </div>
    </div>
  );
};

// ==================== 阶段时间图表 ====================

const StageTimeChart: React.FC<{
  distribution: { ingest: number; parse: number; embed: number; index: number };
}> = ({ distribution }) => {
  const stages = [
    { key: 'ingest', label: '导入', color: 'bg-blue-500' },
    { key: 'parse', label: '解析', color: 'bg-purple-500' },
    { key: 'embed', label: '嵌入', color: 'bg-teal-500' },
    { key: 'index', label: '索引', color: 'bg-orange-500' },
  ];

  const total = stages.reduce((sum, s) => sum + distribution[s.key as keyof typeof distribution], 0);
  const maxTime = Math.max(...stages.map(s => distribution[s.key as keyof typeof distribution]));

  return (
    <div className="space-y-2">
      {stages.map(({ key, label, color }) => {
        const time = distribution[key as keyof typeof distribution];
        const width = maxTime > 0 ? (time / maxTime) * 100 : 0;

        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-12">{label}</span>
            <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full ${color}`}
              />
            </div>
            <span className="text-xs font-mono text-foreground w-16 text-right">
              {time.toFixed(0)}ms
            </span>
          </div>
        );
      })}

      {total > 0 && (
        <div className="pt-2 border-t border-muted flex items-center justify-between">
          <span className="text-xs text-muted-foreground">总耗时</span>
          <span className="text-sm font-bold">{total.toFixed(0)}ms</span>
        </div>
      )}
    </div>
  );
};

// ==================== 评估维度卡片 ====================

const DIMENSION_CONFIG = [
  { key: 'faithfulness', label: '忠实度', icon: Activity, color: 'text-blue-500' },
  { key: 'contextRelevance', label: '上下文相关性', icon: FileSearch, color: 'text-purple-500' },
  { key: 'answerRelevance', label: '答案相关性', icon: MessageSquare, color: 'text-green-500' },
  { key: 'medicalAccuracy', label: '医疗准确性', icon: HeartPulse, color: 'text-red-500' },
  { key: 'safetyAssessment', label: '安全评估', icon: ShieldCheck, color: 'text-orange-500' },
  { key: 'evidenceTraceability', label: '证据可追溯性', icon: Link2, color: 'text-indigo-500' },
  { key: 'completeness', label: '完整性', icon: CircleCheck, color: 'text-teal-500' },
  { key: 'terminologyAccuracy', label: '术语准确性', icon: BookOpen, color: 'text-cyan-500' },
];

const EvaluationDimensions: React.FC<{
  dimensionScores: Record<string, number>;
}> = ({ dimensionScores }) => {
  return (
    <div className="grid grid-cols-4 gap-2">
      {DIMENSION_CONFIG.map(({ key, label, icon: Icon, color }) => {
        const score = dimensionScores[key] ?? 0;
        const scoreClass = score >= 0.85 ? 'text-green-600' :
                          score >= 0.70 ? 'text-blue-600' :
                          score >= 0.50 ? 'text-orange-600' : 'text-red-600';

        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-2 rounded bg-muted/50"
          >
            <Icon className={`w-4 h-4 ${color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <p className={`text-sm font-bold ${scoreClass}`}>
                {Math.round(score * 100)}%
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

// ==================== 风险等级分布 ====================

const RiskDistribution: React.FC<{
  distribution: { safe: number; caution: number; warning: number; danger: number; total: number };
}> = ({ distribution }) => {
  const risks = [
    { key: 'safe', label: '安全', color: 'bg-green-500', textColor: 'text-green-700' },
    { key: 'caution', label: '注意', color: 'bg-yellow-500', textColor: 'text-yellow-700' },
    { key: 'warning', label: '警告', color: 'bg-orange-500', textColor: 'text-orange-700' },
    { key: 'danger', label: '危险', color: 'bg-red-500', textColor: 'text-red-700' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {risks.map(({ key, label, color, textColor }) => {
        const count = distribution[key as keyof typeof distribution] ?? 0;
        const percent = distribution.total > 0 ? Math.round((count / distribution.total) * 100) : 0;

        return (
          <div key={key} className="text-center p-2 rounded bg-muted/50">
            <div className={`w-full h-1.5 rounded ${color} mb-2`} />
            <p className={`text-xs font-medium ${textColor}`}>{label}</p>
            <p className="text-sm font-bold">{count}</p>
            <p className="text-xs text-muted-foreground">{percent}%</p>
          </div>
        );
      })}
    </div>
  );
};

// ==================== 加载骨架屏 ====================

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-6 p-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-4 w-32" />
    </div>
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
    <div className="grid grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
  </div>
);

// ==================== 主组件 ====================

const ModernStatsDashboard: React.FC = () => {
  const {
    pipelineStats,
    retrievalStats,
    chunkStats,
    stageTimeDistribution,
    evaluationMetrics,
    lastUpdate,
    isLoading,
    error,
    pipelinePerformance,
    retrievalPerformance,
    chunkQualityPerformance,
    evaluationPerformance,
    fetchStats,
  } = useStatsStore();

  // 定期获取统计数据
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // 手动刷新
  const handleRefresh = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  // 初始加载状态
  if (isLoading && lastUpdate === null) {
    return <LoadingSkeleton />;
  }

  // 错误状态
  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardContent className="p-6 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <div>
            <p className="font-medium text-red-800">数据加载失败</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="ml-auto">
            <RefreshCw className="w-4 h-4 mr-1" />
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    // 关键：使用 ScrollArea 确保内容可以滚动
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold">系统统计</h2>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs text-muted-foreground">
                更新于 {new Date(lastUpdate).toLocaleTimeString('zh-CN')}
              </span>
            )}
            <Badge variant="outline" className="flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? '刷新中' : '10s 自动更新'}
            </Badge>
          </div>
        </div>

        {/* 管线性能 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Database className="w-4 h-4" />
              管线性能
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                title="已处理文档"
                value={pipelineStats.totalDocumentsProcessed}
                subtitle="累计处理"
                icon={<FileText className="w-4 h-4 text-muted-foreground" />}
              />
              <MetricCard
                title="平均处理时间"
                value={`${(pipelineStats.averageProcessingTimeMs / 1000).toFixed(2)}s`}
                subtitle="每个文档"
                icon={<Clock className="w-4 h-4 text-muted-foreground" />}
                indicator={pipelinePerformance}
              />
              <MetricCard
                title="总分块数"
                value={pipelineStats.totalChunksCreated}
                subtitle="所有文档"
                icon={<Database className="w-4 h-4 text-muted-foreground" />}
              />
              <MetricCard
                title="平均分块"
                value={pipelineStats.averageChunksPerDocument.toFixed(1)}
                subtitle="每个文档"
                icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
              />
            </div>
          </CardContent>
        </Card>

        {/* 检索性能 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Search className="w-4 h-4" />
              检索性能
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                title="总查询数"
                value={retrievalStats.totalQueries}
                subtitle="累计查询"
                icon={<Search className="w-4 h-4 text-muted-foreground" />}
              />
              <MetricCard
                title="平均延迟"
                value={`${retrievalStats.averageRetrievalTimeMs.toFixed(0)}ms`}
                subtitle="每次查询"
                icon={<Clock className="w-4 h-4 text-muted-foreground" />}
                indicator={retrievalPerformance}
              />
              <MetricCard
                title="平均结果"
                value={retrievalStats.averageResultsPerQuery.toFixed(1)}
                subtitle="每次查询"
                icon={<Database className="w-4 h-4 text-muted-foreground" />}
              />
              <MetricCard
                title="成功率"
                value={`${(retrievalStats.successRate * 100).toFixed(0)}%`}
                subtitle="成功查询"
                icon={<Check className="w-4 h-4 text-muted-foreground" />}
                indicator={retrievalPerformance}
              />
            </div>
          </CardContent>
        </Card>

        {/* 分块统计 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4" />
              分块统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                title="小块数量"
                value={chunkStats.totalSmallChunks}
                subtitle="精确检索"
                icon={<Zap className="w-4 h-4 text-muted-foreground" />}
              />
              <MetricCard
                title="父块数量"
                value={chunkStats.totalParentChunks}
                subtitle="完整上下文"
                icon={<Database className="w-4 h-4 text-muted-foreground" />}
              />
              <MetricCard
                title="平均质量"
                value={`${(chunkStats.averageQualityScore * 100).toFixed(0)}%`}
                subtitle="所有分块"
                icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />}
                indicator={chunkQualityPerformance}
              />
            </div>

            {/* 质量分布图表 */}
            <div className="mt-4 pt-4 border-t border-muted">
              <p className="text-xs text-muted-foreground mb-3">质量分布</p>
              <QualityDistributionChart distribution={chunkStats.qualityDistribution} />
            </div>
          </CardContent>
        </Card>

        {/* 阶段时间分布 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              阶段耗时分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StageTimeChart distribution={stageTimeDistribution} />
          </CardContent>
        </Card>

        {/* 医疗评估指标 */}
        <AnimatePresence>
          {evaluationMetrics.totalEvaluations > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <HeartPulse className="w-4 h-4" />
                      医疗评估指标
                    </CardTitle>
                    <PerformanceBadge indicator={evaluationPerformance} />
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* 综合分数 */}
                  <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${
                        evaluationMetrics.avgOverall >= 0.85 ? 'text-green-600' :
                        evaluationMetrics.avgOverall >= 0.70 ? 'text-blue-600' :
                        evaluationMetrics.avgOverall >= 0.50 ? 'text-orange-600' : 'text-red-600'
                      }`}>
                        {Math.round(evaluationMetrics.avgOverall * 100)}%
                      </p>
                      <p className="text-xs text-muted-foreground">综合分数</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{evaluationMetrics.totalEvaluations}</p>
                      <p className="text-xs text-muted-foreground">评估总数</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">
                        {evaluationMetrics.lastEvaluationTime
                          ? new Date(evaluationMetrics.lastEvaluationTime).toLocaleTimeString('zh-CN')
                          : '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">最后更新</p>
                    </div>
                  </div>

                  {/* 8 维度评估 */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">8 维度评估分数</p>
                    <EvaluationDimensions dimensionScores={evaluationMetrics.dimensionScores} />
                  </div>

                  {/* 分层分数 */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'layer1', label: '基础 RAGAS', color: 'bg-blue-50' },
                      { key: 'layer2', label: '医疗核心', color: 'bg-red-50' },
                      { key: 'layer3', label: '医疗增强', color: 'bg-green-50' },
                    ].map(({ key, label, color }) => {
                      const score = evaluationMetrics.layerScores[key as keyof typeof evaluationMetrics.layerScores] ?? 0;
                      return (
                        <div key={key} className={`p-2 rounded ${color} text-center`}>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className={`text-lg font-bold ${
                            score >= 0.85 ? 'text-green-600' :
                            score >= 0.70 ? 'text-blue-600' : 'text-orange-600'
                          }`}>
                            {Math.round(score * 100)}%
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* 风险等级分布 */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">风险等级分布</p>
                    <RiskDistribution distribution={evaluationMetrics.riskDistribution} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 无评估数据提示 */}
        {evaluationMetrics.totalEvaluations === 0 && (
          <Card className="bg-muted/30">
            <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
              <AlertTriangle className="w-5 h-5" />
              <span>暂无评估数据，发送查询后将自动生成评估结果</span>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
};

export default ModernStatsDashboard;