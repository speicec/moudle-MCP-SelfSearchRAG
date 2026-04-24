---
capability: queue-health-monitor
version: 1.0
created: 2026-04-24
---

# Spec: Queue Health Monitor

## 概述

队列健康监控定期检查 Redis 队列状态，检测异常情况并触发告警。

## ADDED Requirements

### Requirement: Queue Stats Collection

系统 SHALL 定期收集 Bull 队列统计信息。

#### Scenario: Collect queue stats periodically
- **WHEN** check interval elapsed (60 seconds)
- **THEN** queue.getQueueStats() called
- **AND** stats include: waiting, active, completed, failed, delayed, total

#### Scenario: Stats stored for history
- **WHEN** stats collected
- **THEN** stats stored in queue_stats table (or in-memory buffer)
- **AND** timestamp recorded
- **AND** used for trend analysis

### Requirement: Queue Backlog Detection

系统 SHALL 检测队列积压情况。

#### Scenario: High backlog warning
- **WHEN** waiting > 50 tasks
- **THEN** health status set to 'warning'
- **AND** QUEUE_BACKLOG alert created with severity='warning'
- **AND** recommendations include '增加 Worker replicas'

#### Scenario: Critical backlog
- **WHEN** waiting > 100 tasks
- **THEN** health status set to 'critical'
- **AND** QUEUE_BACKLOG alert created with severity='critical'
- **AND** recommendations include '检查 LLM API 延迟'

#### Scenario: Backlog trend analysis
- **WHEN** backlog increasing for 5 consecutive checks
- **THEN** QUEUE_BACKLOG_TREND alert created
- **AND** includes growth rate in details

### Requirement: Failure Rate Detection

系统 SHALL 检测任务失败率。

#### Scenario: High failure rate warning
- **WHEN** failure rate > 10% (failed / (completed + failed))
- **THEN** health status set to 'warning'
- **AND** HIGH_FAILURE_RATE alert created
- **AND** recommendations include '检查 Redis 连接', '检查 LLM API 状态'

#### Scenario: Critical failure rate
- **WHEN** failure rate > 30%
- **THEN** health status set to 'critical'
- **AND** HIGH_FAILURE_RATE alert created with severity='critical'
- **AND** recommendations include '暂停新任务提交', '重启 Worker 服务'

#### Scenario: Recent failures spike
- **WHEN** more than 5 failures in last 5 minutes
- **THEN** FAILURE_SPIKE alert created
- **AND** includes recent failure details

### Requirement: Worker Activity Check

系统 SHALL 检测 Worker 活跃度。

#### Scenario: No active workers
- **WHEN** active = 0 AND waiting > 0
- **THEN** health status set to 'critical'
- **AND** NO_ACTIVE_WORKERS alert created
- **AND** recommendations include '检查 Worker 进程状态', '重启 Worker 服务'

#### Scenario: Low worker activity
- **WHEN** active < expectedReplicas (from config)
- **THEN** health status set to 'warning'
- **AND** LOW_WORKER_ACTIVITY alert created
- **AND** includes expected vs actual counts

### Requirement: Processing Time Monitoring

系统 SHALL 监控任务处理时间。

#### Scenario: High processing time
- **WHEN** avg processing time > 60 seconds
- **THEN** health status potentially degraded
- **AND** HIGH_PROCESSING_TIME alert created
- **AND** recommendations include '检查 LLM API 延迟'

#### Scenario: Processing time trend
- **WHEN** processing time increasing trend detected
- **THEN** PROCESSING_TIME_TREND alert created
- **AND** includes trend direction and rate

### Requirement: Health Status Report

系统 SHALL 提供健康状态报告 API。

#### Scenario: Get health status
- **WHEN** GET /api/queue/health called
- **THEN** returns:
  - health: 'healthy' | 'warning' | 'critical'
  - stats: current queue stats
  - alerts: active alerts
  - recommendations: suggested actions
  - workerMetrics: worker details

#### Scenario: Health status aggregation
- **WHEN** multiple issues detected
- **THEN** health set to worst severity among issues
- **AND** all alerts and recommendations aggregated

### Requirement: Worker Metrics Collection

系统 SHALL 收集 Worker 详细指标。

#### Scenario: Collect worker metrics
- **WHEN** workerMetrics requested
- **THEN** returns:
  - totalWorkers: current replica count
  - avgProcessingTime: recent average
  - llmLatency: LLM API latency estimate
  - memoryUsage: per-worker memory usage (if available)

#### Scenario: Worker metrics from Docker
- **WHEN** Docker API available
- **THEN** worker container status queried
- **AND** includes container health, CPU, memory

### Requirement: Continuous Monitoring

系统 SHALL 持续监控队列状态。

#### Scenario: Monitoring loop
- **WHEN** monitor started
- **THEN** periodic checks executed at configured interval
- **AND** results logged for audit

#### Scenario: Monitor graceful shutdown
- **WHEN** monitor stop requested
- **THEN** current check completed before shutdown
- **AND** final status reported

## 类型导入

本 spec 使用 `shared-types/spec.md` 中定义的类型：

```typescript
import {
  AlertType,
  AlertEventBase,
  AlertDetailsMap,
  SeverityThresholds
} from './shared-types/spec.md';
```

## 数据模型

QueueHealthStatus.alerts 使用 shared-types 中定义的 AlertEvent 类型。告警类型覆盖队列相关的所有 AlertType：

- `QUEUE_BACKLOG`: waiting 超过阈值
- `QUEUE_BACKLOG_TREND`: 积压增长趋势
- `HIGH_FAILURE_RATE`: 失败率超过阈值
- `FAILURE_SPIKE`: 短时间内大量失败
- `NO_ACTIVE_WORKERS`: 无活跃 Worker
- `LOW_WORKER_ACTIVITY`: Worker 数量低于预期
- `HIGH_PROCESSING_TIME`: 平均处理时间过长
- `PROCESSING_TIME_TREND`: 处理时间增长趋势

阈值配置来自 SeverityThresholds：
- queueBacklogWarningThreshold: 50
- queueBacklogCriticalThreshold: 100
- failureRateWarningThreshold: 0.1 (10%)
- failureRateCriticalThreshold: 0.3 (30%)
- processingTimeWarningThreshold: 60000 (60s)

```typescript
interface QueueHealthStatus {
  health: 'healthy' | 'warning' | 'critical';
  stats: QueueStats;
  alerts: AlertEvent[];  // 使用 shared-types AlertEvent
  recommendations: string[];
  workerMetrics: WorkerMetrics;
  timestamp: string;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

interface WorkerMetrics {
  totalWorkers: number;
  avgProcessingTime: number;
  llmLatency: number;
  memoryUsage?: number[];
}
```

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/queue/health` | GET | 获取队列健康状态 |
| `/api/queue/stats` | GET | 获取队列统计信息 |
| `/api/queue/metrics` | GET | 获取 Worker 详细指标 |

## 测试场景

| 场景 | 输入 | 验证点 |
|------|------|--------|
| High backlog | waiting=60 | health=warning, QUEUE_BACKLOG alert |
| Critical backlog | waiting=150 | health=critical |
| High failure rate | 30% failed | health=critical, HIGH_FAILURE_RATE alert |
| No active workers | active=0, waiting=10 | NO_ACTIVE_WORKERS alert |
| Health aggregation | multiple issues | health = worst severity |
| Periodic monitoring | interval=60s | checks executed periodically |