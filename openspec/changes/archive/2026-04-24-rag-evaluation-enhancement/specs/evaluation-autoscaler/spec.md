---
capability: evaluation-autoscaler
version: 1.0
created: 2026-04-24
---

# Spec: Evaluation Autoscaler

## 概述

Worker 自动扩展器根据队列负载动态调整 Worker replicas 数量。

## ADDED Requirements

### Requirement: Scale Up Decision

系统 SHALL 在队列积压时自动增加 Worker replicas。

#### Scenario: Scale up triggered by backlog
- **WHEN** queue.waiting > scaleUpThreshold (50)
- **AND** currentReplicas < maxReplicas (10)
- **THEN** scaleTo() called with increased replicas
- **AND** target replicas = min(ceil(waiting / 20), maxReplicas)

#### Scenario: Scale up calculation
- **WHEN** waiting = 75 tasks
- **THEN** target replicas = ceil(75/20) = 4
- **AND** scaleTo(4) executed

#### Scenario: Scale up max limit
- **WHEN** waiting = 250 tasks
- **THEN** target replicas = min(ceil(250/20), 10) = 10
- **AND** cannot exceed maxReplicas

#### Scenario: Scale up log
- **WHEN** scale up executed
- **THEN** scale event logged
- **AND** includes: fromReplicas, toReplicas, reason, timestamp

### Requirement: Scale Down Decision

系统 SHALL 在队列空闲时自动减少 Worker replicas。

#### Scenario: Scale down triggered by idle
- **WHEN** queue.waiting < scaleDownThreshold (5)
- **AND** queue.active < 2
- **AND** currentReplicas > minReplicas (1)
- **AND** cooldown period elapsed (5 minutes since last scale)
- **THEN** scaleTo(minReplicas) executed

#### Scenario: Scale down blocked by cooldown
- **WHEN** scale down conditions met
- **AND** lastScaleTime within cooldown period
- **THEN** scale down NOT executed
- **AND** waiting for cooldown

#### Scenario: Scale down blocked by active tasks
- **WHEN** waiting < 5
- **AND** active > 2
- **THEN** scale down NOT executed
- **AND** waiting for tasks to complete

### Requirement: Cooldown Period

系统 SHALL 强制缩容冷却期防止频繁波动。

#### Scenario: Cooldown after scale up
- **WHEN** scale up executed
- **THEN** lastScaleTime set to current timestamp
- **AND** scale down blocked for cooldownPeriod (5 minutes)

#### Scenario: Cooldown configuration
- **WHEN** autoscaler configured
- **THEN** cooldownPeriod customizable via config or env var
- **AND** default value: 300000ms (5 minutes)

### Requirement: Min/Max Replicas Constraints

系统 SHALL 限制 replicas 在配置范围内。

#### Scenario: Min replicas enforced
- **WHEN** scale down would result in replicas < minReplicas
- **THEN** replicas set to minReplicas
- **AND** cannot scale below min

#### Scenario: Max replicas enforced
- **WHEN** scale up would result in replicas > maxReplicas
- **THEN** replicas set to maxReplicas
- **AND** cannot scale above max

#### Scenario: Configurable limits
- **WHEN** autoscaler configured
- **THEN** minReplicas and maxReplicas customizable
- **AND** defaults: min=1, max=10

### Requirement: Docker API Integration

系统 SHALL 通过 Docker API 调整服务规模。

#### Scenario: Scale via Docker Compose
- **WHEN** scaleTo(count) called
- **THEN** docker-compose command executed:
  `docker-compose up -d --scale evaluation-worker={count}`
- **AND** command success verified

#### Scenario: Docker API alternative
- **WHEN** Docker API available (Docker Swarm mode)
- **THEN** docker.serviceScale('evaluation-worker', count) called
- **AND** API response verified

#### Scenario: Scale failure handling
- **WHEN** Docker command fails
- **THEN** error logged
- **AND** SCALE_FAILURE alert created
- **AND** retry scheduled

### Requirement: Current Replicas Query

系统 SHALL 获取当前 Worker 数量。

#### Scenario: Query via Docker
- **WHEN** getCurrentReplicas() called
- **THEN** Docker containers listed with name filter 'evaluation-worker'
- **AND** count returned

#### Scenario: Query via Docker Compose
- **WHEN** docker-compose ps executed
- **THEN** parse output to count evaluation-worker containers
- **AND** count returned

### Requirement: Manual Override

系统 SHALL 支持手动触发扩缩容。

#### Scenario: Manual scale up
- **WHEN** POST /api/scaler/scale called with { replicas: 5 }
- **THEN** scaleTo(5) executed immediately
- **AND** lastScaleTime updated
- **AND** manual override logged

#### Scenario: Manual scale down
- **WHEN** POST /api/scaler/scale called with { replicas: 1 }
- **THEN** cooldown period bypassed for manual command
- **AND** scaleTo(1) executed

#### Scenario: Manual disable autoscaler
- **WHEN** POST /api/scaler/disable called
- **THEN** autoscaler paused
- **AND** no automatic scaling
- **AND** manual scaling still available

### Requirement: Scale Event Logging

系统 SHALL 记录所有扩缩容事件。

#### Scenario: Scale event storage
- **WHEN** scale executed (auto or manual)
- **THEN** event stored in scale_events table or log file
- **AND** includes: from, to, reason, trigger (auto/manual), timestamp

#### Scenario: Scale event query
- **WHEN** GET /api/scaler/history called
- **THEN** returns recent scale events
- **AND** sorted by timestamp descending

### Requirement: Status API

系统 SHALL 提供扩缩容状态 API。

#### Scenario: Get scaler status
- **WHEN** GET /api/scaler/status called
- **THEN** returns:
  - enabled: boolean
  - currentReplicas: number
  - minReplicas: number
  - maxReplicas: number
  - lastScaleTime: timestamp
  - lastScaleReason: string

#### Scenario: Get scaler config
- **WHEN** GET /api/scaler/config called
- **THEN** returns current configuration
- **AND** includes thresholds and intervals

## 类型导入

本 spec 使用 `shared-types/spec.md` 中定义的类型：

```typescript
import {
  AlertType,
  AlertDetailsMap,
  SeverityThresholds
} from './shared-types/spec.md';
```

SCALE_FAILURE 告警使用 shared-types 中定义的结构：

```typescript
// SCALE_FAILURE 告警 details 结构
interface ScaleFailureDetails {
  targetReplicas: number;
  error: string;
  dockerResponse?: string;
}
```

## 数据模型

```typescript
interface AutoscalerConfig {
  minReplicas: number;        // default: 1
  maxReplicas: number;        // default: 10
  scaleUpThreshold: number;   // default: 50
  scaleDownThreshold: number; // default: 5
  cooldownPeriod: number;     // default: 300000ms
  checkInterval: number;      // default: 60000ms
}

interface ScaleEvent {
  eventId: string;
  from: number;
  to: number;
  reason: string;
  trigger: 'auto' | 'manual';
  timestamp: string;
}

interface ScalerStatus {
  enabled: boolean;
  currentReplicas: number;
  minReplicas: number;
  maxReplicas: number;
  lastScaleTime: string;
  lastScaleReason: string;
  cooldownRemaining?: number;
}
```

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/scaler/status` | GET | 获取扩缩容状态 |
| `/api/scaler/config` | GET | 获取扩缩容配置 |
| `/api/scaler/scale` | POST | 手动触发扩缩容 |
| `/api/scaler/disable` | POST | 禁用自动扩缩容 |
| `/api/scaler/enable` | POST | 启用自动扩缩容 |
| `/api/scaler/history` | GET | 获取扩缩容历史 |

## 测试场景

| 场景 | 输入 | 验证点 |
|------|------|--------|
| Scale up trigger | waiting=75 | scaleTo(4) executed |
| Scale up max limit | waiting=250 | scaleTo(10) max reached |
| Scale down trigger | waiting=3, active=1 | scaleTo(1) after cooldown |
| Cooldown block | lastScaleTime < cooldown | scale down blocked |
| Manual scale | POST scale=5 | scaleTo(5) immediately |
| Docker failure | Docker error | SCALE_FAILURE alert |
| Status query | GET status | currentReplicas returned |