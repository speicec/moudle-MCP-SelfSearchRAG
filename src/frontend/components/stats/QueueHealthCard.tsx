/**
 * QueueHealthCard - 队列健康卡片组件
 *
 * 显示队列状态、健康状态徽章、建议操作
 *
 * 任务 9.3.1-9.3.4: QueueHealthCard 组件实现
 */

import React from 'react';
import { Card, CardHeader, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

/**
 * QueueHealthStatus - 队列健康状态
 */
type QueueHealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

/**
 * QueueStats - 队列统计数据
 */
interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * QueueIssue - 队列问题
 */
interface QueueIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestedActions: string[];
}

/**
 * QueueHealthReport - 队列健康报告
 */
interface QueueHealthReport {
  status: QueueHealthStatus;
  stats: QueueStats;
  issues: QueueIssue[];
  timestamp: number;
}

/**
 * QueueHealthCardProps - QueueHealthCard 组件属性
 */
interface QueueHealthCardProps {
  report: QueueHealthReport;
  compact?: boolean;
}

/**
 * statusConfig - 状态配置
 */
const statusConfig: Record<QueueHealthStatus, {
  color: string;
  bg: string;
  label: string;
  icon: string;
}> = {
  healthy: {
    color: 'text-green-700',
    bg: 'bg-green-50',
    label: '健康',
    icon: '✓',
  },
  warning: {
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    label: '警告',
    icon: '⚠',
  },
  critical: {
    color: 'text-red-700',
    bg: 'bg-red-50',
    label: '严重',
    icon: '✗',
  },
  unknown: {
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    label: '未知',
    icon: '?',
  },
};

/**
 * QueueHealthCard - 队列健康卡片组件
 */
export function QueueHealthCard({ report, compact = false }: QueueHealthCardProps) {
  const config = statusConfig[report.status];

  if (compact) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded ${config.bg}`}>
        <Badge variant={report.status === 'critical' ? 'destructive' : report.status === 'warning' ? 'secondary' : 'default'}>
          {config.icon} {config.label}
        </Badge>
        <span className="text-sm text-gray-600">
          等待: {report.stats.waiting} | 活跃: {report.stats.active}
        </span>
      </div>
    );
  }

  return (
    <Card className={`${config.bg} border`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="font-medium">队列健康状态</div>
          <Badge variant={report.status === 'critical' ? 'destructive' : report.status === 'warning' ? 'secondary' : 'default'}>
            {config.icon} {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* 任务 9.3.2: 实现队列状态展示 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{report.stats.waiting}</div>
            <div className="text-xs text-gray-500">等待</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{report.stats.active}</div>
            <div className="text-xs text-gray-500">活跃</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{report.stats.completed}</div>
            <div className="text-xs text-gray-500">完成</div>
          </div>
        </div>

        {/* 失败统计 */}
        {report.stats.failed > 0 && (
          <div className="text-center text-red-600 mb-4">
            <span className="font-medium">失败: {report.stats.failed}</span>
            {report.stats.completed > 0 && (
              <span className="text-xs ml-2">
                ({((report.stats.failed / (report.stats.completed + report.stats.failed)) * 100).toFixed(1)}%)
              </span>
            )}
          </div>
        )}

        {/* 任务 9.3.4: 实现建议操作展示 */}
        {report.issues.length > 0 && (
          <div className="border-t pt-3">
            <div className="text-xs font-medium text-gray-600 mb-2">检测到的问题:</div>
            <div className="space-y-2">
              {report.issues.slice(0, 3).map((issue, i) => (
                <div key={i} className="text-sm">
                  <div className={`font-medium ${issue.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'}`}>
                    {issue.message}
                  </div>
                  {issue.suggestedActions.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      建议: {issue.suggestedActions.join(' | ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * QueueStatsSummary - 队列统计摘要组件
 */
export function QueueStatsSummary({ stats }: { stats: QueueStats }) {
  const total = stats.waiting + stats.active + stats.completed + stats.failed;

  return (
    <div className="flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <span className="text-gray-500">等待:</span>
        <span className={`font-medium ${stats.waiting > 50 ? 'text-red-600' : 'text-gray-800'}`}>
          {stats.waiting}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-500">活跃:</span>
        <span className="font-medium text-blue-600">{stats.active}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-500">完成:</span>
        <span className="font-medium text-green-600">{stats.completed}</span>
      </div>
      {stats.failed > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-gray-500">失败:</span>
          <span className="font-medium text-red-600">{stats.failed}</span>
        </div>
      )}
    </div>
  );
}

export default QueueHealthCard;