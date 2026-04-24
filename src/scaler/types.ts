/**
 * Scaler Types - 扩缩容类型定义
 */

import type { ScaleEvent } from '../alert/types.js';

/**
 * AutoscalerConfig - 扩缩容配置
 *
 * 任务 7.1.1: 定义 AutoscalerConfig
 */
export interface AutoscalerConfig {
  minReplicas: number;
  maxReplicas: number;
  scaleUpThreshold: number; // waiting > threshold → scale up
  scaleDownThreshold: number; // waiting < threshold + active < 2 → scale down
  cooldownPeriod: number; // ms between scale operations
  checkInterval: number; // ms between check cycles
  serviceName: string; // Docker Compose service name
}

/**
 * DEFAULT_AUTOSCALER_CONFIG - 默认扩缩容配置
 */
export const DEFAULT_AUTOSCALER_CONFIG: AutoscalerConfig = {
  minReplicas: 1,
  maxReplicas: 10,
  scaleUpThreshold: 50,
  scaleDownThreshold: 5,
  cooldownPeriod: 300000, // 5 minutes
  checkInterval: 60000, // 1 minute
  serviceName: 'evaluation-worker',
};

/**
 * ScaleDecision - 扩缩容决策
 */
export interface ScaleDecision {
  action: 'scale_up' | 'scale_down' | 'none' | 'manual_scale';
  targetReplicas: number;
  reason: string;
  metrics: {
    waiting: number;
    active: number;
    currentReplicas: number;
  };
}

/**
 * ScaleState - 扩缩容状态
 */
export interface ScaleState {
  enabled: boolean;
  currentReplicas: number;
  lastScaleTime: number;
  lastScaleAction: 'scale_up' | 'scale_down' | 'manual_scale' | null;
}