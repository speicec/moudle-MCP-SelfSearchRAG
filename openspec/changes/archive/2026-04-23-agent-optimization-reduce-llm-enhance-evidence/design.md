## Context

### Current Architecture

Medical Agent 采用双模式执行架构：

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  ReAct Mode     │     │  Planning Mode  │     │  Direct Mode    │
│  (简单查询)     │     │  (复杂查询)     │     │  (低置信度)     │
│                 │     │                 │     │                 │
│ Think → Act →   │     │ Plan → DAG →    │     │ 直接检索 →      │
│ Observe →       │     │ Execute →       │     │ Answer          │
│ Decide → Answer │     │ Replan          │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Current LLM Call Chain (ReAct)

每次迭代调用 2-3 次 LLM：

```
Iteration 1:
  think()       → LLM Call #1 (reasonClinical)
  act()         → 可能 LLM (expand_query)
  decide()      → LLM Call #2 (判断是否满足)
  
Iteration 2-N: 同上

Final:
  generateAnswer() → LLM Call #N+1
```

典型查询：5-15 次 LLM 调用，耗时 10-40 秒。

### Current Evidence Evaluation

`evidence-evaluator.ts` 仅评估：

| 维度 | 实现方式 | 局限性 |
|------|---------|--------|
| 文献类型 | 关键词匹配 | 无法区分 RCT 质量 |
| GRADE 等级 | 文献类型映射 | 单维度，无权重 |
| 时效性 | 年份判断 (>5年过期) | 无年份权重，新版不优先 |

缺失维度：
- 来源权威性（ADA vs 地方共识）
- 证据一致性（多来源是否一致）
- 时效权重（2024 vs 2020 指南）
- 综合评分（多维度融合）

## Goals / Non-Goals

**Goals:**

1. 减少 ReAct 模式 LLM 调用 40-70%
2. 响应时间降低 30-50%
3. 证据评估新增权威性、一致性、时效权重维度
4. 高质量证据优先回答生成
5. 保持现有回答格式和 API 兼容性

**Non-Goals:**

1. 不改变 Agent 架构（保持单 Agent + ReAct/Planning 双模式）
2. 不扩展医学领域（保持内分泌垂类）
3. 不引入多 Agent 框架（AutoGen/CrewAI）
4. 不改变 MCP Tool 和 HTTP API 接口
5. 不修改实体识别和 SafetyLayer 逻辑

## Decisions

### Decision 1: 规则化 decide() vs 合并 think+decide

**选择：规则化 decide()**

| 方案 | 优点 | 缺点 | 投入 |
|------|------|------|------|
| A. 规则化 decide | 改动小，风险低，可验证 | 规则可能不覆盖边缘场景 | 0.5天 |
| B. 合并 think+decide | 调用更少 | 改动大，Prompt 需重构 | 1天 |
| C. 小模型 decide | 成本更低 | 仍需 LLM 调用 | 1天 |

选择 A 的原因：
- 改动范围最小，仅 `AgentExecutor.ts decide()` 函数
- 规则逻辑清晰，可单元测试验证
- 风险低，可快速回滚

规则判断条件：
```typescript
function decideByRules(state: AgentState): boolean {
  // 规则 1: 检索结果数量 >= 3
  const resultCount = state.retrievalResults?.length ?? 0;
  if (resultCount >= 3) return true;

  // 规则 2: 最高相似度 > 0.7
  const maxSimilarity = Math.max(
    ...state.retrievalResults?.map(r => r.similarityScore ?? 0) ?? [0]
  );
  if (maxSimilarity > 0.7) return true;

  // 规则 3: 实体覆盖率 >= 80%
  const entityCoverage = calculateEntityCoverage(state);
  if (entityCoverage >= 0.8) return true;

  // 规则 4: SafetyLayer 绝对禁忌已确定
  if (state.safetyAssessment?.severity === 'absolute') return true;

  return false;
}
```

### Decision 2: 提前终止触发条件

**选择：绝对禁忌立即终止**

触发条件：
- SafetyLayer 评估结果 `severity === 'absolute'`

终止流程：
```
SafetyLayer 绝对禁忌 → 跳过 ReAct 循环 → 直接 generateAnswerFromSafety()
                                             │
                                             ↓
                                    使用 SafetyAssessment 推荐
                                    无需检索（禁忌已明确）
```

不触发条件：
- `severity === 'relative'`：仍需检索补充证据
- `severity === 'interaction'`：需检索相互作用详情
- `severity === 'safe'`：正常 ReAct 流程

### Decision 3: 证据评估维度选择

**新增维度：**

| 维度 | 权重 | 实现方式 | 说明 |
|------|------|---------|------|
| GRADE 等级 | 0.4 | 现有 | 文献类型映射 |
| 来源权威性 | 0.2 | 新增 | international/national/local |
| 时效权重 | 0.2 | 新增 | 年份线性衰减 |
| 证据一致性 | 0.1 | 新增 | 多来源结论是否一致 |
| 适用性 | 0.1 | 暂不实现 | 需医学知识，复杂度高 |

**Authority Mapping（内分泌领域）：**

```
International (权重 1.0):
  - ADA Standards of Care
  - KDIGO Guidelines
  - ESC/ESH Guidelines
  - ATA Guidelines

National (权重 0.8):
  - CDS 中国糖尿病防治指南
  - CSH 中国高血压防治指南
  - CETA 中国甲状腺疾病诊治指南

Local (权重 0.6):
  - 地方指南/共识
  - 医院内部指南
```

### Decision 4: 时效权重计算公式

**选择：线性衰减**

```typescript
function calculateTimeWeight(year: number | undefined): number {
  if (year === undefined) return 0.7; // 无年份信息，默认中等权重
  
  const currentYear = new Date().getFullYear();
  const yearsSincePublication = currentYear - year;
  
  // 2024 → 1.0, 2023 → 0.95, 2022 → 0.9, ...
  // 每年衰减 0.05，最低 0.5
  const weight = 1.0 - yearsSincePublication * 0.05;
  return Math.max(weight, 0.5);
}
```

替代方案：
- 指数衰减：过于激进，老旧指南权重过低
- 阶梯式：2024=1.0, 2022-2023=0.8, 2020-2021=0.6 → 边界问题

选择线性衰减原因：简单、平滑、可控。

### Decision 5: 证据一致性检查

**实现方案：语义相似度**

```typescript
function checkConsistency(
  evidenceEvaluations: EnhancedEvidenceEvaluation[]
): number {
  // 提取各来源结论（简化：从检索结果 content 中提取）
  const conclusions = evidenceEvaluations.map(e => e.conclusionText);
  
  // 计算结论之间的语义相似度
  // 一致性 = 平均 pairwise similarity
  let totalSimilarity = 0;
  let pairCount = 0;
  
  for (let i = 0; i < conclusions.length; i++) {
    for (let j = i + 1; j < conclusions.length; j++) {
      totalSimilarity += calculateTextSimilarity(conclusions[i], conclusions[j]);
      pairCount++;
    }
  }
  
  return pairCount > 0 ? totalSimilarity / pairCount : 1.0;
}
```

简化方案：
- 暂不使用 LLM 提取结论（避免额外调用）
- 使用关键词匹配判断一致/冲突
- 一致性分数范围 [0, 1]，0.8+ 为高一致性

## Risks / Trade-offs

### Risk 1: 规则化 decide 可能漏判

**风险**：规则可能不覆盖所有场景，导致提前终止或过度迭代。

**缓解**：
- 设置保守阈值（检索 >= 3 才满足）
- 保留 maxIterations 作为兜底
- 添加规则命中日志，监控规则覆盖率
- 后续可基于日志优化规则

### Risk 2: 证据一致性检查复杂度高

**风险**：语义相似度计算可能耗时，影响响应速度。

**缓解**：
- 首版使用简单关键词匹配
- 仅检查前 3 个高质量证据
- 一致性检查可异步（不影响回答生成）

### Risk 3: 权威性分级不准确

**风险**：来源名称匹配可能漏识别或误识别。

**缓解**：
- 使用明确关键词（ADA, KDIGO, ESC, CDS）
- 未匹配来源默认 national 级别
- 可通过反馈日志持续优化

### Trade-off 1: 规则化 vs LLM 灵活性

**权衡**：规则化降低灵活性，无法处理复杂场景。

**接受原因**：
- 医学场景多为确定性判断（禁忌、阈值）
- SafetyLayer 已处理复杂安全场景
- 规则可覆盖 80%+ 常见场景

### Trade-off 2: 时效权重 vs 老指南价值

**权衡**：时效权重降低老指南权重，但某些经典建议仍有效。

**接受原因**：
- 最低权重 0.5，老指南仍有贡献
- 医学指南更新频繁，新版更可靠
- 可通过一致性检查保留有效建议

## Migration Plan

### Phase 1: 规则化 decide (Day 1)

1. 实现 `decideByRules()` 函数
2. 修改 `AgentExecutor.ts decide()` 调用规则函数
3. 单元测试验证规则覆盖场景
4. 灰度发布：监控规则命中率

### Phase 2: 提前终止 (Day 1)

1. 修改 `executeReactMode()` 添加提前终止分支
2. 实现 `generateAnswerFromSafety()` 函数
3. 单元测试绝对禁忌场景
4. 验证回答格式不变

### Phase 3: 增强证据评估 (Day 2-3)

1. 扩展 `EvidenceEvaluation` 类型定义
2. 实现权威性分级函数
3. 实现时效权重函数
4. 实现一致性检查函数（简化版）
5. 实现综合评分函数
6. 集成到 `evaluateMultipleSources()`

### Phase 4: 验证与监控 (Day 4)

1. 端到端测试验证 LLM 调用减少
2. 验证证据评估输出格式
3. 添加性能监控（LLM 调用次数、响应时间）
4. 文档更新

### Rollback Strategy

若规则化 decide 出现问题：
- 保留原有 `decide()` LLM 调用代码
- 通过配置开关切换规则/LLM 模式
- 配置项：`useRuleBasedDecide: boolean`

若证据评估增强出现问题：
- 新增字段为可选（不影响现有逻辑）
- 综合评分兼容原有 GRADE 等级

## Open Questions

1. **一致性检查是否需要 LLM？**
   - 当前方案：关键词匹配，不调用 LLM
   - 后续考虑：低成本 LLM（Haiku）提取结论

2. **RCT 质量评分是否纳入？**
   - 当前方案：暂不实现，需医学专业知识
   - 后续考虑：与医学专家合作定义评分标准

3. **缓存机制是否激活？**
   - AgentCache.ts 已存在但未使用
   - 后续变更可考虑激活