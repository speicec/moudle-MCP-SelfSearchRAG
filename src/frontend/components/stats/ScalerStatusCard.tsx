/**
 * ScalerStatusCard - 扩缩容状态卡片组件
 *
 * 显示 replicas 数量、手动扩缩容按钮、扩缩容历史
 *
 * 任务 9.4.1-9.4.4: ScalerStatusCard 组件实现
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

/**
 * ScalerStatus - 扩缩容状态
 */
interface ScalerStatus {
  enabled: boolean;
  currentReplicas: number;
  minReplicas: number;
  maxReplicas: number;
  lastScaleEvent?: {
    timestamp: string;
    type: string;
    fromReplicas: number;
    toReplicas: number;
  };
}

/**
 * ScaleEvent - 扩缩容事件
 */
interface ScaleEvent {
  eventId: string;
  timestamp: string;
  type: 'scale_up' | 'scale_down' | 'manual_scale' | 'failed';
  fromReplicas: number;
  toReplicas: number;
  reason: string;
  triggeredBy: 'autoscaler' | 'manual';
  success: boolean;
}

/**
 * ScalerStatusCardProps - ScalerStatusCard 组件属性
 */
interface ScalerStatusCardProps {
  status: ScalerStatus;
  history?: ScaleEvent[];
  onScale?: (target: number) => void;
  onEnable?: () => void;
  onDisable?: () => void;
}

/**
 * ScalerStatusCard - 扩缩容状态卡片组件
 */
export function ScalerStatusCard({
  status,
  history = [],
  onScale,
  onEnable,
  onDisable,
}: ScalerStatusCardProps) {
  const [targetReplicas, setTargetReplicas] = useState(status.currentReplicas.toString());

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="font-medium">自动扩缩容</div>
          <Badge variant={status.enabled ? 'default' : 'secondary'}>
            {status.enabled ? '已启用' : '已禁用'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* 任务 9.4.2: 实现 replicas 数量展示 */}
        <div className="flex items-center justify-center mb-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">{status.currentReplicas}</div>
            <div className="text-sm text-gray-500">当前 Replicas</div>
          </div>
        </div>

        {/* 配置范围 */}
        <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mb-4">
          <span>最小: {status.minReplicas}</span>
          <span>—</span>
          <span>最大: {status.maxReplicas}</span>
        </div>

        {/* 最近扩缩容事件 */}
        {status.lastScaleEvent && (
          <div className="text-xs text-gray-500 text-center mb-4">
            最近操作: {formatScaleType(status.lastScaleEvent.type)}
            ({status.lastScaleEvent.fromReplicas} → {status.lastScaleEvent.toReplicas})
            <span className="ml-2">{getTimeAgo(status.lastScaleEvent.timestamp)}</span>
          </div>
        )}

        {/* 任务 9.4.4: 实现扩缩容历史展示 */}
        {history.length > 0 && (
          <div className="border-t pt-3">
            <div className="text-xs font-medium text-gray-600 mb-2">扩缩容历史:</div>
            <div className="space-y-1 max-h-32 overflow-auto">
              {history.slice(0, 5).map((event, i) => (
                <div key={i} className="text-xs flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {formatScaleType(event.type)}
                  </Badge>
                  <span className={event.success ? 'text-gray-600' : 'text-red-600'}>
                    {event.fromReplicas} → {event.toReplicas}
                  </span>
                  <span className="text-gray-400">{getTimeAgo(event.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* 任务 9.4.3: 实现手动扩缩容按钮 */}
      {onScale && (
        <CardFooter className="flex-col gap-2">
          <div className="flex gap-2 w-full">
            <Input
              type="number"
              min={status.minReplicas}
              max={status.maxReplicas}
              value={targetReplicas}
              onChange={(e) => setTargetReplicas(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={() => {
                const target = parseInt(targetReplicas, 10);
                if (target >= status.minReplicas && target <= status.maxReplicas) {
                  onScale(target);
                }
              }}
            >
              扩缩容
            </Button>
          </div>

          <div className="flex gap-2 w-full">
            {onEnable && !status.enabled && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={onEnable}
              >
                启用自动
              </Button>
            )}
            {onDisable && status.enabled && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={onDisable}
              >
                禁用自动
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

/**
 * ReplicaProgress - Replicas 进度条组件
 */
export function ReplicaProgress({ current, min, max }: {
  current: number;
  min: number;
  max: number;
}) {
  const percentage = ((current - min) / (max - min)) * 100;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{min}</span>
        <span className="font-medium">{current}</span>
        <span>{max}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full">
        <div
          className="h-2 bg-blue-500 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Helper functions

function formatScaleType(type: string): string {
  const typeNames: Record<string, string> = {
    scale_up: '扩容',
    scale_down: '缩容',
    manual_scale: '手动',
    failed: '失败',
  };
  return typeNames[type] ?? type;
}

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
}

export default ScalerStatusCard;