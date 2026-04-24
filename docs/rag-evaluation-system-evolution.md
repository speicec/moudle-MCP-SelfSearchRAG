# RAG 评估系统架构演进路线图

> 本文档记录 RAG Evaluation Worker 系统的当前架构分析、改进方案、实施路线和可演进方向。
>
> 核心原则：**安全性优先 > 准确性优先 > 长期演进能力**

---

## 目录

1. [当前架构分析](#1-当前架构分析)
2. [四大改进方向](#2-四大改进方向)
3. [实施路线图](#3-实施路线图)
4. [可演进方向](#4-可演进方向)
5. [附录：技术决策记录](#5-附录技术决策记录)

---

## 1. 当前架构分析

### 1.1 系统概览

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    RAG-Evaluation-Worker 评估系统架构                            │
└─────────────────────────────────────────────────────────────────────────────────┘

                              数据流向
    ════════════════════════════════════════════════════════════════════════════════

    ┌──────────┐      ┌──────────────┐      ┌───────────────┐      ┌──────────────┐
    │ Agent    │─────▶│ Evaluation   │─────▶│    Redis      │─────▶│ Evaluation   │
    │ Executor │      │   Queue      │      │   (Bull)      │      │   Worker     │
    └──────────┘      │ (生产者)     │      └───────────────┘      │  (消费者)    │
                       └──────────────┘              │              └──────────────┘
                                                     │                      │
                                                     │                      │
                                                     ▼                      ▼
                                              Job: {traceId,          ┌──────────────┐
                                                    traceData,         │ Medical      │
                                                    priority}          │ Evaluation   │
                                                     │                 │ Pipeline     │
                                                     │                 └──────────────┘
                                                     │                      │
                                                     │                      ▼
                                                     │              ┌──────────────────┐
                                                     │              │  三层评估架构     │
                                                     │              ├──────────────────┤
                                                     │              │                  │
                                                     │              │ Layer 1: RAGAS   │
                                                     │              │ ├─ Faithfulness  │
                                                     │              │ ├─ ContextRelev  │
                                                     │              │ └─ AnswerRelev   │
                                                     │              │                  │
                                                     │              │ Layer 2: 医疗核心 │
                                                     │              │ ├─ MedicalAccur  │
                                                     │              │ └─ SafetyAssess  │
                                                     │              │                  │
                                                     │              │ Layer 3: 医疗增强 │
                                                     │              │ ├─ EvidenceTrace │
                                                     │              │ ├─ Completeness  │
                                                     │              │ └─ TerminologyAc │
                                                     │              └──────────────────┘
                                                     │                      │
                                                     │                      ▼
                                                     │              ┌──────────────────┐
                                                     │              │ LLM (DeepSeek)   │
                                                     │              │ deepseek-reasoner│
                                                     │              └──────────────────┘
                                                     │                      │
                                                     │                      ▼
                                                     └──────────────▶┌──────────────────┐
                                                                     │ TraceStorage     │
                                                                     │ (SQLite)         │
                                                                     │ traces.db        │
                                                                     └──────────────────┘
```

### 1.2 核心组件

| 组件 | 文件位置 | 功能 |
|------|----------|------|
| EvaluationQueue | `src/queue/EvaluationQueue.ts` | Bull 队列管理，任务提交 |
| EvaluationWorker | `src/queue/EvaluationWorker.ts` | Worker 进程，任务消费 |
| MedicalEvaluationPipeline | `src/evaluation/MedicalEvaluationPipeline.ts` | 三层评估流水线 |
| TraceStorage | `src/tracing/TraceStorage.ts` | SQLite 持久化存储 |
| MetricsAggregator | `src/tracing/MetricsAggregator.ts` | 指标聚合，WebSocket 推送 |
| AgentEvaluationService | `src/integration/AgentEvaluationService.ts` | Agent 集成服务 |

### 1.3 三层评估架构

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          评估流水线详细流程                                  │
└────────────────────────────────────────────────────────────────────────────┘

    输入: TraceContextData
    ├── traceId: string
    ├── query: { raw, entities }
    ├── retrieval: { chunks }
    ├── answer: { text }
    └───────────────────────┐
                            ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │                    Layer 1: 基础 RAGAS 评估                            │
    ├───────────────────────────────────────────────────────────────────────┤
    │                                                                       │
    │  Faithfulness (权重 0.20)                                             │
    │  ├─ 从答案中提取声称 (LLM 提取)                                        │
    │  ├─ 对每个声称判断是否被检索内容支持 (LLM 判断)                         │
    │  └─ score = supported_count / total_claims                           │
    │                                                                       │
    │  Context Relevance (权重 0.10)                                        │
    │  ├─ 对每个 chunk 判断与 query 的相关性 (LLM 判断)                      │
    │  └─ score = avg(chunk_scores)                                        │
    │                                                                       │
    │  Answer Relevance (权重 0.10)                                         │
    │  ├─ 从答案生成 3 个可能的问题 (LLM 生成)                               │
    │  ├─ 判断生成问题与原问题的语义相似度 (LLM 判断)                         │
    │  └─ score = max(similarities)                                        │
    │                                                                       │
    │  ✅ 全部 LLM 驱动                                                     │
    └───────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │                    Layer 2: 医疗核心评估                               │
    ├───────────────────────────────────────────────────────────────────────┤
    │                                                                       │
    │  Medical Accuracy (权重 0.20)                                         │
    │  ├─ 术语使用是否正确 (LLM 判断)                                        │
    │  ├─ 是否符合临床指南规范 (LLM 判断)                                    │
    │  └─ 是否有错误的医疗建议 (LLM 判断)                                    │
    │                                                                       │
    │  Safety Assessment (权重 0.20)                                        │
    │  ├─ 禁忌建议检查 (LLM 判断)                                            │
    │  ├─ 药物相互作用风险 (LLM 判断)                                        │
    │  └─ 危险医疗建议 (LLM 判断)                                            │
    │                                                                       │
    │  ✅ 全部 LLM 驱动                                                     │
    └───────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
    ┌───────────────────────────────────────────────────────────────────────┐
    │                    Layer 3: 医疗增强评估                               │
    ├───────────────────────────────────────────────────────────────────────┤
    │                                                                       │
    │  Evidence Traceability (权重 0.10)                                    │
    │  ├─ 当前: 正则匹配检查引用 [作者 年份]                                  │
    │  ├─ 有引用=0.8, 无引用=0.5                                            │
    │  └─ ❌ 规则驱动，非 LLM                                                │
    │                                                                       │
    │  Completeness (权重 0.05)                                             │
    │  ├─ 当前: entityCoverage = 基于实体数量启发式                          │
    │  ├─ topicCoverage = answer.length > 200 ? 0.8 : 0.5                  │
    │  └─ ❌ 规则驱动，非 LLM                                                │
    │                                                                       │
    │  Terminology Accuracy (权重 0.05)                                     │
    │  ├─ 当前: 预定义 14 个术语的关键词匹配                                  │
    │  ├─ foundTerms.length > 0 ? 0.8 : 0.6                                │
    │  └─ ❌ 规则驱动，非 LLM                                                │
    │                                                                       │
    └───────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
    输出: ExtendedEvaluationResult
    ├── overallScore: number (加权平均)
    ├── riskLevel: 'safe' | 'caution' | 'warning' | 'danger'
    └── layerScores: { layer1, layer2, layer3 }
```

### 1.4 当前问题诊断

| 问题领域 | 严重程度 | 描述 |
|----------|----------|------|
| Layer 3 简化 | 🔴 高 | Evidence/Completeness/Terminology 都是规则驱动，无法真正评估质量 |
| 缺乏告警机制 | 🔴 高 | 评估结果只记录不告警，危险答案可能被忽略 |
| 无反馈闭环 | 🔴 高 | 评估数据终止于 Dashboard，无回流到系统改进 |
| Worker 固定 replicas | 🟡 中 | 单 Worker 无法处理高峰负载，吞吐受限 |
| LLM 调用开销 | 🟡 中 | 每评估 ~10-20 次 LLM 调用，成本高延迟长 |

---

## 2. 四大改进方向

### 2.1 Layer 3 增强 — 真正的 LLM 驱动评估

#### 2.1.1 问题分析

当前 Layer 3 的三个指标都是规则驱动，存在以下问题：

```
Evidence Traceability:
├─ 正则匹配无法判断引用是否正确对应内容
├─ 无法识别虚假引用
└─ 无法评估引用质量

Completeness:
├─ 无法判断是否回答了所有子问题
├─ 无法识别遗漏的关键信息
└─ 无法评估深度和广度

Terminology Accuracy:
├─ 无法判断术语是否在正确语境中使用
├─ 无法识别术语混淆或误用
└─ 缩写解释检查缺失
```

#### 2.1.2 增强方案

**方案 A: 批量 Prompt（推荐）**

一次 LLM 调用同时评估三个指标，减少 API 调用次数：

```typescript
// 批量评估 Prompt 设计
const prompt = `
请对以下医疗回答进行综合评估：

用户问题: "${query}"
系统回答: "${answer}"
检索内容摘要: "${chunksSummary}"

请评估以下三个维度：

1. 证据可追溯性 (Evidence Traceability)
   - 检查答案中的声称是否有引用支持
   - 判断引用来源是否存在于检索内容中
   - 评估引用质量 (指南/综述/未知)

2. 完整性 (Completeness)
   - 提取问题隐含的子问题
   - 判断答案是否覆盖每个子问题
   - 识别遗漏的重要信息

3. 术语准确性 (Terminology Accuracy)
   - 提取答案中的医疗术语和缩写
   - 判断术语在上下文中是否正确使用
   - 检查缩写是否首次使用时解释

JSON 输出格式:
{
  "evidence": {
    "score": 0.0-1.0,
    "citationAnalysis": [
      { "claim": "...", "needsCitation": true/false, "hasCitation": true/false, "valid": true/false }
    ],
    "missingCitations": ["..."],
    "sourceQuality": { "hasGuideline": true/false, "hasRecentSource": true/false }
  },
  "completeness": {
    "score": 0.0-1.0,
    "subQuestions": ["问题1", "问题2", ...],
    "covered": [{ "question": "...", "covered": true/false, "depth": "full/partial" }],
    "missingInfo": ["..."]
  },
  "terminology": {
    "score": 0.0-1.0,
    "terms": [{ "term": "...", "correct": true/false, "contextAppropriate": true/false }],
    "errors": [{ "term": "...", "errorType": "...", "correction": "..." }],
    "missingExplanations": ["..."]
  }
}

只输出 JSON，不要其他内容。
`;
```

**方案 B: 条件触发**

只在特定情况下启用 Layer 3 的 LLM 评估：

```
触发条件:
├─ faithfulness < 0.7 → 启用 Evidence Traceability
├─ 查询包含多个实体 → 启用 Completeness
├─ 答案包含专业术语 → 启用 Terminology
└─ 否则使用规则评估 (节省成本)
```

#### 2.1.3 实现代码结构

```typescript
// src/evaluation/Layer3Evaluator.ts

interface Layer3Config {
  mode: 'full_llm' | 'conditional' | 'rule_only';
  batchSize: number; // 批量处理声称数
  cacheEnabled: boolean;
}

class Layer3Evaluator {
  private llmCaller: LLMCaller;
  private config: Layer3Config;

  async evaluate(trace: TraceContextData): Promise<Layer3Result> {
    // 条件判断：是否需要 LLM 评估
    if (this.config.mode === 'conditional') {
      const triggers = this.analyzeTriggers(trace);
      if (!triggers.needsLLM) {
        return this.ruleBasedEvaluate(trace);
      }
    }

    // 批量 LLM 调用
    const prompt = this.buildBatchPrompt(trace);
    const response = await this.llmCaller(prompt);

    return this.parseResponse(response);
  }

  private analyzeTriggers(trace: TraceContextData): TriggerAnalysis {
    return {
      needsLLM:
        trace.answer.confidence < 0.7 ||
        (trace.query.entities?.diseases?.length ?? 0) > 1 ||
        this.hasMedicalTerms(trace.answer.text)
    };
  }
}
```

---

### 2.2 告警机制 — 安全优先

#### 2.2.1 告警类型与阈值

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  AlertType              │ 阈值                 │ 严重程度 │ 响应动作            │
│  ══════════════════════════════════════════════════════════════════════════════ │
│                                                                                 │
│  SAFETY_CRITICAL        │ safety < 0.5         │ 🔴 P0    │ 立即人工审核        │
│                         │ dangerousAdvice存在  │          │ 阻止答案发布        │
│                         │                      │          │ WebSocket push      │
│                                                                                 │
│  FAITHFULNESS_LOW       │ faithfulness < 0.5   │ 🔴 P0    │ 标记需要验证        │
│                         │ hallucination检测    │          │ 触发二次检索        │
│                         │                      │          │ WebSocket push      │
│                                                                                 │
│  MEDICAL_ACCURACY       │ medicalAccuracy < 0.6│ 🟡 P1    │ 标记术语错误        │
│                         │ terminologyErrors > 0│          │ 记录到错误日志      │
│                         │                      │          │ 邮件通知            │
│                                                                                 │
│  CONTEXT_IRRELEVANT     │ contextRelevance < 0.4│ 🟡 P1   │ 调整检索参数        │
│                         │ chunkScores avg 低   │          │ 建议 topK 增加      │
│                         │                      │          │ 前端提示            │
│                                                                                 │
│  SYSTEM_HEALTH          │ queue.failed > 10    │ 🔴 P0    │ Ops 告警            │
│                         │ queue.waiting > 100  │          │ 扩展 Worker         │
│                         │ LLM latency > 30s    │          │ 检查 API 状态       │
│                                                                                 │
│  TREND_DEGRADATION      │ 7日平均下降 > 10%    │ 🟡 P1    │ 触发根因分析        │
│                         │ 连续3天低于阈值      │          │ 自动生成报告        │
│                         │                      │          │ 团队邮件            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 2.2.2 AlertHandler 架构

```typescript
// src/alert/AlertHandler.ts

interface AlertEvent {
  alertId: string;
  timestamp: string;
  type: AlertType;
  severity: 'critical' | 'warning' | 'info';
  traceId: string;
  evaluationId: string;
  details: {
    metric: string;
    value: number;
    threshold: number;
    delta: number;
  };
  suggestedActions: string[];
  status: 'active' | 'resolved' | 'acknowledged';
}

class AlertHandler {
  private thresholds: AlertThresholds;
  private broadcasters: AlertBroadcaster[];
  private actionExecutor: ActionExecutor;

  constructor(config: AlertConfig) {
    this.thresholds = config.thresholds;
    this.broadcasters = [
      new WebSocketBroadcaster(),
      new LogBroadcaster(),
      // 未来扩展: new SlackBroadcaster(), new EmailBroadcaster()
    ];
    this.actionExecutor = new ActionExecutor();
  }

  async checkAndAlert(result: ExtendedEvaluationResult): Promise<AlertEvent[]> {
    const alerts: AlertEvent[] = [];

    // 1. Safety 检查 (最高优先级)
    if (result.riskLevel === 'danger') {
      alerts.push(this.createSafetyAlert(result));
    }

    // 2. Faithfulness 检查
    if (result.metrics.faithfulness.score < this.thresholds.faithfulness) {
      alerts.push(this.createFaithfulnessAlert(result));
    }

    // 3. Medical Accuracy 检查
    if (result.extendedMetrics.medicalAccuracy.score < this.thresholds.medicalAccuracy) {
      alerts.push(this.createMedicalAccuracyAlert(result));
    }

    // 4. 执行告警动作
    for (const alert of alerts) {
      await this.processAlert(alert);
    }

    return alerts;
  }

  private async processAlert(alert: AlertEvent): Promise<void> {
    // 广播告警
    for (const broadcaster of this.broadcasters) {
      await broadcaster.broadcast(alert);
    }

    // 执行响应动作
    await this.actionExecutor.execute(alert);

    // 持久化告警
    await this.storage.saveAlert(alert);
  }

  private createSafetyAlert(result: ExtendedEvaluationResult): AlertEvent {
    return {
      alertId: `alert-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'SAFETY_CRITICAL',
      severity: 'critical',
      traceId: result.traceId,
      evaluationId: result.evaluationId,
      details: {
        metric: 'safetyAssessment',
        value: result.extendedMetrics.safetyAssessment.score,
        threshold: 0.5,
        delta: result.extendedMetrics.safetyAssessment.score - 0.5
      },
      suggestedActions: [
        '立即人工审核',
        '阻止答案发布',
        '检查 dangerousAdvice 内容'
      ],
      status: 'active'
    };
  }
}
```

#### 2.2.3 SQLite 告警存储

```sql
-- 告警表
CREATE TABLE alerts (
  alert_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  trace_id TEXT,
  evaluation_id TEXT,
  details_json TEXT,
  suggested_actions_json TEXT,
  status TEXT DEFAULT 'active',
  acknowledged_by TEXT,
  resolved_at TEXT
);

CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_timestamp ON alerts(timestamp);
CREATE INDEX idx_alerts_severity ON alerts(severity);
```

---

### 2.3 反馈闭环 — 长期演进核心

#### 2.3.1 MVP 闭环设计

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         MVP 反馈闭环                                            │
│                                                                                 │
│    ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐            │
│    │  Agent   │────▶│  Eval    │────▶│ Feedback │────▶│  Action  │            │
│    │ Execute  │     │ Pipeline │     │ Analyzer │     │ Executor │            │
│    └──────────┘     └──────────┘     └──────────┘     └──────────┘            │
│         ▲                                │                   │                │
│         │                                │                   │                │
│         └────── Adjustment Signal ───────┘                   │                │
│                                                              │                │
│                                                              ▼                │
│                                                       ┌──────────┐            │
│                                                       │ Human    │            │
│                                                       │ Review   │            │
│                                                       │ Queue    │            │
│                                                       └──────────┘            │
│                                                                                 │
│    闭环信号:                                                                    │
│    ├─ faithfulness < 0.5 → 增加验证检索                                       │
│    ├─ safetyAssessment < 0.7 → 人工审核队列                                   │
│    ├─ contextRelevance < 0.5 → 下次查询调整 topK                             │
│    └─ 连续低分 → 检索策略降级                                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 2.3.2 FeedbackAnalyzer 实现

```typescript
// src/feedback/FeedbackAnalyzer.ts

interface FeedbackSignal {
  traceId: string;
  adjustments: Adjustment[];
  flags: Flag[];
  suggestions: Suggestion[];
}

interface Adjustment {
  target: 'retrieval' | 'generation' | 'evaluation';
  change: Record<string, unknown>;
  reason: string;
  expiresAt?: number; // 会话级调整的过期时间
}

class FeedbackAnalyzer {
  private history: EvaluationHistoryStore;

  analyze(result: ExtendedEvaluationResult): FeedbackSignal {
    const signal: FeedbackSignal = {
      traceId: result.traceId,
      adjustments: [],
      flags: [],
      suggestions: []
    };

    // 1. Safety 反馈 — 最高优先级
    if (result.riskLevel === 'danger') {
      signal.flags.push({
        type: 'HUMAN_REVIEW_REQUIRED',
        reason: 'safetyAssessment < 0.5',
        priority: 'critical'
      });
      signal.suggestions.push({
        action: 'block_answer_publish',
        reason: 'Contains dangerous advice'
      });
    }

    // 2. Faithfulness 反馈
    if (result.metrics.faithfulness.score < 0.5) {
      signal.adjustments.push({
        target: 'retrieval',
        change: {
          topK: +5,
          verificationMode: true,
          rerankEnabled: true
        },
        reason: 'Low faithfulness - potential hallucination',
        expiresAt: Date.now() + 3600000 // 1小时内生效
      });
    }

    // 3. Context Relevance 反馈
    if (result.metrics.contextRelevance.score < 0.5) {
      signal.adjustments.push({
        target: 'retrieval',
        change: {
          threshold: -0.1,
          mode: 'hybrid_enhanced'
        },
        reason: 'Low context relevance - adjust retrieval parameters'
      });
    }

    // 4. 趋势分析 — 检测系统性问题
    const trend = this.history.getRecentTrend(10);
    if (trend.degradationRate > 0.1) {
      signal.flags.push({
        type: 'SYSTEM_DEGRADATION',
        reason: '连续低分趋势',
        priority: 'warning'
      });
    }

    return signal;
  }
}
```

#### 2.3.3 Human Review Queue

```typescript
// src/feedback/HumanReviewQueue.ts

interface ReviewItem {
  reviewId: string;
  traceId: string;
  evaluationId: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  status: 'pending' | 'assigned' | 'reviewed' | 'resolved';
  assignedTo?: string;
  reviewNotes?: string;
  createdAt: number;
}

class HumanReviewQueue {
  private storage: TraceStorage;

  async add(item: Omit<ReviewItem, 'reviewId' | 'createdAt' | 'status'>): Promise<string> {
    const reviewItem: ReviewItem = {
      reviewId: `review-${Date.now()}`,
      createdAt: Date.now(),
      status: 'pending',
      ...item
    };

    await this.storage.saveReviewItem(reviewItem);
    return reviewItem.reviewId;
  }

  async getPending(limit: number = 20): Promise<ReviewItem[]> {
    return this.storage.getReviewItems({ status: 'pending', limit });
  }

  async assign(reviewId: string, assignee: string): Promise<void> {
    await this.storage.updateReviewItem(reviewId, {
      status: 'assigned',
      assignedTo: assignee
    });
  }

  async resolve(reviewId: string, notes: string, action: 'approve' | 'reject' | 'modify'): Promise<void> {
    await this.storage.updateReviewItem(reviewId, {
      status: 'resolved',
      reviewNotes: notes,
      resolvedAt: Date.now(),
      resolutionAction: action
    });
  }
}
```

#### 2.3.4 完整闭环架构（未来）

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         完整反馈闭环架构                                         │
│                                                                                 │
│    ┌──────────┐                                                                │
│    │  User    │                                                                │
│    │ Query    │                                                                │
│    └──────────┘                                                                │
│         │                                                                       │
│         ▼                                                                       │
│    ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐            │
│    │  Agent   │────▶│ Retrieval│────▶│  LLM     │────▶│  Answer  │            │
│    │ Executor │     │ Pipeline │     │ Generate │     │  Output  │            │
│    └──────────┘     └──────────┘     └──────────┘     └──────────┘            │
│         │                                                   │                │
│         │                                                   │                │
│         │                                                   ▼                │
│         │                                           ┌──────────┐            │
│         │                                           │  Eval    │            │
│         │                                           │ Pipeline │            │
│         │                                           └──────────┘            │
│         │                                                   │                │
│         │                                                   ▼                │
│         │                                           ┌──────────┐            │
│         │                                           │ Feedback │            │
│         │                                           │ Analyzer │            │
│         │                                           └──────────┘            │
│         │                                                   │                │
│         │           ┌───────────────────────────────────────┘                │
│         │           │                                                        │
│         │           ▼                                                        │
│         │    ┌──────────┐     ┌──────────┐     ┌──────────┐                  │
│         └───▶│ Retrieval│────▶│  Config  │────▶│  Human   │                  │
│              │ Strategy │     │  Update  │     │  Review  │                  │
│              │ Adjuster │     │  Store   │     │  Queue   │                  │
│              └──────────┘     └──────────┘     └──────────┘                  │
│                                    │                           │              │
│                                    │                           │              │
│                                    ▼                           ▼              │
│                             ┌──────────┐                 ┌──────────┐        │
│                             │ Ground   │                 │ Audit    │        │
│                             │ Truth    │                 │ Log      │        │
│                             │ Builder  │                 │          │        │
│                             └──────────┘                 └──────────┘        │
│                                                                                 │
│  Ground Truth Builder: 从人工审核结果构建测试集                                  │
│  Audit Log: 记录所有反馈和调整动作，用于追溯                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.4 Worker 扩展机制

#### 2.4.1 当前限制

```
当前配置:
├─ replicas: 1 (固定)
├─ concurrency: 2
├─ limiter: 10 tasks/min
└─ avg evaluation time: 30-60s

理论吞吐量:
├─ 最大并发: 2 个任务
├─ 每分钟限制: 10 个任务
├─ 每小时吞吐: ~600 个任务
├─ 每天吞吐: ~14,400 个任务

瓶颈:
├─ LLM API 延迟是主要瓶颈
├─ limiter 限制了 burst 处理能力
├─ 单 Worker 无法处理高峰负载
```

#### 2.4.2 扩展方案对比

| 方案 | 适用场景 | 实现难度 | 运维成本 | 推荐度 |
|------|----------|----------|----------|--------|
| A. 手动 replicas | 小规模/稳定负载 | ⭐ | 低 | 适合当前 |
| B. 自定义 Autoscaler | 中规模/Docker | ⭐⭐⭐ | 中 | 推荐 MVP |
| C. Kubernetes HPA | 大规模/云原生 | ⭐⭐⭐⭐ | 高 | 未来考虑 |
| D. 多队列分流 | 复杂场景 | ⭐⭐⭐⭐ | 高 | 高级需求 |

#### 2.4.3 方案 B: 自定义 Autoscaler（推荐）

```typescript
// src/scaler/EvaluationAutoscaler.ts

interface AutoscalerConfig {
  minReplicas: number;
  maxReplicas: number;
  scaleUpThreshold: number; // waiting > threshold → scale up
  scaleDownThreshold: number;
  cooldownPeriod: number; // 缩容冷却期
  checkInterval: number;
}

const DEFAULT_AUTOSCALER_CONFIG: AutoscalerConfig = {
  minReplicas: 1,
  maxReplicas: 10,
  scaleUpThreshold: 50,
  scaleDownThreshold: 5,
  cooldownPeriod: 300000, // 5分钟
  checkInterval: 60000 // 1分钟
};

class EvaluationAutoscaler {
  private queue: EvaluationQueue;
  private docker: DockerApi;
  private config: AutoscalerConfig;
  private lastScaleTime: number = 0;

  async start(): Promise<void> {
    setInterval(() => this.checkAndScale(), this.config.checkInterval);
  }

  async checkAndScale(): Promise<void> {
    const stats = await this.queue.getQueueStats();
    const currentReplicas = await this.getCurrentReplicas();

    // 扩容逻辑
    if (stats.waiting > this.config.scaleUpThreshold &&
        currentReplicas < this.config.maxReplicas) {

      const targetReplicas = Math.min(
        Math.ceil(stats.waiting / 20), // 每20个任务1个Worker
        this.config.maxReplicas
      );

      await this.scaleTo(targetReplicas);
      this.lastScaleTime = Date.now();

      await this.logScaleEvent({
        from: currentReplicas,
        to: targetReplicas,
        reason: `Queue waiting: ${stats.waiting}`
      });
    }

    // 缩容逻辑
    if (stats.waiting < this.config.scaleDownThreshold &&
        stats.active < 2 &&
        currentReplicas > this.config.minReplicas &&
        Date.now() - this.lastScaleTime > this.config.cooldownPeriod) {

      await this.scaleTo(this.config.minReplicas);
    }
  }

  private async scaleTo(count: number): Promise<void> {
    // Docker Compose 方式
    await exec(`docker-compose up -d --scale evaluation-worker=${count}`);

    // 或 Docker Swarm 方式
    // await this.docker.scaleService('evaluation-worker', count);
  }

  private async getCurrentReplicas(): Promise<number> {
    const containers = await this.docker.listContainers({
      filter: { name: 'evaluation-worker' }
    });
    return containers.length;
  }
}
```

#### 2.4.4 队列健康监控

```typescript
// src/monitor/QueueHealthMonitor.ts

interface QueueHealthStatus {
  stats: QueueStats;
  health: 'healthy' | 'warning' | 'critical';
  alerts: AlertEvent[];
  recommendations: string[];
}

class QueueHealthMonitor {
  private queue: EvaluationQueue;
  private alertHandler: AlertHandler;

  async checkHealth(): Promise<QueueHealthStatus> {
    const stats = await this.queue.getQueueStats();
    const alerts: AlertEvent[] = [];
    const recommendations: string[] = [];
    let health: 'healthy' | 'warning' | 'critical' = 'healthy';

    // 队列积压检查
    if (stats.waiting > 100) {
      health = 'warning';
      alerts.push({
        type: 'QUEUE_BACKLOG',
        severity: 'warning',
        details: { waiting: stats.waiting }
      });
      recommendations.push('增加 Worker replicas');
      recommendations.push('检查 LLM API 延迟');
    }

    // 失败率检查
    const totalProcessed = stats.completed + stats.failed;
    const failureRate = totalProcessed > 0 ? stats.failed / totalProcessed : 0;

    if (failureRate > 0.1) {
      health = 'critical';
      alerts.push({
        type: 'HIGH_FAILURE_RATE',
        severity: 'critical',
        details: { failureRate, failed: stats.failed }
      });
      recommendations.push('检查 Redis 连接');
      recommendations.push('检查 LLM API 状态');
      recommendations.push('查看失败任务日志');
    }

    // Worker 活跃度检查
    if (stats.active === 0 && stats.waiting > 0) {
      health = 'critical';
      alerts.push({
        type: 'NO_ACTIVE_WORKERS',
        severity: 'critical',
        details: { waiting: stats.waiting }
      });
      recommendations.push('检查 Worker 进程状态');
      recommendations.push('重启 Worker 服务');
    }

    return { stats, health, alerts, recommendations };
  }

  async getWorkerMetrics(): Promise<WorkerMetrics> {
    // 收集每个 Worker 的详细指标
    return {
      totalWorkers: await this.getWorkerCount(),
      avgProcessingTime: await this.getAvgProcessingTime(),
      llmLatency: await this.getLLMLatency(),
      memoryUsage: await this.getMemoryUsage()
    };
  }
}
```

---

## 3. 实施路线图

### 3.1 优先级排序

基于 **安全性优先 > 准确性优先 > 长期演进能力** 的原则：

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    实施优先级                                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

    P0 (立即实施 — 安全保障)
    ═══════════════════════════════════════════════════════════════════════════════
    ├─ [S1] 告警机制基础框架
    │   ├─ AlertHandler 核心类
    │   ├─ 阈值检查逻辑
    │   ├─ WebSocket 广播
    │   └─ SQLite 告警存储
    │
    ├─ [S2] Safety 告警 (最高优先级)
    │   ├─ safety < 0.5 → critical alert
    │   ├─ dangerousAdvice 检测 → 阻止发布
    │   └─ Human Review Queue 基础
    │
    ├─ [S3] Human Review Queue MVP
    │   ├─ SQLite 存储
    │   ├─ REST API 端点
    │   ├─ Dashboard 入口
    │   └─ 审核流程基础
    │
    └─ [I1] Worker 手动扩容配置
        ├─ replicas: 2 (临时)
        ├─ concurrency: 4
        └─ limiter 放宽

    P1 (本周完成 — 准确性提升)
    ═══════════════════════════════════════════════════════════════════════════════
    ├─ [A1] Layer 3 批量 Prompt 实现
    │   ├─ 批量评估 Prompt 设计
    │   ├─ Layer3Evaluator 类
    │   ├─ 与现有 Pipeline 集成
    │   └─ 单元测试
    │
    ├─ [A2] Layer 3 条件触发逻辑
    │   ├─ 触发条件分析
    │   ├─ 规则评估 fallback
    │   ├─ 成本优化
    │   └─ 性能测试
    │
    ├─ [S4] Faithfulness 告警
    │   ├─ faithfulness < 0.5 → warning alert
    │   ├─ hallucination 检测标记
    │   └─ 触发二次检索建议
    │
    └─ [M1] 队列健康监控基础
        ├─ QueueHealthMonitor 类
        ├─ 失败率告警
        ├─ Dashboard 显示队列状态

    P2 (下周完成 — 基础设施)
    ═══════════════════════════════════════════════════════════════════════════════
    ├─ [I2] Worker Autoscaler MVP
    │   ├─ EvaluationAutoscaler 类
    │   ├─ Docker API 集成
    │   ├─ 扩缩容事件日志
    │   └─ 手动触发 API
    │
    ├─ [F1] FeedbackAnalyzer 实现
    │   ├─ 评估结果分析
    │   ├─ Adjustment 生成
    │   ├─ 会话级配置存储
    │   └
    ├─ [M2] 队列监控 Dashboard
        ├─ 队列状态可视化
        ├─ Worker 健康状态
        ├─ 扩缩容历史
        └─ 告警列表展示

    P3 (后续演进 — 长期能力)
    ═══════════════════════════════════════════════════════════════════════════════
    ├─ [F2] ActionExecutor 实现
    │   ├─ 检索参数动态调整
    │   ├─ 审核队列联动
    │   └─ Audit Log 记录
    │
    ├─ [I3] 多队列分流
    │   ├─ critical/normal/batch 三队列
    │   ├─ Queue Router 实现
    │   ├─ 不同队列不同策略
    │   └
    ├─ [D1] Ground Truth Builder
        ├─ 从审核结果提取测试数据
        ├─ 自动化测试集生成
        ├─ 回归测试支持
        │
    └─ [E1] 趋势分析与报告
        ├─ 7日/30日趋势分析
        ├─ 自动生成周报
        ├─ 检测系统性退化
        └─ 触发根因分析
```

### 3.2 依赖关系图

```
告警机制 ──────────────────▶ 反馈闭环
    │                            │
    │                            │
    ▼                            ▼
队列监控 ──────────────────▶ Worker Autoscaler
    │                            │
    │                            │
    ▼                            ▼
Layer 3 增强 ──────────────▶ 完整闭环

关键路径:
告警 → 人工审核 → 反馈闭环 → 自动调整
```

### 3.3 工作量估算

| 任务 | 代码量估计 | 测试工作量 | 总工时 (天) |
|------|------------|------------|-------------|
| [S1] 告警机制基础框架 | ~200 LOC | ~100 LOC | 2 |
| [S2] Safety 告警 | ~100 LOC | ~50 LOC | 1 |
| [S3] Human Review Queue MVP | ~150 LOC | ~80 LOC | 1.5 |
| [I1] Worker 手动扩容配置 | ~20 LOC | 配置测试 | 0.5 |
| **P0 总计** | **~470 LOC** | **~230 LOC** | **5 天** |
| [A1] Layer 3 批量 Prompt | ~300 LOC | ~150 LOC | 3 |
| [A2] Layer 3 条件触发 | ~150 LOC | ~80 LOC | 1.5 |
| [S4] Faithfulness 告警 | ~80 LOC | ~40 LOC | 0.5 |
| [M1] 队列健康监控基础 | ~100 LOC | ~60 LOC | 1 |
| **P1 总计** | **~630 LOC** | **~330 LOC** | **6 天** |
| [I2] Worker Autoscaler MVP | ~250 LOC | ~120 LOC | 2.5 |
| [F1] FeedbackAnalyzer 实现 | ~200 LOC | ~100 LOC | 2 |
| [M2] 队列监控 Dashboard | ~300 LOC | ~100 LOC | 2 |
| **P2 总计** | **~750 LOC** | **~320 LOC** | **6.5 天** |

---

## 4. 可演进方向

### 4.1 安全性演进路径

```
Phase 1 (当前):
├─ Safety Assessment LLM 评估
├─ riskLevel = 'danger' 标记
└─ SQLite 存储

Phase 2 (P0 实施):
├─ 实时告警机制
├─ Human Review Queue
├─ 阻止危险答案发布
└─ WebSocket 实时推送

Phase 3 (未来演进):
├─ 多级安全检查
│   ├─ Pre-generation Safety Check (生成前检查)
│   ├─ Post-generation Safety Review (生成后审查)
│   └─ Continuous Monitoring (持续监控)
├─ 药物相互作用数据库集成
├─ 禁忌症知识图谱
└─ 医疗法规合规检查

Phase 4 (高级演进):
├─ AI Safety Guardrails
│   ├─ Constitutional AI 方法
│   ├─ Red Teaming 测试
│   └─ Adversarial 检测
├─ 医疗专家审核工作流
├─ 安全事件追踪和报告
└─ 合规审计自动化
```

### 4.2 准确性演进路径

```
Phase 1 (当前):
├─ Layer 1: RAGAS (LLM 驱动)
├─ Layer 2: 医疗核心 (LLM 驱动)
├─ Layer 3: 规则驱动 (简化)
└─ DeepSeek Reasoner 模型

Phase 2 (P1 实施):
├─ Layer 3 增强 (批量 LLM)
├─ 条件触发机制
├─ Evidence Traceability 真正验证
└─ 完整性子问题覆盖检查

Phase 3 (未来演进):
├─ 多模型对比评估
│   ├─ DeepSeek vs Claude vs GPT-4
│   ├─ Cross-validation
│   └─ Ensemble 评分
├─ 医疗领域专用评估模型
│   ├─ MedQA 基准测试
│   ├─ Clinical Guidelines 检查
│   └─ Drug Interaction 检查
├─ Ground Truth 构建
│   ├─ 专家标注数据
│   ├─ 用户反馈数据
│   └─ 自动化测试集

Phase 4 (高级演进):
├─ RAGAS++ 自定义指标
│   ├─ Medical Faithfulness
│   ├─ Citation Accuracy
│   ├─ Clinical Reasoning
├─ A/B Testing 自动化
├─ 模型选择优化
└─ Prompt 优化自动化
```

### 4.3 反馈闭环演进路径

```
Phase 1 (当前):
├─ 单向数据流
├─ Dashboard 展示
└─ 无反馈机制

Phase 2 (P0-P2 实施):
├─ Human Review Queue
├─ FeedbackAnalyzer 基础
├─ Adjustment 信号生成
└─ Audit Log 记录

Phase 3 (未来演进):
├─ ActionExecutor 实现
├─ 检索参数动态调整
├─ 会话级配置存储
├─ Ground Truth Builder
└─ 自动化测试集生成

Phase 4 (高级演进):
├─ 自学习系统
│   ├─ 从审核结果学习
│   ├─ 模型微调数据生成
│   ├─ Prompt 自动优化
├─ 知识库质量反馈
│   ├─ 低质量文档标记
│   ├─ Chunk 评分反馈
│   ├─ 文档更新建议
├─ 用户反馈集成
│   ├─ Thumbs up/down
│   ├─ Correction suggestions
│   ├─ Expert reviews
└─ RLHF 数据生成
```

### 4.4 Worker 扩展演进路径

```
Phase 1 (当前):
├─ replicas: 1 (固定)
├─ concurrency: 2
├─ limiter: 10/min
└─ Docker Compose 单节点

Phase 2 (P0-P2 实施):
├─ 手动 replicas 调整
├─ concurrency 增加到 4
├─ limiter 放宽
├─ 自定义 Autoscaler MVP
└─ 队列健康监控

Phase 3 (未来演进):
├─ Kubernetes HPA
├─ Prometheus + Grafana
├─ Redis 集群
├─ 多队列分流
│   ├─ critical queue (VIP)
│   ├─ normal queue (Main)
│   ├─ batch queue (Slow)
└─ 不同队列不同模型

Phase 4 (高级演进):
├─ 智能预测扩缩容
│   ├─ 历史负载分析
│   ├─ 预测性扩展
│   ├─ 成本优化
├─ 分布式 Worker
│   ├─ 多区域部署
│   ├─ Leader Election
│   ├─ Shared State
├─ GPU Worker (可选)
│   ├─ Local LLM 评估
│   ├─ 降低 API 成本
│   ├─ 提高响应速度
```

### 4.5 架构演进全景图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    RAG 评估系统架构演进全景                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

                          当前架构 (Phase 1)
    ┌──────────────────────────────────────────────────────────────────────────────┐
    │                                                                              │
    │    Agent ──▶ Queue ──▶ Worker ──▶ Pipeline ──▶ Storage ──▶ Dashboard        │
    │                                                                              │
    │    问题: 单向数据流，无告警，无反馈，固定扩展                                │
    │                                                                              │
    └──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ P0 实施
                                   ▼
                          安全保障架构 (Phase 2)
    ┌──────────────────────────────────────────────────────────────────────────────┐
    │                                                                              │
    │    Agent ──▶ Queue ──▶ Worker ──▶ Pipeline ──▶ Storage                      │
    │                                              │                              │
    │                                              ▼                              │
    │                                       ┌───────────┐                         │
    │                                       │ AlertHandler                        │
    │                                       └───┬───────┬                         │
    │                                           │       │                         │
    │                                           ▼       ▼                         │
    │                                    WebSocket  Human Review                 │
    │                                    Broadcast     Queue                     │
    │                                                                              │
    │    新增: 告警机制，人工审核队列，Safety 阻止                                 │
    │                                                                              │
    └──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ P1-P2 实施
                                   ▼
                          准确性与反馈架构 (Phase 3)
    ┌──────────────────────────────────────────────────────────────────────────────┐
    │                                                                              │
    │    Agent ──▶ Queue ──▶ Worker ──▶ Pipeline ──▶ Storage                      │
    │        │          │          │              │                              │
    │        │          │          │              ▼                              │
    │        │          │          │       ┌───────────┐                         │
    │        │          │          │       │ AlertHandler                        │
    │        │          │          │       └───┬───────┬                         │
    │        │          │          │           │       │                         │
    │        │          │          │           ▼       ▼                         │
    │        │          │          │    WebSocket  Human Review                  │
    │        │          │          │                                              │
    │        │          ▼          │              ▼                              │
    │        │   Autoscaler        │       FeedbackAnalyzer                      │
    │        │          │          │              │                              │
    │        │          │          │              ▼                              │
    │        │          ▼          │       ActionExecutor                        │
    │        │   Queue Monitor     │              │                              │
    │        │                     │              │                              │
    │        └─────────────────────┴──────────────┘                              │
    │                    ▲                                                        │
    │                    │                                                        │
    │              Adjustment Signal                                              │
    │                                                                              │
    │    新增: Layer3 LLM, Autoscaler, 反馈闭环, 队列监控                        │
    │                                                                              │
    └──────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ 未来演进
                                   ▼
                          智能闭环架构 (Phase 4)
    ┌──────────────────────────────────────────────────────────────────────────────┐
    │                                                                              │
    │    User ──▶ Agent ──▶ Retrieval ──▶ LLM ──▶ Answer                          │
    │        │       │           │          │       │                             │
    │        │       │           │          │       ▼                             │
    │        │       │           │          │   Evaluation                        │
    │        │       │           │          │       │                             │
    │        │       │           │          │       ▼                             │
    │        │       │           │          │   Feedback                          │
    │        │       │           │          │   Analyzer                          │
    │        │       │           │          │       │                             │
    │        │       │           │          │       │                             │
    │        │       │           └──────────┴───────┘                             │
    │        │       │                          │                                 │
    │        │       │                          ▼                                 │
    │        │       │                   Retrieval Adjuster                       │
    │        │       │                          │                                 │
    │        │       │                          │                                 │
    │        │       └──────────────────────────┘                                 │
    │        │                                  │                                 │
    │        │                                  ▼                                 │
    │        │                           Config Update Store                      │
    │        │                                  │                                 │
    │        │                                  │                                 │
    │        └──────────────────────────────────┘                                 │
    │                    ▲                                                        │
    │                    │                                                        │
    │               Self-Learning                                                 │
    │                                                                              │
    │    新增: Ground Truth Builder, 多模型对比, 智能预测, RLHF 数据             │
    │                                                                              │
    └──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 附录：技术决策记录

### 5.1 为什么选择批量 Prompt 而非单独调用？

**决策**: Layer 3 使用批量 Prompt，一次 LLM 调用评估三个指标。

**原因**:
1. 成本优化：单独调用需要 3 次 LLM API，批量只需 1 次
2. 延迟优化：减少 API 调用次数，降低总评估时间
3. 上下文共享：三个评估可以共享相同的上下文信息
4. 结果一致性：批量评估可以保持评估标准的一致性

**权衡**:
- Prompt 更复杂，解析难度增加
- 单次失败影响所有三个指标
- 需要更完善的 fallback 机制

### 5.2 为什么 Human Review Queue 是 MVP 的核心？

**决策**: Human Review Queue 作为反馈闭环的第一步实现。

**原因**:
1. 安全优先：危险答案必须人工审核才能发布
2. 最小可行：这是闭环的最简单形式
3. 数据积累：审核结果可以用于构建 Ground Truth
4. 用户信任：人工审核增加系统可信度

**权衡**:
- 需要人工介入，增加运维成本
- 审核速度受限，可能积压
- 需要设计审核工作流程

### 5.3 为什么自定义 Autoscaler 而非直接 K8s HPA？

**决策**: Phase 2 使用自定义 Autoscaler，Phase 3 再考虑 K8s。

**原因**:
1. 渐进演进：当前是 Docker Compose，直接 K8s 跨度太大
2. 学习成本：团队需要时间适应 K8s
3. 控制精度：自定义可以针对业务逻辑精确控制
4. 验证机制：自定义实现可以验证扩缩容策略是否有效

**权衡**:
- 需要自己实现和维护
- 功能不如 HPA 完善
- 未来迁移到 K8s 需要重写

### 5.4 为什么 Safety 告警优先于其他告警？

**决策**: Safety 告警作为 P0 最高优先级实现。

**原因**:
1. 医疗场景特殊性：错误建议可能导致严重后果
2. 法规合规：医疗 AI 需要严格的安全检查
3. 用户信任：安全是用户使用系统的前提
4. 责任边界：系统必须明确标记危险内容

**权衡**:
- 可能过度保守，阻止部分合理答案
- 需要人工审核，增加延迟
- 需要定义明确的危险标准

---

## 参考文档

- [RAG Evaluation Guide](./rag-evaluation-guide.md) - 评估系统使用指南
- [Medical Agent Guide](./medical-agent-guide.md) - Medical Agent 架构
- [Hybrid Retrieval](./hybrid-retrieval.md) - 检索系统架构
- [Architecture Diagrams](./architecture-diagrams.md) - 系统架构图

---

> 最后更新: 2026-04-24
>
> 维护者: RAG Evaluation Team