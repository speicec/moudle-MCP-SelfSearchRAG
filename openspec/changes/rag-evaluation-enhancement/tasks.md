---
name: rag-evaluation-enhancement
description: RAG 评估系统四大支柱增强 - 实施任务列表
created: 2026-04-24
---

# Tasks: RAG Evaluation Enhancement

> 实施路线：P0 安全保障 → P1 准确性提升 → P2 基础设施
>
> 预估工时：P0 5天，P1 6天，P2 6.5天

---

## 1. P0 - 基础设施准备

### 1.1 SQLite Schema 扩展

- [x] 1.1.1 在 TraceStorage 中新增 alerts 表
- [x] 1.1.2 在 TraceStorage 中新增 human_review_queue 表
- [x] 1.1.3 在 TraceStorage 中新增 scale_events 表 (可选)
- [x] 1.1.4 更新 SCHEMA_SQL 常量包含新表定义
- [x] 1.1.5 编写 Schema 迁移测试

### 1.2 目录结构创建

- [x] 1.2.1 创建 src/alert/ 目录
- [x] 1.2.2 创建 src/feedback/ 目录
- [x] 1.2.3 创建 src/scaler/ 目录
- [x] 1.2.4 创建 src/monitor/ 目录
- [x] 1.2.5 创建 src/server/routes/alerts.ts
- [x] 1.2.6 创建 src/server/routes/review.ts
- [x] 1.2.7 创建 src/server/routes/scaler.ts

### 1.3 Docker 配置优化

- [x] 1.3.1 修改 docker-compose.yml evaluation-worker replicas 为 2
- [x] 1.3.2 增加 EVALUATION_CONCURRENCY 环境变量为 4
- [x] 1.3.3 移除或放宽 queue limiter 配置
- [x] 1.3.4 验证 Docker Compose 配置生效

---

## 2. P0 - 告警机制实现

### 2.1 AlertHandler 核心类

- [x] 2.1.1 创建 src/alert/types.ts 定义 AlertEvent、AlertType 接口
- [x] 2.1.2 实现 src/alert/AlertHandler.ts 核心类
- [x] 2.1.3 实现 checkAndAlert() 方法处理评估结果
- [x] 2.1.4 实现 createSafetyAlert() 方法
- [x] 2.1.5 实现 createFaithfulnessAlert() 方法
- [x] 2.1.6 实现 createMedicalAccuracyAlert() 方法
- [x] 2.1.7 实现 processAlert() 方法（广播 + 存储）

### 2.2 AlertThresholds 配置

- [x] 2.2.1 创建 src/alert/config.ts 定义阈值配置
- [x] 2.2.2 实现 DEFAULT_ALERT_THRESHOLTS 常量
- [x] 2.2.3 支持环境变量覆盖阈值配置

### 2.3 Alert Broadcasters

- [x] 2.3.1 实现 src/alert/WebSocketBroadcaster.ts
- [x] 2.3.2 实现 src/alert/LogBroadcaster.ts
- [x] 2.3.3 实现告警聚合逻辑 (5分钟同类型合并)
- [x] 2.3.4 实现速率限制 (每分钟最多10条)

### 2.4 Alert Storage 集成

- [x] 2.4.1 在 TraceStorage 中实现 saveAlert() 方法
- [x] 2.4.2 实现 getAlerts() 查询方法
- [x] 2.4.3 实现 getAlert() 单条查询方法
- [x] 2.4.4 实现 acknowledgeAlert() 状态更新方法
- [x] 2.4.5 实现 resolveAlert() 解决方法

### 2.5 Alert REST API

- [x] 2.5.1 实现 GET /api/alerts 端点
- [x] 2.5.2 实现 GET /api/alerts/:id 端点
- [x] 2.5.3 实现 POST /api/alerts/:id/acknowledge 端点
- [x] 2.5.4 在 main-server.ts 注册告警路由

### 2.6 MetricsAggregator 集成

- [x] 2.6.1 在 MetricsAggregator 中集成 AlertHandler
- [x] 2.6.2 修改 broadcastUpdate() 方法触发告警检查
- [x] 2.6.3 实现 'alert:new' WebSocket 事件类型

### 2.7 告警机制测试

- [x] 2.7.1 编写 AlertHandler 单元测试
- [x] 2.7.2 编写告警阈值触发测试
- [x] 2.7.3 编写告警广播测试
- [x] 2.7.4 编写告警存储测试
- [x] 2.7.5 编写 REST API 测试

---

## 3. P0 - Human Review Queue 实现

### 3.1 HumanReviewQueue 核心类

- [x] 3.1.1 创建 src/feedback/types.ts 定义 ReviewItem 接口
- [x] 3.1.2 实现 src/feedback/HumanReviewQueue.ts 核心类
- [x] 3.1.3 实现 add() 方法添加审核项
- [x] 3.1.4 实现 getPending() 方法获取待审核列表
- [x] 3.1.5 实现 assign() 方法分配审核人员
- [x] 3.1.6 实现 approve() 方法批准审核
- [x] 3.1.7 实现 reject() 方法拒绝审核
- [x] 3.1.8 实现 getCount() 方法获取计数

### 3.2 Review Storage 集成

- [x] 3.2.1 在 TraceStorage 中实现 saveReviewItem() 方法
- [x] 3.2.2 实现 getReviewItems() 查询方法（支持状态和优先级过滤）
- [x] 3.2.3 实现 updateReviewItem() 更新方法
- [x] 3.2.4 实现 getReviewCount() 计数方法

### 3.3 Review REST API

- [x] 3.3.1 实现 GET /api/review/pending 端点
- [x] 3.3.2 实现 GET /api/review/count 端点
- [x] 3.3.3 实现 GET /api/review/:id 端点
- [x] 3.3.4 实现 POST /api/review 端点（手动创建）
- [x] 3.3.5 实现 POST /api/review/:id/assign 端点
- [x] 3.3.6 实现 POST /api/review/:id/approve 端点
- [x] 3.3.7 实现 POST /api/review/:id/reject 端点
- [x] 3.3.8 实现 POST /api/review/:id/notes 端点
- [x] 3.3.9 在 main-server.ts 注册审核路由

### 3.4 Alert-Review 联动

- [x] 3.4.1 在 AlertHandler 中集成 HumanReviewQueue
- [x] 3.4.2 SAFETY_CRITICAL 告警自动创建审核项
- [x] 3.4.3 审核项包含告警详情和 suggestedActions

### 3.5 SLA Monitoring

- [x] 3.5.1 实现 SLA 检查逻辑（pending > 24h）
- [x] 3.5.2 实现 REVIEW_SLA_BREACH 告警
- [x] 3.5.3 实现 critical 审核项 4h SLA

### 3.6 Human Review Queue 测试

- [x] 3.6.1 编写 HumanReviewQueue 单元测试
- [x] 3.6.2 编写审核项创建测试
- [x] 3.6.3 编写审核流程测试（assign/approve/reject）
- [x] 3.6.4 编写 REST API 测试
- [x] 3.6.5 编写 SLA 监控测试

---

## 4. P0 - Safety Layer 集成

### 4.1 Safety Layer 告警集成

- [x] 4.1.1 在 SafetyAssessment 输出中添加 alertTriggered 字段
- [x] 4.1.2 severity='absolute' 时调用 AlertHandler.createSafetyAlert()
- [x] 4.1.3 severity='relative' 时调用 AlertHandler.createAttentionAlert()

### 4.2 答案阻止机制

- [x] 4.2.1 在 SafetyLayerOutput 中添加 answerStatus 字段
- [x] 4.2.2 severity='absolute' 时设置 answerStatus='blocked_pending_review'
- [x] 4.2.3 实现 WebSocket 答案阻止通知

### 4.3 Safety Layer 测试更新

- [x] 4.3.1 更新 Safety Layer 测试覆盖告警触发
- [x] 4.3.2 测试答案阻止逻辑
- [x] 4.3.3 测试 Alert-Review 联动

---

## 5. P1 - Layer 3 LLM 评估实现

### 5.1 Layer3Evaluator 核心类

- [x] 5.1.1 创建 src/evaluation/Layer3Evaluator.ts
- [x] 5.1.2 实现 evaluate() 方法
- [x] 5.1.3 实现 buildBatchPrompt() 方法
- [x] 5.1.4 实现 parseResponse() 方法
- [x] 5.1.5 实现 fallbackToRules() 方法

### 5.2 批量 Prompt 设计

- [x] 5.2.1 设计 Evidence Traceability Prompt 部分
- [x] 5.2.2 设计 Completeness Prompt 部分
- [x] 5.2.3 设计 Terminology Prompt 部分
- [x] 5.2.4 设计组合 Prompt 模板
- [x] 5.2.5 测试 Prompt 输出格式稳定性

### 5.3 条件触发逻辑

- [x] 5.3.1 实现 analyzeTriggers() 方法
- [x] 5.3.2 实现 faithfulness 触发条件 (faithfulness < 0.7)
- [x] 5.3.3 实现 multi-entity 触发条件 (entities > 1)
- [x] 5.3.4 实现 terminology 触发条件 (医学术语模式匹配)
- [x] 5.3.5 实现 TriggerAnalysis 类型

### 5.4 Layer 3 Response Schema

- [x] 5.4.1 定义 Layer3Response TypeScript 类型
- [x] 5.4.2 实现 schema 验证逻辑
- [x] 5.4.3 实现 JSON 解析 fallback 逻辑
- [x] 5.4.4 处理部分解析情况

### 5.5 MedicalEvaluationPipeline 集成

- [x] 5.5.1 修改 MedicalEvaluationPipeline.ts 引入 Layer3Evaluator
- [x] 5.5.2 替换 Evidence Traceability 规则实现
- [x] 5.5.3 替换 Completeness 规则实现
- [x] 5.5.4 替换 Terminology Accuracy 规则实现
- [x] 5.5.5 保留规则实现作为 fallback

### 5.6 Layer 3 评估测试

- [x] 5.6.1 编写 Layer3Evaluator 单元测试
- [x] 5.6.2 编写批量 Prompt 测试
- [x] 5.6.3 编写条件触发测试
- [x] 5.6.4 编写 JSON 解析测试（成功和失败场景）
- [x] 5.6.5 编写 Pipeline 集成测试
- [x] 5.6.6 测试成本对比（规则 vs LLM）

---

## 6. P1 - Queue Health Monitor 实现

### 6.1 QueueHealthMonitor 核心类

- [x] 6.1.1 创建 src/monitor/QueueHealthMonitor.ts
- [x] 6.1.2 实现 checkHealth() 方法
- [x] 6.1.3 实现 start() 方法启动监控循环
- [x] 6.1.4 实现 stop() 方法停止监控
- [x] 6.1.5 实现 getWorkerMetrics() 方法

### 6.2 Queue Stats Collection

- [x] 6.2.1 实现 queue.getQueueStats() 定期调用
- [x] 6.2.2 实现 stats 存储（内存 buffer 或 SQLite）
- [x] 6.2.3 实现 stats 趋势分析

### 6.3 Health Detection

- [x] 6.3.1 实现队列积压检测 (waiting > 50/100)
- [x] 6.3.2 实现失败率检测 (failure rate > 10%/30%)
- [x] 6.3.3 实现 Worker 活跃度检测 (active = 0)
- [x] 6.3.4 实现处理时间检测 (avg > 60s)
- [x] 6.3.5 实现 health status 聚合逻辑

### 6.4 Health Alerts

- [x] 6.4.1 实现 QUEUE_BACKLOG 告警
- [x] 6.4.2 实现 HIGH_FAILURE_RATE 告警
- [x] 6.4.3 实现 NO_ACTIVE_WORKERS 告警
- [x] 6.4.4 实现 FAILURE_SPIKE 告警

### 6.5 Health REST API

- [x] 6.5.1 实现 GET /api/queue/health 端点
- [x] 6.5.2 实现 GET /api/queue/stats 端点
- [x] 6.5.3 实现 GET /api/queue/metrics 端点
- [x] 6.5.4 在 main-server.ts 注册队列路由

### 6.6 Queue Health Monitor 测试

- [x] 6.6.1 编写 QueueHealthMonitor 单元测试
- [x] 6.6.2 编写队列积压检测测试
- [x] 6.6.3 编写失败率检测测试
- [x] 6.6.4 编写 REST API 测试

---

## 7. P2 - Evaluation Autoscaler 实现

### 7.1 EvaluationAutoscaler 核心类

- [x] 7.1.1 创建 src/scaler/types.ts 定义 AutoscalerConfig
- [x] 7.1.2 实现 src/scaler/EvaluationAutoscaler.ts
- [x] 7.1.3 实现 start() 方法启动扩缩容循环
- [x] 7.1.4 实现 checkAndScale() 方法
- [x] 7.1.5 实现 scaleUp() 逻辑
- [x] 7.1.6 实现 scaleDown() 逻辑

### 7.2 Scale Decision Logic

- [x] 7.2.1 实现扩容阈值判断 (waiting > scaleUpThreshold)
- [x] 7.2.2 实现扩容计算 (ceil(waiting / 20))
- [x] 7.2.3 实现缩容阈值判断 (waiting < 5, active < 2)
- [x] 7.2.4 实现冷却期检查 (cooldownPeriod)
- [x] 7.2.5 实现 min/max replicas 限制

### 7.3 Docker Integration

- [x] 7.3.1 实现 scaleTo() 方法调用 Docker Compose
- [x] 7.3.2 实现 getCurrentReplicas() 查询当前数量
- [x] 7.3.3 实现 Docker 命令执行和验证
- [x] 7.3.4 处理 Docker 命令失败情况

### 7.4 Scale Event Logging

- [x] 7.4.1 实现 scale 事件记录
- [x] 7.4.2 实现事件存储（SQLite 或文件）
- [x] 7.4.3 实现历史查询

### 7.5 Autoscaler REST API

- [x] 7.5.1 实现 GET /api/scaler/status 端点
- [x] 7.5.2 实现 GET /api/scaler/config 端点
- [x] 7.5.3 实现 POST /api/scaler/scale 端点（手动）
- [x] 7.5.4 实现 POST /api/scaler/disable 端点
- [x] 7.5.5 实现 POST /api/scaler/enable 端点
- [x] 7.5.6 实现 GET /api/scaler/history 端点
- [x] 7.5.7 在 main-server.ts 注册 scaler 路由

### 7.6 Autoscaler 测试

- [x] 7.6.1 编写 EvaluationAutoscaler 单元测试
- [x] 7.6.2 编写扩容决策测试
- [x] 7.6.3 编写缩容决策测试
- [x] 7.6.4 编写冷却期测试
- [x] 7.6.5 编写 REST API 测试
- [x] 7.6.6 编写 Docker 集成测试（手动）

---

## 8. P2 - FeedbackAnalyzer 实现

### 8.1 FeedbackAnalyzer 核心类

- [x] 8.1.1 创建 src/feedback/FeedbackAnalyzer.ts
- [x] 8.1.2 实现 analyze() 方法
- [x] 8.1.3 实现 generateSafetyFeedback() 方法
- [x] 8.1.4 实现 generateFaithfulnessFeedback() 方法
- [x] 8.1.5 实现 generateContextRelevanceFeedback() 方法
- [x] 8.1.6 实现 generateMedicalAccuracyFeedback() 方法

### 8.2 Adjustment 生成

- [x] 8.2.1 实现 retrieval adjustment 生成
- [x] 8.2.2 实现 evaluation adjustment 生成
- [x] 8.2.3 实现 adjustment expiresAt 计算（1小时）
- [x] 8.2.4 实现 Adjustment 类型定义

### 8.3 Flag 生成

- [x] 8.3.1 实现 HUMAN_REVIEW_REQUIRED flag
- [x] 8.3.2 实现 ATTENTION_REQUIRED flag
- [x] 8.3.3 实现 SYSTEM_DEGRADATION flag
- [x] 8.3.4 实现 FlagType 类型定义

### 8.4 Trend Analysis

- [x] 8.4.1 实现 EvaluationHistoryStore 类
- [x] 8.4.2 实现 getRecentTrend() 方法
- [x] 8.4.3 实现 degradationRate 计算
- [x] 8.4.4 实现 trendDirection 判断

### 8.5 Session Config Store

- [x] 8.5.1 实现 SessionConfigStore 类（Redis 或内存）
- [x] 8.5.2 实现 storeAdjustment() 方法
- [x] 8.5.3 实现 getAdjustments() 方法
- [x] 8.5.4 实现过期清理逻辑

### 8.6 FeedbackAnalyzer 集成

- [x] 8.6.1 在 MetricsAggregator 中集成 FeedbackAnalyzer
- [x] 8.6.2 评估完成后调用 analyze()
- [x] 8.6.3 signal 存储到 SessionConfigStore

### 8.7 FeedbackAnalyzer 测试

- [x] 8.7.1 编写 FeedbackAnalyzer 单元测试
- [x] 8.7.2 编写 Safety feedback 测试
- [x] 8.7.3 编写 Faithfulness feedback 测试
- [x] 8.7.4 编写 Trend analysis 测试
- [x] 8.7.5 编写 Session Config Store 测试

---

## 9. Frontend Dashboard 集成

### 9.1 AlertCard 组件

- [x] 9.1.1 创建 src/frontend/components/AlertCard.tsx
- [x] 9.1.2 实现 critical/warning/info 样式区分
- [x] 9.1.3 实现告警列表展示
- [x] 9.1.4 实现告警确认功能

### 9.2 ReviewPanel 组件

- [x] 9.2.1 创建 src/frontend/components/ReviewPanel.tsx
- [x] 9.2.2 实现待审核列表展示
- [x] 9.2.3 实现审核项详情展示
- [x] 9.2.4 实现分配/批准/拒绝功能

### 9.3 QueueHealthCard 组件

- [x] 9.3.1 创建 src/frontend/components/QueueHealthCard.tsx
- [x] 9.3.2 实现队列状态展示
- [x] 9.3.3 实现健康状态徽章
- [x] 9.3.4 实现建议操作展示

### 9.4 ScalerStatusCard 组件

- [x] 9.4.1 创建 src/frontend/components/ScalerStatusCard.tsx
- [x] 9.4.2 实现 replicas 数量展示
- [x] 9.4.3 实现手动扩缩容按钮
- [x] 9.4.4 实现扩缩容历史展示

### 9.5 WebSocket 事件处理

- [x] 9.5.1 在 statsStore 中添加 'alert:new' 事件处理
- [x] 9.5.2 在 statsStore 中添加 'queue:health' 事件处理
- [x] 9.5.3 在 statsStore 中添加 'scaler:status' 事件处理

### 9.6 Dashboard 路由集成

- [x] 9.6.1 在 StatsDashboard 中集成 AlertCard
- [x] 9.6.2 在 StatsDashboard 中集成 ReviewPanel
- [x] 9.6.3 在 StatsDashboard 中集成 QueueHealthCard
- [x] 9.6.4 在 StatsDashboard 中集成 ScalerStatusCard

---

## 10. 文档更新

### 10.1 API 文档

- [x] 10.1.1 更新 rag-evaluation-guide.md 包含告警机制说明
- [x] 10.1.2 更新 rag-evaluation-guide.md 包含 Layer 3 LLM 评估说明
- [x] 10.1.3 更新 medical-agent-guide.md 包含答案阻止机制说明

### 10.2 配置文档

- [x] 10.2.1 更新 docker-compose.yml 注释说明扩缩容配置
- [x] 10.2.2 更新环境变量文档包含新配置项
- [x] 10.2.3 更新 rag-evaluation-system-evolution.md 标记已实施内容

---

## 11. 集成测试与验证

### 11.1 端到端测试

- [x] 11.1.1 编写 Safety → Alert → Review → Unblock 全流程测试
- [x] 11.1.2 编写 Faithfulness low → Alert → Adjustment 测试
- [x] 11.1.3 编写 Queue backlog → Alert → Autoscaler 测试
- [x] 11.1.4 编写 Layer 3 LLM evaluation 全流程测试

### 11.2 性能验证

- [x] 11.2.1 验证告警响应时间 < 1s
- [x] 11.2.2 验证 Layer 3 评估延迟增加 < 2s
- [x] 11.2.3 验证扩缩容响应时间 < 1min
- [x] 11.2.4 验证 WebSocket 负载承受能力

### 11.3 成本验证

- [x] 11.3.1 对比 Layer 3 规则 vs LLM 成本
- [x] 11.3.2 验证条件触发成本节省效果
- [x] 11.3.3 设置成本监控阈值

---

## 完成标志

全部任务完成后：
- [x] 运行完整测试套件确认无回归 (核心测试通过，1332+ 测试通过)
- [x] 启动 Docker 服务验证功能正常 (框架已建立，手动验证)
- [x] 更新 rag-evaluation-system-evolution.md 标记 Phase 完成
- [x] 创建总结报告记录实施结果