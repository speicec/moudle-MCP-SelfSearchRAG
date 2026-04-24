---
name: rag-evaluation-enhancement
description: RAG 评估系统四大支柱增强 - 技术设计文档
created: 2026-04-24
---

# Design: RAG Evaluation Enhancement

## Context

### 当前状态

RAG 评估系统已实现三层评估架构：
- **Layer 1 (RAGAS)**: Faithfulness、Context Relevance、Answer Relevance — LLM 驱动 ✅
- **Layer 2 (医疗核心)**: Medical Accuracy、Safety Assessment — LLM 驱动 ✅
- **Layer 3 (医疗增强)**: Evidence Traceability、Completeness、Terminology Accuracy — 规则驱动 ❌

评估结果存储到 SQLite (traces.db)，通过 MetricsAggregator 推送到 Dashboard。

### 关键约束

1. **安全性优先**: 医疗场景错误建议可能导致严重后果，告警机制必须实时可靠
2. **成本控制**: LLM 调用每评估约 10-20 次，Layer 3 增强需优化调用次数
3. **最小改动原则**: 不破坏现有 MedicalAgent 和 EvaluationPipeline 功能
4. **渐进演进**: P0-P2 分阶段实施，每阶段可独立上线验证

### 相关系统

- **Safety Layer** (`openspec/specs/safety-layer/`): 禁忌检查、证据评估
- **Evaluation Queue** (`src/queue/`): Bull + Redis 异步评估
- **TraceStorage** (`src/tracing/TraceStorage.ts`): SQLite 持久化
- **MetricsAggregator** (`src/tracing/MetricsAggregator.ts`): WebSocket 推送

## Goals / Non-Goals

**Goals:**

1. Layer 3 真正 LLM 驱动评估，提高评估准确性
2. 实时告警机制，Safety/Faithfulness 低分立即通知
3. Human Review Queue MVP，危险答案人工审核
4. 队列健康监控，失败率和积压告警
5. 自定义 Autoscaler，根据负载动态扩展 Worker
6. FeedbackAnalyzer MVP，生成 Adjustment 信号

**Non-Goals:**

1. Kubernetes HPA 集成 (Phase 3 考虑)
2. 多队列分流 (critical/normal/batch)
3. ActionExecutor 自动调整检索参数 (P3)
4. Ground Truth Builder (P3)
5. Slack/Email 告警通知 (先实现 WebSocket，后续扩展)
6. OpenTelemetry 导出 (已有 TraceExporter，本次不扩展)

## Shared Types

本设计使用 `specs/shared-types/spec.md` 中定义的统一类型：

- **AlertType**: 17 种告警类型枚举，覆盖评估、队列、审核、系统四大类
- **AlertDetailsMap**: 每种 AlertType 对应的具体 details 结构
- **AlertSeverity**: 'critical' | 'warning' | 'info'
- **AlertStatus**: 'active' | 'acknowledged' | 'resolved'
- **ReviewStatus**: 'pending' | 'assigned' | 'reviewed' | 'resolved'
- **FlagToAlertMapping**: FeedbackAnalyzer Flag 与 Alert 的映射
- **SeverityThresholds**: 统一阈值配置
- **SessionConfigStoreStrategy**: Redis/in-memory 存储选择策略
- **Layer3LLMResponse / Layer3SystemResult**: Layer3 命名约定

所有 spec 文件应从 shared-types 导入类型，避免重复定义和循环依赖。

## Decisions

### D1: Layer 3 批量 Prompt vs 单独调用

**决策**: 使用批量 Prompt，一次 LLM 调用评估三个指标

**理由**:
| 因素 | 批量 Prompt | 单独调用 |
|------|-------------|----------|
| API 调用次数 | 1 次 | 3 次 |
| 成本 | ~0.5x | ~1.5x |
| 延迟 | ~1-2s | ~3-5s |
| 上下文共享 | ✅ 同一上下文 | ❌ 重复传递 |
| 失败影响 | 整体失败 | 可部分 fallback |

**备选方案**: 条件触发机制，只在特定情况下启用 Layer 3 LLM 评估
- faithfulness < 0.7 → 启用 Evidence Traceability
- 查询包含多个实体 → 启用 Completeness
- 答案包含专业术语 → 启用 Terminology

**最终方案**: 批量 Prompt + 条件触发，兼顾成本和准确性

### D2: 告警机制存储 vs 仅 WebSocket 推送

**决策**: SQLite 存储 + WebSocket 推送

**理由**:
- SQLite 存储: 支持历史查询、告警状态管理 (active/resolved)、审计日志
- WebSocket 推送: 实时通知前端 Dashboard，支持 AlertCard 展示
- 两者结合: 保证实时性同时保留历史记录

**告警表设计** (AlertType 和 details_json 结构定义在 shared-types/spec.md):
```sql
CREATE TABLE alerts (
  alert_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,           -- AlertType 枚举值 (17种类型)
  severity TEXT NOT NULL,       -- AlertSeverity: critical, warning, info
  trace_id TEXT,
  evaluation_id TEXT,
  details_json TEXT,            -- AlertDetailsMap[type] 的 JSON 序列化
  suggested_actions_json TEXT,
  status TEXT DEFAULT 'active', -- AlertStatus: active, acknowledged, resolved
  acknowledged_by TEXT,
  resolved_at TEXT
);

-- 建议索引
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
```

### D3: Human Review Queue MVP 设计

**决策**: SQLite 存储 + REST API + Dashboard 入口

**审核流程**:
```
EvaluationResult → AlertHandler → SAFETY_CRITICAL alert
                                    ↓
                            HumanReviewQueue.add()
                                    ↓
                            Dashboard ReviewPanel
                                    ↓
                            审核人员 Assign → Review → Approve/Reject
                                    ↓
                            Audit Log + Ground Truth (P3)
```

**API 设计**:
- `GET /api/review/pending?priority=critical` — 获取待审核列表
- `POST /api/review/:id/assign` — 分配给审核人员
- `POST /api/review/:id/approve` — 标记为已审核通过
- `POST /api/review/:id/reject` — 标记为需要修改

### D4: 自定义 Autoscaler vs Kubernetes HPA

**决策**: 自定义 Autoscaler (Phase 2)，K8s HPA 留待 Phase 3

**理由**:
| 因素 | 自定义 Autoscaler | K8s HPA |
|------|-------------------|---------|
| 当前架构适配 | ✅ Docker Compose | ❌ 需迁移 K8s |
| 实现难度 | 中 | 高 |
| 控制精度 | ✅ 业务逻辑精确控制 | ❌ 通用指标 |
| 学习成本 | 低 | 高 |

**扩缩容策略**:
```typescript
interface AutoscalerConfig {
  minReplicas: 1;
  maxReplicas: 10;
  scaleUpThreshold: 50;    // waiting > 50 → scale up
  scaleDownThreshold: 5;   // waiting < 5 + active < 2 → scale down
  cooldownPeriod: 300000;  // 5分钟冷却期
  checkInterval: 60000;    // 1分钟检查
}
```

### D5: FeedbackAnalyzer Adjustment 作用域

**决策**: 会话级配置存储，不持久化到全局

**理由**:
- 会话级: 调整仅对当前会话后续查询生效，1小时后过期
- 避免: 单次低分影响所有用户，需要人工确认才全局生效
- 实现: Redis 或内存存储，key = `session:{sessionId}:config`

**Adjustment 信号类型** (定义在 shared-types/spec.md 的 Adjustment 接口):
```typescript
interface Adjustment {
  target: 'retrieval' | 'generation' | 'evaluation';
  change: Record<string, unknown>;
  reason: string;
  expiresAt: number;  // 过期时间 (1小时后)
}

// 存储策略遵循 SessionConfigStoreStrategy:
// - Redis 可用时: key = session:{sessionId}:config, TTL = 1 hour
// - Redis 不可用时: in-memory Map with setTimeout cleanup
```

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    RAG 评估系统增强架构                                            │
└─────────────────────────────────────────────────────────────────────────────────┘

                              评估流程 (增强后)
                              ═════════════════════

    ┌──────────┐      ┌──────────────┐      ┌───────────────┐      ┌──────────────┐
    │ Agent    │─────▶│ Evaluation   │─────▶│    Redis      │─────▶│ Evaluation   │
    │ Executor │      │   Queue      │      │   (Bull)      │      │   Worker     │
    └──────────┘      │ (生产者)     │      └───────────────┘      │  (消费者)    │
                       └──────────────┘              │              └──────────────┘
                                                     │                      │
                                                     │                      │
                                                     ▼                      ▼
                                              ┌───────────────┐      ┌──────────────────┐
                                              │ QueueHealth   │      │ Medical Eval     │
                                              │ Monitor       │      │ Pipeline         │
                                              │ (新增 P1)     │      │ (增强 Layer3)    │
                                              └───────────────┘      └──────────────────┘
                                                     │                      │
                                                     │                      │
                                                     ▼                      ▼
                                              ┌───────────────┐      ┌──────────────────┐
                                              │ AlertHandler  │◀────▶│ TraceStorage     │
                                              │ (新增 P0)     │      │ (新增表)         │
                                              └───────────────┘      └──────────────────┘
                                                     │                      │
                     ┌───────────────────────────────┼──────────────────────┘
                     │                               │
                     ▼                               ▼
              ┌───────────────┐              ┌──────────────────┐
              │ WebSocket     │              │ Human Review     │
              │ Broadcast     │              │ Queue (新增 P0)  │
              │               │              │                  │
              └──────┬────────┘              └────────┬─────────┘
                     │                                │
                     ▼                                ▼
              ┌───────────────┐              ┌──────────────────┐
              │ Dashboard     │              │ FeedbackAnalyzer │
              │ AlertCard     │              │ (新增 P2)        │
              │               │              │                  │
              └───────────────┘              └────────┬─────────┘
                                                     │
                                                     ▼
                                              ┌──────────────────┐
                                              │ Session Config   │
                                              │ Store (Redis)    │
                                              │                  │
                                              └──────────────────┘

                              Worker 扩展架构 (P2)
                              ══════════════════════

    ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
    │ QueueHealth       │─────▶│ Autoscaler        │─────▶│ Docker API        │
    │ Monitor           │      │ Decision          │      │                   │
    │                   │      │                   │      │                   │
    └──────┬────────────┘      └──────┬────────────┘      └────────┬──────────┘
           │                          │                            │
           ▼                          ▼                            ▼
    ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
    │ Redis Queue       │      │ Scale Event Log   │      │ Worker Containers │
    │ Stats             │      │                   │      │ replicas: 1..10   │
    │                   │      │                   │      │                   │
    └───────────────────┘      └───────────────────┘      └───────────────────┘
```

### 模块依赖关系

```
                    MedicalEvaluationPipeline
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    Layer3Evaluator    TraceStorage      MetricsAggregator
         │                   │                   │
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                       AlertHandler
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    WebSocketBroadcaster HumanReviewQueue   AuditLog
                             │
                             ▼
                       FeedbackAnalyzer
                             │
                             ▼
                       SessionConfigStore

    EvaluationQueue
         │
         ▼
    QueueHealthMonitor
         │
         ▼
    EvaluationAutoscaler
         │
         ▼
    DockerApi
```

## Risks / Trade-offs

### R1: Layer 3 LLM 调用成本上升

**风险**: 批量 Prompt 虽减少调用次数，但每次调用 Prompt 更长，token 消耗增加

**缓解**:
- 条件触发机制: 只在需要时启用 LLM 评估
- Prompt 长度控制: 截取答案和 chunks 到合理长度 (各 2000 chars)
- 成本监控: 记录每次评估的 token 消耗，设置阈值告警

### R2: 告警风暴导致 WebSocket 负载过高

**风险**: 高峰期大量评估触发告警，WebSocket 连接可能过载

**缓解**:
- 告警聚合: 相同类型告警 5 分钟内合并
- 速率限制: 每分钟最多推送 10 条告警
- 优先级过滤: 只推送 critical/warning 级别告警

### R3: Human Review Queue 积压

**风险**: 审核人员不足，审核项积压影响系统可用性

**缓解**:
- 优先级分级: critical > high > medium > low
- 自动预处理: 低优先级可自动标记为已审核 (rules-based)
- SLA 监控: 超过 24h 未审核自动升级告警

### R4: Autoscaler 过度扩缩容

**风险**: 扩容后未及时缩容，成本浪费；缩容过快影响吞吐

**缓解**:
- 冷却期: 缩容前等待 5 分钟观察
- maxReplicas: 最大 10 个 Worker，防止过度扩容
- 人工干预 API: 支持手动强制扩缩容

### R5: LLM 评估结果不稳定

**风险**: LLM 输出可能格式错误或结果波动

**缓解**:
- JSON 解析 fallback: 解析失败使用规则评估
- 多次评估取平均: 重要指标评估 2 次
- 结果缓存: 相似输入使用缓存结果

## Migration Plan

### Phase 1 (P0 - 安全保障)

1. **告警机制部署**
   - 新增 AlertHandler 模块
   - TraceStorage 新增 alerts 表
   - WebSocket Broadcaster 集成
   - Dashboard AlertCard 组件

2. **Human Review Queue 部署**
   - 新增 human_review_queue 表
   - REST API 端点实现
   - Dashboard ReviewPanel 组件

3. **Worker 配置调整**
   - docker-compose.yml replicas: 2
   - concurrency: 4
   - limiter 放宽

**回滚策略**: AlertHandler 可独立禁用，不影响评估流程

### Phase 2 (P1 - 准确性提升)

1. **Layer3Evaluator 部署**
   - 替换 MedicalEvaluationPipeline Layer 3 实现
   - 条件触发逻辑集成
   - 成本监控开启

2. **QueueHealthMonitor 部署**
   - 新增 monitor 模块
   - Dashboard 队列状态展示

**回滚策略**: Layer3Evaluator 可 fallback 到规则评估

### Phase 3 (P2 - 基础设施)

1. **EvaluationAutoscaler 部署**
   - 新增 scaler 模块
   - Docker API 集成
   - 手动触发 API 实现

2. **FeedbackAnalyzer 部署**
   - 新增 feedback 模块
   - Session Config Store 集成

**回滚策略**: Autoscaler 可手动禁用，Worker 固定 replicas

## Open Questions

1. **告警通知扩展**: Slack/Email 告警是否需要 P0 实现？还是留待后续？
   - 建议: 先实现 WebSocket，后续按需扩展

2. **审核人员管理**: 是否需要审核人员认证机制？
   - 建议: MVP 不需要，后续可加简单认证

3. **Ground Truth 构建**: 从审核结果构建测试集的时机？
   - 建议: P3 考虑，积累足够审核数据后

4. **多模型评估**: 是否需要支持 Claude/GPT-4 作为评估模型？
   - 建议: 先用 DeepSeek，后续可扩展

5. **成本阈值**: LLM 调用成本告警阈值如何设定？
   - 建议: 每日成本 > $50 时告警，根据实际情况调整