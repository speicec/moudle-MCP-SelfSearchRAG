# 7 维组合检查报告

## 时间: 2026-04-23 14:30
## 检查范围:
- `src/medical/agent/AgentExecutor.ts`
- `src/medical/agent/AgentLogger.ts`
- `src/medical/agent/MedicalReasoner.ts`
- `src/medical/agent/TraceVisualizer.ts`
- `src/medical/evidence-evaluator.ts`
- `src/medical/types.ts`
- `src/config/redis-config.ts`
- `src/tracing/TraceContext.ts`
- `src/tracing/TraceStorage.ts`
- `src/tracing/types.ts`
- `src/tracing/MetricsAggregator.ts`
- `src/evaluation/MedicalEvaluationPipeline.ts`
- `src/evaluation/types.ts`
- `src/queue/EvaluationQueue.ts`
- `src/queue/EvaluationWorker.ts`
- `src/workers/evaluation-worker.ts`

---

## 1. 设计一致性检查

### 状态: ⚠ 存在偏差

### 契约一致项
✓ `TraceContext` - 核心结构与设计一致 (traceId, sessionId, timestamp, phases, retrieval, llmCalls, answer)
✓ `TraceStorage` - SQLite Schema 与设计一致 (traces, spans, llm_calls, evaluations 表)
✓ `EvaluationPipeline` - RAGAS 三指标 与设计一致
✓ `TraceVisualizer` - 扩展的 TraceContext 集成与设计一致

### 偏差列表

#### Important
1. **数据结构简化偏差** - `src/tracing/types.ts:157-204`
   - 设计期望: MedicalAccuracyResult 包含 `details: { terminologyMatch, guidelineAdherence }`
   - 实际实现: tracing/types.ts 中简化版本缺少 details 字段，evaluation/types.ts 有完整版本
   - 影响: 两处定义不一致，可能导致类型混淆

2. **SafetyAssessmentResult 结构差异** - `src/tracing/types.ts:167-175`
   - 设计期望: contraindications 包含 `{ type, details }` 嵌套结构
   - 实际实现: tracing/types.ts 简化为 `contraindications: string[]`
   - 影响: 类型定义不统一，需使用 evaluation/types.ts 的完整版本

3. **EvaluationResult 缺少 contextRecall 可选字段** - `src/tracing/types.ts:128`
   - 设计期望: metrics 包含可选的 `contextRecall?: { score, groundTruth }`
   - 实际实现: 未包含 contextRecall 字段
   - 影响: 与 RAGAS 标准评估指标不完全匹配

#### Minor
4. **MetricsAggregator 方法签名差异** - `src/tracing/MetricsAggregator.ts:187`
   - 设计期望: `broadcastUpdate(trace: TraceContextData, evaluation?: EvaluationResult)`
   - 实际实现: 参数拆分为多个独立参数，签名不一致但功能等效

---

## 2. 安全检查

### 状态: ⚠ 存在风险

### 发现问题

#### Critical
1. **[OWASP A02] API Key 硬编码风险** - `src/queue/EvaluationWorker.ts:63-66`
   ```typescript
   apiKey: process.env.DEEPSEEK_API_KEY,
   ```
   - 问题: 虽然使用环境变量，但无默认值校验，apiKey 可能为 undefined 导致请求泄露
   - 建议: 添加 apiKey 存在性校验，缺失时抛出配置错误

#### Important
2. **[OWASP A03] SQL 注入防护不完整** - `src/tracing/TraceStorage.ts:419-430`
   - 问题: `getEvaluationTrends` 使用参数化查询 `WHERE timestamp >= ?`，但 `startDate.toISOString()` 直接传递
   - 风险等级: 低（参数化查询已防护）
   - 建议: 保持当前参数化方式，但添加输入范围校验

3. **[OWASP A01] 输入校验缺失** - `src/tracing/TraceStorage.ts:453-478`
   - 问题: `clearOldTraces(days)` 未校验 days 范围，可能传入负数或超大值
   - 建议: 添加 `if (days < 0 || days > 365) throw Error('Invalid days range')`

#### Minor
4. **敏感日志泄露风险** - `src/medical/agent/AgentLogger.ts:103`
   - 问题: `console.log` 输出可能包含敏感数据 (entity 匹配信息)
   - 建议: 生产环境禁用 debug 级别日志

5. **Redis 密码明文传输** - `src/config/redis-config.ts:108-111`
   - 问题: `getRedisConnectionString` 将密码拼接为 URL，可能泄露到日志
   - 建议: 仅用于内部连接，避免日志输出

---

## 3. 并发检查

### 状态: ⚠ 存在风险

### 发现问题

#### High
1. **资源泄露风险** - `src/tracing/TraceStorage.ts:120-137`
   - 问题: `init()` 方法创建 Database 实例但无失败时的清理逻辑
   - 风险: 若 `fs.readFile` 失败后继续 `new SQL.Database()`, 可能导致内存泄露
   - 建议: 添加 try-catch 确保资源正确释放

2. **Worker 进程未处理异常** - `src/workers/evaluation-worker.ts:61-69`
   - 问题: `uncaughtException` 和 `unhandledRejection` 处理中调用 `stopWorkerProcess()` 但未 await
   ```typescript
   process.on('uncaughtException', (error: Error) => {
     console.error('[Worker] Uncaught exception:', error);
     stopWorkerProcess().then(() => process.exit(1));  // 未 await，可能资源未释放
   });
   ```
   - 建议: 使用 `await` 或同步退出 `process.exit(1)`

3. **队列并发控制不完整** - `src/queue/EvaluationQueue.ts:67-71`
   - 问题: `resultHandlers` Map 在多 Worker 场景下可能竞态
   - 风险: 多个 Worker 处理同一 job 时 handler 可能被多次调用
   - 建议: 使用 Redis 分布式锁或原子操作

#### Medium
4. **Bull Queue 事件监听内存泄露** - `src/queue/EvaluationQueue.ts:102-123`
   - 问题: `resultHandlers.set(job.id, handlers)` 在 `completed` 后删除，但 `failed` 事件未删除
   - 建议: 在 `failed` 处理中也执行 `this.resultHandlers.delete(job.id)`

5. **TraceStorage 初始化竞态** - `src/tracing/TraceStorage.ts:120-122`
   ```typescript
   async init(): Promise<void> {
     if (this.initialized) return;
     // 多并发调用可能导致重复初始化
   ```
   - 建议: 使用 Promise 锁或 `await` 确保单次初始化

---

## 4. 复杂度检查

### 整体统计
| 指标 | 平均值 | 最大值 | 阈值 | 状态 |
|------|--------|--------|------|------|
| 圈复杂度 | 4.5 | 12 | 10 | ⚠ |
| 认知复杂度 | 8 | 18 | 15 | ⚠ |
| 函数长度 | 45 | 180 | 50 | ✗ |
| 嵌套深度 | 2 | 5 | 4 | ⚠ |

### 超标函数

| 函数 | 文件 | 圈复杂度 | 认知复杂度 | 长度 | 建议 |
|------|------|----------|------------|------|------|
| `run()` | AgentExecutor.ts:209-268 | 12 | 18 | 60 | 拆分为多个子方法 |
| `executeReactMode()` | AgentExecutor.ts:464-663 | 8 | 15 | 200 | 拆分为 think/act/observe/decide 四步 |
| `decideByRules()` | AgentExecutor.ts:829-875 | 6 | 8 | 46 | 保持现状 |
| `calculateEntityCoverage()` | AgentExecutor.ts:894-944 | 5 | 10 | 50 | 略长，可拆分 |
| `evaluate()` | MedicalEvaluationPipeline.ts:48-136 | 7 | 12 | 89 | 按 Layer 分拆 |

### Critical 超标详情

**`executeReactMode` - 200 行，嵌套深度 5**
- 问题: 单函数包含完整 ReAct 循环，包含 while 循环 + 多层嵌套 if
- 建议:
  1. 拆分为 `initState()` + `reactLoop()` + `finalAnswer()` 三步
  2. 提取 `handleEarlyTermination()` 方法 (496-540行)

---

## 5. 错误处理检查

### 状态: ⚠ 存在问题

### 发现问题

#### Critical
1. **错误吞没 (空 catch)** - `src/medical/agent/AgentExecutor.ts:658-660`
   ```typescript
   this.persistTrace().catch(err => {
     this.logger.log(0, 'trace', 'Failed to persist trace', { error: err.message }, 'warn');
   });
   ```
   - 问题: 错误仅记录日志，不影响主流程，但可能导致追踪数据丢失
   - 影响: 异步持久化失败时用户无感知
   - 建议: 添加持久化失败计数和告警机制

2. **错误吞没 (空 catch)** - `src/tracing/TraceStorage.ts:515-517`
   ```typescript
   catch (error) {
     console.error('[TraceStorage] Failed to persist:', error);
   }
   ```
   - 问题: 持久化失败仅日志，无重试或恢复机制
   - 建议: 抛出错误或返回失败状态

#### High
3. **错误链断裂 (cause 未保留)** - `src/tracing/TraceStorage.ts:144-146`
   ```typescript
   private ensureInit(): void {
     if (!this.initialized || !this.db) {
       throw new Error('TraceStorage not initialized. Call init() first.');
     }
   }
   ```
   - 问题: 未包含原始错误信息
   - 建议: 添加 `cause` 保留原始错误

4. **JSON 解析失败默认值** - `src/evaluation/MedicalEvaluationPipeline.ts:242-252`
   ```typescript
   try {
     return JSON.parse(response);
   } catch {
     return { score: 0.7, ... };  // 默认值可能掩盖 LLM 输出异常
   }
   ```
   - 问题: 多处 catch 后返回默认值，可能掩盖 LLM 质量问题
   - 建议: 记录解析失败日志，添加 retry 逻辑

#### Medium
5. **Worker 异常处理不完整** - `src/queue/EvaluationWorker.ts:143-158`
   - 问题: 失败结果返回 `{ success: false, error }` 但未包含错误栈
   - 建议: 添加 `errorStack` 字段用于调试

---

## 6. 辅助检查

### 代码规范问题

| 问题 | 位置 | 建议 |
|------|------|------|
| 魔法数字 | MedicalEvaluationPipeline.ts:408 | `s.trim().length > 10` → 常量 MIN_CLAIM_LENGTH |
| 魔法数字 | TraceStorage.ts:453 | days 范围未校验 → MAX_CLEAR_DAYS = 365 |
| 重复代码 | AgentExecutor.ts:829/1214 | `decideByRules` 两个版本 → 统一导出 |
| 类型断言 | TraceStorage.ts:314/345 | `as string` 多处使用 → 定义 RowParser 类型 |
| 未使用 import | TraceVisualizer.ts:10 | IntentAnalysis, TaskDAG 仅类型使用 → 保持现状 OK |

### 性能问题

| 问题 | 位置 | 影响 | 建议 |
|------|------|------|------|
| N+1 查询 | TraceStorage.ts:401-406 | getRecentTraces 循环调用 getSpans/getLLMCalls | 使用 JOIN 一次查询 |
| 循环内重复计算 | AgentExecutor.ts:842-843 | `state.retrievalResults?.map(...)` 多次调用 | 缓存到变量 |
| JSON.stringify 多次调用 | TraceStorage.ts:176-180 | 每次保存重复序列化 | 批量处理 |

### 测试覆盖缺口

| 缺失测试 | 文件 | 建议 |
|------|------|------|
| 并发场景测试 | TraceStorage.ts | 添加多进程写入测试 |
| Worker 异常恢复测试 | EvaluationWorker.ts | 添加 stuck job 处理测试 |
| LLM 调用失败测试 | MedicalEvaluationPipeline.ts | 添加 retry 逻辑测试 |
| Redis 连接断开测试 | EvaluationQueue.ts | 添加连接恢复测试 |

### 文档完整性

| 缺失文档 | 位置 | 建议 |
|------|------|------|
| API 文档 | TraceContext.ts | 添加 class 级别 JSDoc |
| 配置说明 | redis-config.ts | 添加环境变量说明 |
| 部署文档 | evaluation-worker.ts | 添加 Docker 部署说明 |

---

## 7. 总体质量评审

### 优点
- **架构设计清晰**: 分层结构 (收集层→处理层→聚合层) 符合设计文档
- **类型定义完善**: TraceContextData, EvaluationResult 类型完整
- **异步处理机制**: Bull 队列解耦评估任务，不阻塞主流程
- **规则化决策**: AgentExecutor.decideByRules 提供确定性决策路径
- **数据持久化**: SQLite 存储 + 索引设计合理

### Critical 问题 (必须修复)

1. **API Key 校验缺失** - `src/queue/EvaluationWorker.ts:63`
   - 修复: 添加 apiKey 存在性校验

2. **executeReactMode 函数过长** - `src/medical/agent/AgentExecutor.ts:464-663`
   - 修复: 拆分为多个子方法

3. **资源泄露风险** - `src/tracing/TraceStorage.ts:120-137`
   - 修复: 添加 init() 失败清理逻辑

### Important 问题 (应该修复)

1. **类型定义不一致** - tracing/types.ts vs evaluation/types.ts
   - 修复: 统一到 evaluation/types.ts

2. **错误吞没多处** - AgentExecutor.ts:658, TraceStorage.ts:515
   - 修复: 添加错误追踪和恢复机制

3. **Worker 异常处理不完整** - `src/workers/evaluation-worker.ts:61-69`
   - 修复: 确保资源释放

4. **并发竞态风险** - `src/queue/EvaluationQueue.ts:67-71`
   - 修复: 添加分布式锁或原子操作

5. **N+1 查询性能问题** - `src/tracing/TraceStorage.ts:401-406`
   - 修复: 使用 JOIN 合并查询

### Minor 问题 (可延后)

- 魔法数字提取为常量
- 日志级别生产环境控制
- 文档补充

### 可以合并: **修复 Critical 问题后可以**

### 建议修复顺序
1. API Key 校验 (安全 Critical)
2. executeReactMode 函数拆分 (复杂度 Critical)
3. TraceStorage init() 清理逻辑 (并发 Critical)
4. 类型定义统一
5. 错误处理完善 (cause 保留)
6. Worker 异常处理 await
7. N+1 查询优化

---

## 综合评分

| 维度 | 状态 | 问题数 |
|------|------|--------|
| 设计一致性 | ⚠ | 4 |
| 安全 | ⚠ | 5 |
| 并发 | ⚠ | 5 |
| 复杂度 | ✗ | 6 |
| 错误处理 | ⚠ | 5 |
| 辅助 | ⚠ | 8 |
| 总体 | ⚠ | 33 |

| 严重程度 | 数量 |
|----------|------|
| Critical | 3 |
| Important | 7 |
| Minor | 23 |

## 总结建议

→ **立即修复 Critical 问题**
  - API Key 校验缺失
  - executeReactMode 函数拆分
  - TraceStorage init() 清理逻辑

→ **尽快处理 Important 问题**
  - 类型定义统一
  - 错误处理完善 (cause 保留 + 避免空 catch)
  - Worker 异常处理 await
  - 并发竞态风险
  - N+1 查询优化

→ **可延后 Minor 问题**
  - 魔法数字提取
  - 日志控制
  - 文档补充
  - 测试覆盖扩展