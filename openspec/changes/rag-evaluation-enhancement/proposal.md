---
name: rag-evaluation-enhancement
description: RAG 评估系统四大支柱增强 - Layer 3 LLM驱动、告警机制、反馈闭环、Worker扩展
created: 2026-04-24
status: proposed
---

# Proposal: RAG Evaluation Enhancement

## Why

当前 RAG 评估系统存在四个关键短板，影响医疗场景的安全性和准确性：

1. **Layer 3 评估质量不足** — Evidence Traceability、Completeness、Terminology Accuracy 三个指标使用规则驱动而非 LLM 驱动，无法真正评估答案质量。正则匹配无法识别虚假引用，启发式规则无法判断子问题覆盖。

2. **缺乏告警机制** — 评估结果只存储不告警，当 safetyAssessment < 0.5 或 faithfulness < 0.5 时，危险答案可能被忽略。医疗场景中错误建议可能导致严重后果。

3. **无反馈闭环** — 评估数据终止于 Dashboard，无回流到系统改进。低质量答案没有后续处理，系统无法从评估数据中学习，无法触发检索策略调整。

4. **Worker 扩展受限** — 单 Worker (replicas=1) 无法处理高峰负载，吞吐量限制在 10 tasks/min。LLM API 延迟是主要瓶颈，无法根据队列深度自动扩展。

**为什么现在做？** 医疗 AI 系统的安全性是底线需求，评估准确性直接影响用户信任，反馈闭环是长期演进的基础。当前评估系统已运行稳定，增强时机成熟。

## What Changes

### P0 - 安全保障 (立即实施)

- **新增告警机制**: 阈值检测 + WebSocket 广播 + SQLite 存储
- **新增 Human Review Queue**: 人工审核队列，REST API + Dashboard 入口
- **Safety 告警优先**: `safetyAssessment < 0.5` → critical alert + 阻止答案发布
- **Worker 手动扩容**: replicas 临时调整为 2，concurrency 增加到 4

### P1 - 准确性提升 (本周完成)

- **Layer 3 批量 LLM 评估**: 一次 LLM 调用评估 Evidence/Completeness/Terminology
- **条件触发机制**: 只在特定情况下启用 Layer 3 LLM 评估，节省成本
- **Faithfulness 告警**: `faithfulness < 0.5` → 触发二次检索建议
- **队列健康监控**: 失败率告警 + Dashboard 显示队列状态

### P2 - 基础设施 (下周完成)

- **自定义 Autoscaler**: 基于 Redis 队列深度动态调整 Worker replicas
- **FeedbackAnalyzer**: 评估结果分析 + Adjustment 信号生成
- **会话级配置存储**: 动态调整检索参数 (topK/threshold)

### P3 - 长期能力 (后续演进)

- **ActionExecutor**: 自动执行反馈动作 (检索参数调整)
- **多队列分流**: critical/normal/batch 三队列分流
- **Ground Truth Builder**: 从审核结果构建测试集

## Capabilities

### New Capabilities

- `evaluation-alerts`: 告警机制 — 阈值检测、WebSocket 广播、SQLite 存储、告警事件管理
- `human-review-queue`: 人工审核队列 — 添加/获取/分配/解决审核项、REST API、Dashboard 入口
- `layer3-llm-evaluation`: Layer 3 LLM 驱动评估 — 批量 Prompt 设计、条件触发逻辑、Evidence/Completeness/Terminology 真正验证
- `queue-health-monitor`: 队列健康监控 — 失败率检测、队列深度监控、Worker 活跃度检查、健康状态报告
- `evaluation-autoscaler`: Worker 自动扩展 — 队列深度检测、扩缩容决策、Docker API 集成、冷却期管理
- `feedback-analyzer`: 反馈分析器 — 评估结果分析、Adjustment 信号生成、趋势检测

### Modified Capabilities

- `rag-evaluation-tracing-system` (existing in openspec/changes/): 扩展评估流水线，增加告警触发和反馈分析
- `safety-layer` (existing spec): 与告警机制集成，`severity = 'absolute'` 时触发 critical alert

## Impact

### 代码影响

| 模块 | 改动 |
|------|------|
| `src/evaluation/MedicalEvaluationPipeline.ts` | 增加 Layer3Evaluator 类，批量 LLM 调用 |
| `src/alert/` (新增) | AlertHandler, AlertEvent, AlertBroadcaster |
| `src/feedback/` (新增) | FeedbackAnalyzer, HumanReviewQueue, Adjustment |
| `src/scaler/` (新增) | EvaluationAutoscaler, DockerApi 集成 |
| `src/monitor/` (新增) | QueueHealthMonitor |
| `src/tracing/TraceStorage.ts` | 增加 alerts 和 human_review_queue 表 |
| `src/tracing/MetricsAggregator.ts` | 增加告警检查逻辑 |
| `src/server/routes/` (新增) | `/api/alerts`, `/api/review`, `/api/scaler` |
| `docker-compose.yml` | Worker replicas 配置优化 |

### API 影响

新增 REST API 端点:
- `GET /api/alerts` — 获取告警列表
- `GET /api/alerts/:id` — 获取告警详情
- `POST /api/alerts/:id/acknowledge` — 确认告警
- `GET /api/review/pending` — 获取待审核列表
- `POST /api/review/:id/assign` — 分配审核人员
- `POST /api/review/:id/approve` — 批准审核
- `GET /api/scaler/status` — 获取扩缩容状态
- `GET /api/queue/health` — 获取队列健康状态

### 依赖影响

- 无新增外部依赖 (使用现有 SQLite、Redis、Docker)
- LLM API 调用增加 (Layer 3 批量评估)
- Redis 队列监控需求

### 系统影响

- 评估延迟略增 (Layer 3 LLM 调用，约 1-2s)
- 告警实时性要求 WebSocket 连接
- 人工审核需要运维流程配合

## Success Criteria

| 指标 | 当前 | 目标 |
|------|------|------|
| Layer 3 LLM 评估覆盖 | 0% (规则驱动) | 100% (条件触发下 LLM 驱动) |
| Safety 告警响应时间 | 无告警 | < 1s (WebSocket push) |
| Human Review Queue 可用性 | 无 | 100% (REST API + Dashboard) |
| Worker 扩容响应时间 | 手动 (分钟级) | < 1min (自动扩缩容) |
| 评估结果反馈闭环 | 无 | Adjustment 信号生成 |

## Risks

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Layer 3 LLM 调用增加成本 | 成本上升 20-30% | 条件触发机制 + 批量 Prompt |
| 告警风暴 | WebSocket 负载增加 | 告警聚合 + 速率限制 |
| 人工审核积压 | 运维压力 | 优先级分级 + 自动化预处理 |
| Autoscaler 过度扩容 | 成本浪费 | 冷却期 + maxReplicas 限制 |
| LLM 评估不稳定 | 结果波动 | 多次评估 + fallback 规则 |

## References

- `docs/rag-evaluation-system-evolution.md` — 架构演进路线图详细设计
- `docs/rag-evaluation-guide.md` — 评估系统使用指南
- `openspec/changes/rag-evaluation-tracing-system/` — 原评估系统设计
- `openspec/specs/safety-layer/spec.md` — Safety Layer 规格