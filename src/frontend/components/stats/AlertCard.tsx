/**
 * AlertCard - 告警卡片组件
 *
 * 显示系统告警，支持不同严重程度样式区分
 *
 * 任务 9.1.1-9.1.4: AlertCard 组件实现
 */

import React from 'react';
import { Card, CardHeader, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

/**
 * AlertSeverity - 告警严重程度
 */
type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * AlertStatus - 告警状态
 */
type AlertStatus = 'active' | 'acknowledged' | 'resolved';

/**
 * AlertEvent - 告警事件数据
 */
interface AlertEvent {
  alertId: string;
  timestamp: string;
  type: string;
  severity: AlertSeverity;
  traceId?: string;
  evaluationId?: string;
  details: Record<string, unknown>;
  suggestedActions: string[];
  status: AlertStatus;
}

/**
 * AlertCardProps - AlertCard 组件属性
 */
interface AlertCardProps {
  alert: AlertEvent;
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
  compact?: boolean;
}

/**
 * severityConfig - 严重程度配置
 */
const severityConfig: Record<AlertSeverity, {
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  critical: {
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: '严重',
  },
  warning: {
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    label: '警告',
  },
  info: {
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: '信息',
  },
};

/**
 * AlertCard - 告警卡片组件
 */
export function AlertCard({ alert, onAcknowledge, onResolve, compact = false }: AlertCardProps) {
  const config = severityConfig[alert.severity];
  const timeAgo = getTimeAgo(alert.timestamp);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded border ${config.border} ${config.bg}`}>
        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
          {config.label}
        </Badge>
        <span className={`text-sm ${config.color}`}>{alert.type}</span>
        <span className="text-xs text-gray-500">{timeAgo}</span>
      </div>
    );
  }

  return (
    <Card className={`${config.border} ${config.bg}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
              {config.label}
            </Badge>
            <span className={`font-medium ${config.color}`}>{formatAlertType(alert.type)}</span>
          </div>
          <Badge variant="outline">
            {formatStatus(alert.status)}
          </Badge>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {timeAgo}
          {alert.traceId && <span className="ml-2">Trace: {alert.traceId.slice(0, 8)}...</span>}
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        <div className="text-sm">
          {renderAlertDetails(alert.type, alert.details)}
        </div>

        {alert.suggestedActions.length > 0 && (
          <div className="mt-2">
            <div className="text-xs font-medium text-gray-600 mb-1">建议操作:</div>
            <ul className="text-xs text-gray-500 space-y-1">
              {alert.suggestedActions.map((action, i) => (
                <li key={i}>• {action}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      {alert.status === 'active' && (onAcknowledge || onResolve) && (
        <CardFooter className="pt-2 gap-2">
          {onAcknowledge && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAcknowledge(alert.alertId)}
            >
              确认
            </Button>
          )}
          {onResolve && (
            <Button
              size="sm"
              variant="default"
              onClick={() => onResolve(alert.alertId)}
            >
              解决
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * AlertList - 告警列表组件
 *
 * 任务 9.1.3: 实现告警列表展示
 */
export function AlertList({
  alerts,
  onAcknowledge,
  onResolve,
  maxItems = 10,
}: {
  alerts: AlertEvent[];
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
  maxItems?: number;
}) {
  const activeAlerts = alerts.filter(a => a.status === 'active').slice(0, maxItems);

  if (activeAlerts.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        无活动告警
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeAlerts.map(alert => (
        <AlertCard
          key={alert.alertId}
          alert={alert}
          onAcknowledge={onAcknowledge}
          onResolve={onResolve}
        />
      ))}
    </div>
  );
}

// Helper functions

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

function formatAlertType(type: string): string {
  const typeNames: Record<string, string> = {
    SAFETY_CRITICAL: '安全禁忌',
    FAITHFULNESS_LOW: '忠实度低',
    MEDICAL_ACCURACY: '医疗准确性',
    QUEUE_BACKLOG: '队列积压',
    HIGH_FAILURE_RATE: '失败率过高',
    NO_ACTIVE_WORKERS: '无活跃Worker',
    REVIEW_SLA_BREACH: '审核SLA超时',
  };
  return typeNames[type] ?? type;
}

function formatStatus(status: AlertStatus): string {
  const statusNames: Record<AlertStatus, string> = {
    active: '活动',
    acknowledged: '已确认',
    resolved: '已解决',
  };
  return statusNames[status];
}

function renderAlertDetails(type: string, details: Record<string, unknown>): React.ReactNode {
  switch (type) {
    case 'SAFETY_CRITICAL':
      return (
        <>
          安全分数: {(details as { safetyScore: number }).safetyScore?.toFixed(2)}
          {(details as { contraindication?: string }).contraindication && (
            <span className="ml-2">禁忌: {(details as { contraindication?: string }).contraindication}</span>
          )}
        </>
      );
    case 'FAITHFULNESS_LOW':
      return (
        <>
          忠实度: {(details as { value: number }).value?.toFixed(2)}
          {(details as { unsupportedCount?: number }).unsupportedCount && (
            <span className="ml-2">无支持声明: {(details as { unsupportedCount?: number }).unsupportedCount}</span>
          )}
        </>
      );
    case 'QUEUE_BACKLOG':
      return (
        <>
          等待任务: {(details as { waiting: number }).waiting}
          {(details as { active?: number }).active !== undefined && (
            <span className="ml-2">活跃: {(details as { active?: number }).active}</span>
          )}
        </>
      );
    default:
      return JSON.stringify(details, null, 2).slice(0, 100);
  }
}

export default AlertCard;