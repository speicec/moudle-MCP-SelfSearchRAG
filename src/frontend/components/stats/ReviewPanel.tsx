/**
 * ReviewPanel - 人工审核面板组件
 *
 * 显示待审核项列表，支持分配、批准、拒绝操作
 *
 * 任务 9.2.1-9.2.4: ReviewPanel 组件实现
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

/**
 * ReviewPriority - 审核优先级
 */
type ReviewPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * ReviewStatus - 审核状态
 */
type ReviewStatus = 'pending' | 'assigned' | 'reviewed' | 'resolved';

/**
 * ReviewResult - 审核结果
 */
type ReviewResult = 'approved' | 'rejected' | 'modified';

/**
 * ReviewItem - 审核项数据
 */
interface ReviewItem {
  reviewId: string;
  traceId: string;
  evaluationId: string;
  alertId?: string;
  status: ReviewStatus;
  priority: ReviewPriority;
  createdAt: string;
  assignedTo?: string;
  reviewedAt?: string;
  resolvedAt?: string;
  reviewNotes?: string;
  result?: ReviewResult;
  details: {
    query: string;
    answer: string;
    safetyScore?: number;
    faithfulness?: number;
    contraindication?: string;
    dangerousAdvice?: string[];
  };
}

/**
 * ReviewPanelProps - ReviewPanel 组件属性
 */
interface ReviewPanelProps {
  items: ReviewItem[];
  onAssign?: (reviewId: string, assignedTo: string) => void;
  onApprove?: (reviewId: string, notes?: string) => void;
  onReject?: (reviewId: string, notes?: string) => void;
  maxItems?: number;
}

/**
 * priorityConfig - 优先级配置
 */
const priorityConfig: Record<ReviewPriority, {
  color: string;
  bg: string;
  label: string;
  order: number;
}> = {
  critical: {
    color: 'text-red-700',
    bg: 'bg-red-50',
    label: '紧急',
    order: 1,
  },
  high: {
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    label: '高',
    order: 2,
  },
  medium: {
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    label: '中',
    order: 3,
  },
  low: {
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    label: '低',
    order: 4,
  },
};

/**
 * ReviewPanel - 审核面板组件
 */
export function ReviewPanel({
  items,
  onAssign,
  onApprove,
  onReject,
  maxItems = 10,
}: ReviewPanelProps) {
  // Sort by priority
  const sortedItems = [...items]
    .filter(i => i.status === 'pending' || i.status === 'assigned')
    .sort((a, b) => priorityConfig[a.priority].order - priorityConfig[b.priority].order)
    .slice(0, maxItems);

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const assignedCount = items.filter(i => i.status === 'assigned').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="font-medium">人工审核队列</div>
          <div className="flex gap-2">
            <Badge variant="outline">{pendingCount} 待分配</Badge>
            <Badge variant="secondary">{assignedCount} 已分配</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {sortedItems.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            无待审核项
          </div>
        ) : (
          <div className="space-y-3">
            {sortedItems.map(item => (
              <ReviewItemCard
                key={item.reviewId}
                item={item}
                onAssign={onAssign}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ReviewItemCard - 单个审核项卡片
 */
function ReviewItemCard({
  item,
  onAssign,
  onApprove,
  onReject,
}: {
  item: ReviewItem;
  onAssign?: (reviewId: string, assignedTo: string) => void;
  onApprove?: (reviewId: string, notes?: string) => void;
  onReject?: (reviewId: string, notes?: string) => void;
}) {
  const [assignTo, setAssignTo] = useState('');
  const [notes, setNotes] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const config = priorityConfig[item.priority];

  return (
    <Card className={`${config.bg} border`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={item.priority === 'critical' ? 'destructive' : 'secondary'}>
              {config.label}
            </Badge>
            <span className="text-sm font-medium">审核项 #{item.reviewId.slice(0, 8)}</span>
          </div>
          <Badge variant="outline">
            {formatStatus(item.status)}
          </Badge>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          创建: {getTimeAgo(item.createdAt)}
          {item.assignedTo && <span className="ml-2">分配给: {item.assignedTo}</span>}
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        <div className="text-sm">
          <div className="font-medium text-gray-700 mb-1">查询:</div>
          <div className="text-gray-600 truncate">{item.details.query}</div>
        </div>

        {item.details.safetyScore !== undefined && (
          <div className="text-sm mt-2">
            <span className="text-red-600">安全分数: {item.details.safetyScore.toFixed(2)}</span>
          </div>
        )}

        {item.details.faithfulness !== undefined && (
          <div className="text-sm mt-1">
            <span className="text-yellow-600">忠实度: {item.details.faithfulness.toFixed(2)}</span>
          </div>
        )}

        {showDetails && (
          <div className="mt-3 text-sm border-t pt-2">
            <div className="font-medium text-gray-700 mb-1">答案预览:</div>
            <div className="text-gray-600 max-h-40 overflow-auto">
              {item.details.answer.slice(0, 500)}
              {item.details.answer.length > 500 && '...'}
            </div>

            {item.details.contraindication && (
              <div className="mt-2 text-red-600">
                禁忌: {item.details.contraindication}
              </div>
            )}

            {item.details.dangerousAdvice && item.details.dangerousAdvice.length > 0 && (
              <div className="mt-2">
                <div className="text-red-600 font-medium">危险建议:</div>
                <ul className="text-red-600 text-xs">
                  {item.details.dangerousAdvice.map((a, i) => (
                    <li key={i}>• {a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '隐藏详情' : '查看详情'}
        </Button>
      </CardContent>

      {item.status === 'pending' && onAssign && (
        <CardFooter className="pt-2 gap-2">
          <Input
            placeholder="分配给..."
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => {
              if (assignTo.trim()) {
                onAssign(item.reviewId, assignTo.trim());
                setAssignTo('');
              }
            }}
          >
            分配
          </Button>
        </CardFooter>
      )}

      {item.status === 'assigned' && (onApprove || onReject) && (
        <CardFooter className="pt-2 flex-col gap-2">
          <Input
            placeholder="审核备注..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-2 w-full">
            {onApprove && (
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={() => onApprove(item.reviewId, notes)}
              >
                批准
              </Button>
            )}
            {onReject && (
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => onReject(item.reviewId, notes)}
              >
                拒绝
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

// Helper functions

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

function formatStatus(status: ReviewStatus): string {
  const statusNames: Record<ReviewStatus, string> = {
    pending: '待分配',
    assigned: '已分配',
    reviewed: '已审核',
    resolved: '已解决',
  };
  return statusNames[status];
}

export default ReviewPanel;