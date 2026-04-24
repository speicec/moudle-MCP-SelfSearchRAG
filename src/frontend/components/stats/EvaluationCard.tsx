/**
 * EvaluationCard - 评估指标卡片组件
 *
 * 显示 8 维度评估分数、分层分数和风险等级
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Activity,
  ShieldCheck,
  FileSearch,
  MessageSquare,
  HeartPulse,
  AlertTriangle,
  Link2,
  CircleCheck,
  BookOpen,
} from 'lucide-react';
import type {
  EvaluationDimensionScores,
  LayerScores,
  RiskLevelDistribution,
  PerformanceIndicator,
} from '../../store/statsStore';

interface EvaluationCardProps {
  avgOverall: number;
  dimensionScores: EvaluationDimensionScores;
  layerScores: LayerScores;
  riskDistribution: RiskLevelDistribution;
  totalEvaluations: number;
  lastEvaluationTime: number | null;
  performance: PerformanceIndicator;
}

/**
 * 维度配置
 */
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

/**
 * 层级配置
 */
const LAYER_CONFIG = [
  { key: 'layer1', label: '基础 RAGAS', color: 'bg-blue-100' },
  { key: 'layer2', label: '医疗核心', color: 'bg-red-100' },
  { key: 'layer3', label: '医疗增强', color: 'bg-green-100' },
];

/**
 * 风险等级配置
 */
const RISK_CONFIG = {
  safe: { label: '安全', color: 'bg-green-500', textColor: 'text-green-700' },
  caution: { label: '注意', color: 'bg-yellow-500', textColor: 'text-yellow-700' },
  warning: { label: '警告', color: 'bg-orange-500', textColor: 'text-orange-700' },
  danger: { label: '危险', color: 'bg-red-500', textColor: 'text-red-700' },
};

/**
 * 性能指示器样式
 */
const PERFORMANCE_STYLES: Record<PerformanceIndicator, string> = {
  excellent: 'bg-green-100 text-green-700 border-green-300',
  good: 'bg-blue-100 text-blue-700 border-blue-300',
  needs_optimization: 'bg-orange-100 text-orange-700 border-orange-300',
};

/**
 * 格式化分数为百分比
 */
function formatScore(score: number): string {
  return `${(score * 100).toFixed(0)}%`;
}

/**
 * 获取分数颜色
 */
function getScoreColor(score: number): string {
  if (score >= 0.85) return 'text-green-600';
  if (score >= 0.70) return 'text-blue-600';
  if (score >= 0.50) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * EvaluationCard 组件
 */
const EvaluationCard: React.FC<EvaluationCardProps> = ({
  avgOverall,
  dimensionScores,
  layerScores,
  riskDistribution,
  totalEvaluations,
  lastEvaluationTime,
  performance,
}) => {
  if (totalEvaluations === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-muted-foreground">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <span>暂无评估数据</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 总体评估卡片 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <Activity className="w-5 h-5 mr-2 text-primary" />
              评估概览
            </CardTitle>
            <Badge className={PERFORMANCE_STYLES[performance]}>
              {performance === 'excellent' ? '优秀' : performance === 'good' ? '良好' : '需优化'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {/* 综合分数 */}
            <div className="text-center">
              <div className={`text-3xl font-bold ${getScoreColor(avgOverall)}`}>
                {formatScore(avgOverall)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">综合分数</div>
            </div>

            {/* 评估总数 */}
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                {totalEvaluations}
              </div>
              <div className="text-sm text-muted-foreground mt-1">评估总数</div>
            </div>

            {/* 最后更新 */}
            <div className="text-center">
              <div className="text-sm text-foreground">
                {lastEvaluationTime ? new Date(lastEvaluationTime).toLocaleTimeString('zh-CN') : '-'}
              </div>
              <div className="text-sm text-muted-foreground mt-1">最后更新</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 8 维度分数 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            8 维度评估分数
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {DIMENSION_CONFIG.map(({ key, label, icon: Icon, color }) => (
              <div key={key} className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className={`text-sm font-medium ${getScoreColor(dimensionScores[key as keyof EvaluationDimensionScores])}`}>
                    {formatScore(dimensionScores[key as keyof EvaluationDimensionScores])}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 分层分数 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            分层分数
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {LAYER_CONFIG.map(({ key, label, color }) => (
              <div key={key} className={`p-3 rounded-lg ${color}`}>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`text-lg font-bold ${getScoreColor(layerScores[key as keyof LayerScores])}`}>
                  {formatScore(layerScores[key as keyof LayerScores])}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 风险等级分布 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            风险等级分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {(Object.keys(RISK_CONFIG) as Array<keyof typeof RISK_CONFIG>).map((riskLevel) => {
              const config = RISK_CONFIG[riskLevel];
              const count = riskDistribution[riskLevel];
              const percentage = riskDistribution.total > 0
                ? (count / riskDistribution.total) * 100
                : 0;

              return (
                <div key={riskLevel} className="text-center">
                  <div className={`w-full h-2 rounded-full ${config.color} mb-1`} />
                  <div className={`text-sm font-medium ${config.textColor}`}>
                    {config.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {count} ({percentage.toFixed(0)}%)
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EvaluationCard;