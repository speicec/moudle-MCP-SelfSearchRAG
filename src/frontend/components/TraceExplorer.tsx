/**
 * TraceExplorer - 追踪记录浏览页面
 *
 * 显示历史追踪记录列表和评估结果
 */

import React, { useEffect } from 'react';
import { useTraceStore, type TraceSummary, type TraceFilter } from '../store/traceStore';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import Skeleton from './ui/Skeleton';

/**
 * 状态样式配置
 */
const STATUS_CONFIG = {
  running: { label: '运行中', icon: Activity, color: 'bg-blue-100 text-blue-700' },
  completed: { label: '完成', icon: CheckCircle2, color: 'bg-green-100 text-green-700' },
  failed: { label: '失败', icon: XCircle, color: 'bg-red-100 text-red-700' },
};

/**
 * 风险等级样式配置
 */
const RISK_CONFIG = {
  safe: { label: '安全', color: 'bg-green-500' },
  caution: { label: '注意', color: 'bg-yellow-500' },
  warning: { label: '警告', color: 'bg-orange-500' },
  danger: { label: '危险', color: 'bg-red-500' },
};

/**
 * 格式化时间
 */
function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化分数
 */
function formatScore(score?: number): string {
  if (score === undefined) return '-';
  return `${(score * 100).toFixed(0)}%`;
}

/**
 * TraceExplorer 组件
 */
const TraceExplorer: React.FC = () => {
  const {
    traces,
    totalTraces,
    currentPage,
    pageSize,
    isLoading,
    error,
    selectedTrace,
    fetchTraces,
    fetchTraceDetail,
    setFilter,
    clearFilter,
    reset,
  } = useTraceStore();

  // 初始化加载
  useEffect(() => {
    fetchTraces(1);
  }, [fetchTraces]);

  // 计算总页数
  const totalPages = Math.ceil(totalTraces / pageSize);

  // 分页处理
  const handlePrevPage = () => {
    if (currentPage > 1) {
      fetchTraces(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      fetchTraces(currentPage + 1);
    }
  };

  // 查看详情
  const handleViewDetail = (traceId: string) => {
    fetchTraceDetail(traceId);
  };

  // 刷新
  const handleRefresh = () => {
    fetchTraces(currentPage);
  };

  // 状态筛选
  const handleStatusFilter = (status?: 'running' | 'completed' | 'failed') => {
    setFilter({ status });
  };

  // 风险等级筛选
  const handleRiskFilter = (riskLevel?: 'safe' | 'caution' | 'warning' | 'danger') => {
    setFilter({ riskLevel });
  };

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-destructive/20 border border-destructive">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-2">
          <RefreshCw className="w-4 h-4 mr-2" />
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          追踪记录浏览
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            共 {totalTraces} 条记录
          </span>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="flex items-center gap-4">
        {/* 状态筛选 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">状态:</span>
          {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((status) => {
            const config = STATUS_CONFIG[status];
            return (
              <Button
                key={status}
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => handleStatusFilter(status)}
              >
                {config.label}
              </Button>
            );
          })}
          <Button variant="ghost" size="sm" className="h-7" onClick={clearFilter}>
            全部
          </Button>
        </div>

        {/* 风险等级筛选 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">风险:</span>
          {(Object.keys(RISK_CONFIG) as Array<keyof typeof RISK_CONFIG>).map((risk) => {
            const config = RISK_CONFIG[risk];
            return (
              <Button
                key={risk}
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => handleRiskFilter(risk)}
              >
                <span className={`w-2 h-2 rounded-full ${config.color}`} />
                {config.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* 追踪列表 */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : traces.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>暂无追踪记录</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {traces.map((trace) => (
            <TraceRow
              key={trace.traceId}
              trace={trace}
              onViewDetail={handleViewDetail}
              isSelected={selectedTrace?.traceId === trace.traceId}
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
            下一页
          </Button>
        </div>
      )}

      {/* 详情视图 */}
      {selectedTrace && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">追踪详情</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => useTraceStore.getState().selectTrace(null)}>
                关闭
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <TraceDetailView trace={selectedTrace} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/**
 * TraceRow - 追踪记录行
 */
const TraceRow: React.FC<{
  trace: TraceSummary;
  onViewDetail: (traceId: string) => void;
  isSelected: boolean;
}> = ({ trace, onViewDetail, isSelected }) => {
  const statusConfig = STATUS_CONFIG[trace.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.running;
  const StatusIcon = statusConfig.icon;

  return (
    <Card
      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => onViewDetail(trace.traceId)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* 左侧：基本信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={statusConfig.color}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
              {trace.riskLevel && (
                <Badge className={RISK_CONFIG[trace.riskLevel as keyof typeof RISK_CONFIG]?.color}>
                  {RISK_CONFIG[trace.riskLevel as keyof typeof RISK_CONFIG]?.label}
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {formatTime(trace.timestamp)}
              </span>
            </div>
            <p className="text-sm truncate">{trace.query}</p>
          </div>

          {/* 右侧：指标 */}
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-muted-foreground">分数</div>
              <div className="font-medium">{formatScore(trace.overallScore)}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">耗时</div>
              <div className="font-medium">{trace.durationMs}ms</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">LLM调用</div>
              <div className="font-medium">{trace.llmCallCount}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * TraceDetailView - 追踪详情视图
 */
const TraceDetailView: React.FC<{ trace: TraceDetail }> = ({ trace }) => {
  return (
    <div className="space-y-4">
      {/* 查询信息 */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">查询信息</h4>
        <div className="bg-muted/30 p-3 rounded-lg">
          <p className="text-sm">{trace.query.raw}</p>
          {trace.query.rewritten && (
            <p className="text-xs text-muted-foreground mt-1">
              重写: {trace.query.rewritten}
            </p>
          )}
        </div>
      </div>

      {/* 执行阶段 */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">执行阶段</h4>
        <div className="grid grid-cols-2 gap-2">
          {trace.phases.map((phase) => (
            <div key={phase.spanId} className="bg-muted/30 p-2 rounded text-sm">
              <span className="font-medium">{phase.phase}</span>
              <span className="text-muted-foreground ml-2">{phase.durationMs}ms</span>
            </div>
          ))}
        </div>
      </div>

      {/* LLM 调用 */}
      {trace.llmCalls.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            LLM 调用 ({trace.llmCalls.length} 次)
          </h4>
          <div className="flex gap-2">
            {trace.llmCalls.map((call) => (
              <Badge key={call.callId} variant="outline">
                {call.model} ({call.latencyMs}ms)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 评估结果 */}
      {trace.evaluation && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">评估结果</h4>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-muted/30 p-2 rounded text-center">
              <div className="text-xs text-muted-foreground">综合</div>
              <div className="font-medium">{formatScore(trace.evaluation.overallScore)}</div>
            </div>
            <div className="bg-muted/30 p-2 rounded text-center">
              <div className="text-xs text-muted-foreground">忠实度</div>
              <div className="font-medium">{formatScore(trace.evaluation.faithfulness)}</div>
            </div>
            <div className="bg-muted/30 p-2 rounded text-center">
              <div className="text-xs text-muted-foreground">上下文相关性</div>
              <div className="font-medium">{formatScore(trace.evaluation.contextRelevance)}</div>
            </div>
            <div className="bg-muted/30 p-2 rounded text-center">
              <div className="text-xs text-muted-foreground">答案相关性</div>
              <div className="font-medium">{formatScore(trace.evaluation.answerRelevance)}</div>
            </div>
          </div>
        </div>
      )}

      {/* 答案 */}
      {trace.answer.text && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">答案</h4>
          <div className="bg-muted/30 p-3 rounded-lg text-sm max-h-40 overflow-auto">
            {trace.answer.text.slice(0, 500)}
            {trace.answer.text.length > 500 && '...'}
          </div>
        </div>
      )}
    </div>
  );
};

export default TraceExplorer;