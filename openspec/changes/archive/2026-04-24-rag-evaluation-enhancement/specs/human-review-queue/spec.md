---
capability: human-review-queue
version: 1.0
created: 2026-04-24
---

# Spec: Human Review Queue

## 概述

人工审核队列管理需要人工审核的评估结果，支持分配、审核、解决流程。

## ADDED Requirements

### Requirement: Review Item Creation

系统 SHALL 在 Safety Critical 告警触发时自动创建审核项。

#### Scenario: Safety critical creates review item
- **WHEN** SAFETY_CRITICAL alert created
- **THEN** review item automatically added to queue
- **AND** priority set to 'critical'
- **AND** reason set to alert.details

#### Scenario: Manual review item creation
- **WHEN** POST /api/review called with traceId and reason
- **THEN** review item created with specified priority
- **AND** status initialized as 'pending'

### Requirement: Review Item Storage

系统 SHALL 持久化审核项到 SQLite。

#### Scenario: Review item persisted
- **WHEN** review item created
- **THEN** stored in human_review_queue table
- **AND** reviewId generated as unique ID
- **AND** createdAt timestamp recorded

#### Scenario: Review item status update
- **WHEN** review item status changed
- **THEN** status field updated
- **AND** relevant timestamp recorded (assignedAt, reviewedAt, resolvedAt)

### Requirement: Pending Review Query

系统 SHALL 提供查询待审核项的 API。

#### Scenario: Get all pending reviews
- **WHEN** GET /api/review/pending called
- **THEN** returns list of pending review items
- **AND** sorted by priority (critical first) then createdAt (oldest first)
- **AND** supports pagination

#### Scenario: Get pending by priority
- **WHEN** GET /api/review/pending?priority=critical called
- **THEN** returns only critical priority items

#### Scenario: Get pending count
- **WHEN** GET /api/review/count called
- **THEN** returns count by status: { pending, assigned, reviewed, resolved }
- **AND** returns count by priority: { critical, high, medium, low }

### Requirement: Review Assignment

系统 SHALL 支持分配审核项给审核人员。

#### Scenario: Assign review to user
- **WHEN** POST /api/review/:id/assign called with userId
- **THEN** review item status updated to 'assigned'
- **AND** assignedTo field set to userId
- **AND** assignedAt timestamp recorded

#### Scenario: Reassign review
- **WHEN** POST /api/review/:id/assign called with new userId
- **THEN** assignedTo updated to new userId
- **AND** previous assignment logged in reviewNotes

### Requirement: Review Approval

系统 SHALL 支持审核人员批准审核项。

#### Scenario: Approve review
- **WHEN** POST /api/review/:id/approve called with notes
- **THEN** status updated to 'resolved'
- **AND** resolutionAction set to 'approve'
- **AND** reviewNotes appended
- **AND** resolvedAt timestamp recorded

#### Scenario: Approve with modification suggestion
- **WHEN** approve called with modification suggestions in notes
- **THEN** suggestions stored for future Ground Truth building

### Requirement: Review Rejection

系统 SHALL 支持审核人员拒绝审核项。

#### Scenario: Reject review
- **WHEN** POST /api/review/:id/reject called with reason
- **THEN** status updated to 'resolved'
- **AND** resolutionAction set to 'reject'
- **AND** rejectionReason recorded

#### Scenario: Reject triggers answer modification
- **WHEN** review rejected
- **THEN** original answer marked as 'needs_modification'
- **AND** rejectionReason forwarded to agent system

### Requirement: Review Notes

系统 SHALL 支持添加审核备注。

#### Scenario: Add review notes
- **WHEN** POST /api/review/:id/notes called with notes content
- **THEN** notes appended to reviewNotes field
- **AND** timestamp and userId recorded

### Requirement: Review SLA Monitoring

系统 SHALL 监控审核项的处理时间。

#### Scenario: SLA breach detection
- **WHEN** review item pending > 24 hours
- **THEN** system creates REVIEW_SLA_BREACH alert
- **AND** priority upgraded to 'high'

#### Scenario: Critical review SLA
- **WHEN** critical review pending > 4 hours
- **THEN** system creates REVIEW_CRITICAL_SLA alert
- **AND** notifies Ops team

## 类型导入

本 spec 使用 `shared-types/spec.md` 中定义的类型：

```typescript
import {
  ReviewStatus,
  ReviewStatusFlow,
  AlertType
} from './shared-types/spec.md';
```

## 数据模型

ReviewItem.status 使用 shared-types 中定义的 ReviewStatus 枚举，状态流转遵循 ReviewStatusFlow：

```
pending → assigned → reviewed → resolved (via approve/reject)
pending → pending (SLA_BREACH trigger → priority upgrade)
```

```typescript
interface ReviewItem {
  reviewId: string;
  traceId: string;
  evaluationId: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  status: ReviewStatus;  // 使用 shared-types ReviewStatus
  assignedTo?: string;
  assignedAt?: number;
  reviewNotes?: string;
  resolutionAction?: 'approve' | 'reject' | 'modify';
  resolvedAt?: number;
  createdAt: number;
}

interface ReviewCount {
  byStatus: {
    pending: number;
    assigned: number;
    reviewed: number;
    resolved: number;
  };
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}
```

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/review/pending` | GET | 获取待审核列表 |
| `/api/review/count` | GET | 获取审核项计数 |
| `/api/review/:id` | GET | 获取审核项详情 |
| `/api/review` | POST | 手动创建审核项 |
| `/api/review/:id/assign` | POST | 分配给审核人员 |
| `/api/review/:id/approve` | POST | 批准审核 |
| `/api/review/:id/reject` | POST | 拒绝审核 |
| `/api/review/:id/notes` | POST | 添加审核备注 |

## 测试场景

| 场景 | 输入 | 验证点 |
|------|------|--------|
| Safety critical auto-create | SAFETY_CRITICAL alert | review item created with priority=critical |
| Get pending | GET pending | 返回按优先级排序的列表 |
| Assign review | POST assign | status=assigned, assignedTo set |
| Approve review | POST approve | status=resolved, resolutionAction=approve |
| SLA breach | pending > 24h | REVIEW_SLA_BREACH alert created |