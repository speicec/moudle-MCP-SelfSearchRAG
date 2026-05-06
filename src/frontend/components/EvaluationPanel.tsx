/**
 * EvaluationPanel - 独立的医疗评估面板
 *
 * 展示完整的 8 维度评估指标、分层分数和风险等级分布
 * 作为独立 Tab 页面使用，提供详细的评估数据可视化
 */
import React, { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  useStatsStore,
  type PerformanceIndicator,
  type EvaluationDimensionScores,
  type LayerScores,
  type RiskLevelDistribution,
} from '../store';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import Skeleton from './ui/Skeleton';
import {
  Activity,
  ShieldCheck,
  HeartPulse,
  Link2,
  BookOpen,
  MessageSquare,
  FileSearch,
  CircleCheck,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  BarChart3,
  Layers,
} from 'lucide-react';

// ==================== 维度配置 ====================

const DIMENSION_CONFIG = [
  { key: 'faithfulness', label: '忠实度', desc: '回答与源文档的一致性', icon: Activity, color: 'text-blue-500', bgColor: 'bg-blue-50' },
  { key: 'contextRelevance', label: '上下文相关性', desc: '检索内容与问题的相关性', icon: FileSearch, color: 'text-purple-500', bgColor: 'bg-purple-50' },
  { key: 'answerRelevance', label: '答案相关性', desc: '回答与用户问题的匹配度', icon: MessageSquare, color: 'text-green-500', bgColor: 'bg-green-50' },
  { key: 'medicalAccuracy', label: '医疗准确性', desc: '医学知识的专业准确性', icon: HeartPulse, color: 'text-red-500', bgColor: 'bg-red-50' },
  { key: 'safetyAssessment', label: '安全评估', desc: '回答的安全风险等级', icon: ShieldCheck, color: 'text-orange-500', bgColor: 'bg-orange-50' },
  { key: 'evidenceTraceability', label: '证据可追溯性', desc: '证据来源的可追溯程度', icon: Link2, color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
  { key: 'completeness', label: '完整性', desc: '回答内容的完整程度', icon: CircleCheck, color: 'text-teal-500', bgColor: 'bg-teal-50' },
  { key: 'terminologyAccuracy', label: '术语准确性', desc: '医学术语使用准确性', icon: BookOpen, color: 'text-cyan-500', bgColor: 'bg-cyan-50' },
];

const LAYER_CONFIG = [
  { key: 'layer1', label: '基础 RAGAS', desc: '基础检索增强生成评估', color: 'bg-blue-100', textColor: 'text-blue-800' },
  { key: 'layer2', label: '医疗核心', desc: '医疗领域核心指标', color: 'bg-red-100', textColor: 'text-red-800' },
  { key: 'layer3', label: '医疗增强', desc: '医疗增强评估指标', color: 'bg-green-100', textColor: 'text-green-800' },
];

const RISK_CONFIG = [
  { key: 'safe', label: '安全', desc: '无风险', color: 'bg-green-500', lightColor: 'bg-green-100', textColor: 'text-green-700' },
  { key: 'caution', label: '注意', desc: '轻微风险', color: 'bg-yellow-500', lightColor: 'bg-yellow-100', textColor: 'text-yellow-700' },
  { key: 'warning', label: '警告', desc: '中等风险', color: 'bg-orange-500', lightColor: 'bg-orange-100', textColor: 'text-orange-700' },
  { key: 'danger', label: '危险', desc: '高风险', color: 'bg-red-500', lightColor: 'bg-red-100', textColor: 'text-red-700' },
];

// ==================== 性能徽章 ====================

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

// ==================== 分数进度条 ====================

const ScoreProgress: React.FC<{ score: number; showLabel?: boolean }> = ({ score, showLabel = true }) => {
  const colorClass = score >= 0.85 ? 'bg-green-500' : score >= 0.70 ? 'bg-blue-500' : score >= 0.50 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score * 100}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full ${colorClass}`}
        />
      </div>
      {showLabel && (
        <span className={`text-sm font-bold min-w-[40px] ${
          score >= 0.85 ? 'text-green-600' : score >= 0.70 ? 'text-blue-600' : score >= 0.50 ? 'text-orange-600' : 'text-red-600'
        }`}>
          {Math.round(score * 100)}%
        </span>
      )}
    </div>
  );
};

// ==================== 维度卡片 ====================

const DimensionCard: React.FC<{
  config: typeof DIMENSION_CONFIG[0];
  score: number;
}> = ({ config, score }) => {
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-sm">{config.label}</p>
                <span className={`text-lg font-bold ${
                  score >= 0.85 ? 'text-green-600' : score >= 0.70 ? 'text-blue-600' : score >= 0.50 ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {Math.round(score * 100)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{config.desc}</p>
              <ScoreProgress score={score} showLabel={false} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// ==================== 分层分数卡片 ====================

const LayerScoreCard: React.FC<{
  config: typeof LAYER_CONFIG[0];
  score: number;
}> = ({ config, score }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-4 rounded-lg ${config.color}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className={`font-medium ${config.textColor}`}>{config.label}</p>
        <span className={`text-2xl font-bold ${
          score >= 0.85 ? 'text-green-600' : score >= 0.70 ? 'text-blue-600' : 'text-orange-600'
        }`}>
          {Math.round(score * 100)}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{config.desc}</p>
      <div className="mt-2">
        <ScoreProgress score={score} showLabel={false} />
      </div>
    </motion.div>
  );
};

// ==================== 风险等级卡片 ====================

const RiskCard: React.FC<{
  config: typeof RISK_CONFIG[0];
  count: number;
  percentage: number;
}> = ({ config, count, percentage }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-lg ${config.lightColor} text-center`}
    >
      <div className={`w-6 h-6 rounded-full ${config.color} mx-auto mb-2`} />
      <p className={`text-sm font-medium ${config.textColor}`}>{config.label}</p>
      <p className="text-xs text-muted-foreground">{config.desc}</p>
      <div className="mt-2 pt-2 border-t border-muted">
        <p className="text-lg font-bold">{count}</p>
        <p className="text-xs text-muted-foreground">{percentage}%</p>
      </div>
    </motion.div>
  );
};

// ==================== 综合分数展示 ====================

const OverallScoreDisplay: React.FC<{
  score: number;
  totalEvaluations: number;
  lastTime: number | null;
  performance: PerformanceIndicator;
}> = ({ score, totalEvaluations, lastTime, performance }) => {
  const scoreColorClass = score >= 0.85 ? 'from-green-500 to-green-600' :
                          score >= 0.70 ? 'from-blue-500 to-blue-600' :
                          score >= 0.50 ? 'from-orange-500 to-orange-600' : 'from-red-500 to-red-600';

  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-600" />
            <h3 className="text-lg font-semibold">综合评估分数</h3>
          </div>
          <PerformanceBadge indicator={performance} />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* 主分数 */}
          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br ${scoreColorClass} text-white mb-2`}>
              <span className="text-3xl font-bold">{Math.round(score * 100)}</span>
            </div>
            <p className="text-sm text-muted-foreground">综合分数</p>
          </div>

          {/* 评估总数 */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-muted mb-2">
              <span className="text-3xl font-bold">{totalEvaluations}</span>
            </div>
            <p className="text-sm text-muted-foreground">评估总数</p>
          </div>

          {/* 最后更新 */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-muted/50 mb-2">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              {lastTime ? new Date(lastTime).toLocaleTimeString('zh-CN') : '未更新'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ==================== 加载状态 ====================

const LoadingState: React.FC = () => (
  <div className="p-6 space-y-6">
    <Skeleton className="h-32 w-full" />
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  </div>
);

// ==================== 空状态 ====================

const EmptyState: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => (
  <Card className="bg-muted/30">
    <CardContent className="p-12 text-center">
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="mb-4"
      >
        <ShieldCheck className="w-16 h-16 text-muted-foreground mx-auto" />
      </motion.div>
      <h3 className="text-lg font-semibold mb-2">暂无评估数据</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
        发送查询后系统将自动生成医疗评估指标，包括 8 维度分数、分层评估和风险等级分布
      </p>
      <Button variant="outline" onClick={onRefresh}>
        <RefreshCw className="w-4 h-4 mr-2" />
        刷新数据
      </Button>
    </CardContent>
  </Card>
);

// ==================== 主组件 ====================

const EvaluationPanel: React.FC = () => {
  const {
    evaluationMetrics,
    evaluationPerformance,
    lastUpdate,
    isLoading,
    error,
    fetchStats,
  } = useStatsStore();

  // 初始化获取数据
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // 手动刷新
  const handleRefresh = useCallback(() => {
    fetchStats();
  }, [fetchStats]);

  // 初始加载状态
  if (isLoading && lastUpdate === null) {
    return <LoadingState />;
  }

  // 错误状态
  if (error) {
    return (
      <Card className="bg-red-50 border-red-200 m-4">
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

  // 无数据状态
  if (evaluationMetrics.totalEvaluations === 0) {
    return <EmptyState onRefresh={handleRefresh} />;
  }

  // 计算风险百分比
  const riskPercentages = {
    safe: evaluationMetrics.riskDistribution.total > 0
      ? Math.round((evaluationMetrics.riskDistribution.safe / evaluationMetrics.riskDistribution.total) * 100) : 0,
    caution: evaluationMetrics.riskDistribution.total > 0
      ? Math.round((evaluationMetrics.riskDistribution.caution / evaluationMetrics.riskDistribution.total) * 100) : 0,
    warning: evaluationMetrics.riskDistribution.total > 0
      ? Math.round((evaluationMetrics.riskDistribution.warning / evaluationMetrics.riskDistribution.total) * 100) : 0,
    danger: evaluationMetrics.riskDistribution.total > 0
      ? Math.round((evaluationMetrics.riskDistribution.danger / evaluationMetrics.riskDistribution.total) * 100) : 0,
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold">医疗质量评估</h2>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs text-muted-foreground">
                更新于 {new Date(lastUpdate).toLocaleTimeString('zh-CN')}
              </span>
            )}
            <Badge variant="outline" className="flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? '刷新中' : '15s 自动更新'}
            </Badge>
          </div>
        </div>

        {/* 综合分数 */}
        <OverallScoreDisplay
          score={evaluationMetrics.avgOverall}
          totalEvaluations={evaluationMetrics.totalEvaluations}
          lastTime={evaluationMetrics.lastEvaluationTime}
          performance={evaluationPerformance}
        />

        {/* 8 维度评估 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              8 维度评估分数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {DIMENSION_CONFIG.map((config) => (
                <DimensionCard
                  key={config.key}
                  config={config}
                  score={evaluationMetrics.dimensionScores[config.key as keyof EvaluationDimensionScores] ?? 0}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 分层分数 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Layers className="w-4 h-4" />
              三层评估分数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {LAYER_CONFIG.map((config) => (
                <LayerScoreCard
                  key={config.key}
                  config={config}
                  score={evaluationMetrics.layerScores[config.key as keyof LayerScores] ?? 0}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 风险等级分布 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              风险等级分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 分布条 */}
            <div className="flex h-4 rounded-full overflow-hidden bg-muted mb-4">
              {RISK_CONFIG.map((config) => {
                const percentage = riskPercentages[config.key as keyof typeof riskPercentages];
                if (percentage > 0) {
                  return (
                    <motion.div
                      key={config.key}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full ${config.color}`}
                    />
                  );
                }
                return null;
              })}
            </div>

            {/* 详细卡片 */}
            <div className="grid grid-cols-4 gap-3">
              {RISK_CONFIG.map((config) => (
                <RiskCard
                  key={config.key}
                  config={config}
                  count={evaluationMetrics.riskDistribution[config.key as keyof RiskLevelDistribution] ?? 0}
                  percentage={riskPercentages[config.key as keyof typeof riskPercentages]}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

export default EvaluationPanel;