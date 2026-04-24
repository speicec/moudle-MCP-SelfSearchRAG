## Context

**Current State**:
- 后端 `evidence-evaluator.ts` 完整实现 GRADE 评估（文献类型、权威性、时效性、一致性、综合评分）
- `AgentExecutor.ts:577-584` 已调用 `evaluateMultipleSourcesEnhanced()` 并存入 `state.evidenceEvaluation`
- 但 `buildResult()` 中未将 `evidenceEvaluation` 传入 `AgentResult`
- WebSocket 事件只传递 `thinkingContent` + `answerContent`，不含 GRADE 数据
- 前端 `RetrievalResultItem` 只有 `similarityScore`，`EvidenceCard` 用简单阈值映射 A-D

**Data Flow Gap**:
```
state.evidenceEvaluation (有数据)
         ↓
buildResult() → AgentResult (数据丢失)
         ↓
WebSocket events (无 GRADE 字段)
         ↓
Frontend RetrievalResultItem (只有 similarityScore)
         ↓
EvidenceCard (自己计算 A-D，非 GRADE)
```

**Constraints**:
- 必须向后兼容，新字段可选
- 不修改 `evidence-evaluator.ts` 核心逻辑（已完善）
- 前端无 GRADE 数据时需 fallback

## Goals / Non-Goals

**Goals**:
- 将 GRADE 评估数据完整传递到前端
- 前端 EvidenceCard 显示真实的循证医学 GRADE 等级
- 显示文献类型（RCT/指南/案例报告等）
- 显示权威性级别（国际/国家/本地）
- 显示时效性警告
- 保持向后兼容

**Non-Goals**:
- 不修改 GRADE 评估计算逻辑
- 不修改检索流程
- 不增加新的评估维度
- 不修改 answer-generator.ts 的回答生成逻辑

## Decisions

### Decision 1: 数据传递层级

**问题**: GRADE 数据在哪个层级附加到检索结果？

**方案对比**:

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| A: 后端统一附加 | AgentExecutor 在 buildResult 时统一附加 | 集中处理，逻辑清晰 | 需修改 AgentResult |
| B: 检索层附加 | HybridRetriever 返回时附加 | 更早附加，影响范围小 | Retrieval 层不应有医学逻辑 |
| C: API 层附加 | chat.ts 路由层附加 | 最晚附加，灵活 | 需多次评估，效率低 |

**决策**: 采用方案 A，在 `AgentExecutor.buildResult()` 中附加。

**理由**: GRADE 评估是医学 Agent 的核心逻辑，应在 Agent 层处理。检索层只负责相似度计算，不应包含医学领域知识。

### Decision 2: WebSocket 事件结构扩展

**问题**: 如何扩展 WebSocket 事件携带 GRADE 数据？

**方案对比**:

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| A: 扩展现有事件 | 在 retrieval:complete 中添加 evidenceEvaluation 字段 | 向后兼容，简单 | 事件结构变大 |
| B: 新增独立事件 | 新增 evidence:evaluated 事件 | 解耦清晰 | 增加事件复杂度 |
| C: 合并到 generation:complete | 只在最终回答事件中包含 | 减少事件数量 | 用户看不到实时 GRADE |

**决策**: 采用方案 A，扩展 `retrieval:complete` 和 `generation:complete` 事件。

**理由**: GRADE 是检索结果的元数据，应在 retrieval 事件中携带；同时 generation:complete 事件也需要包含，因为 Agent 循环可能多次检索。

### Decision 3: 前端 GRADE 与 similarityScore 关系

**问题**: 前端如何处理 GRADE 数据与现有 similarityScore？

**方案对比**:

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| A: GRADE 优先 | 有 GRADE 用 GRADE，无则用 similarityScore fallback | 数据准确，兼容旧版本 | 两个体系共存可能混淆 |
| B: 同时显示 | 显示 GRADE 等级 + 匹配度百分比 | 信息完整 | UI 空间有限，可能冗余 |
| C: 完全替换 | 移除 similarityScore，只用 GRADE | 统一体系 | 旧数据无 GRADE 时无显示 |

**决策**: 采用方案 A（GRADE 优先 + fallback），同时在展开视图中显示匹配度百分比作为补充信息。

**理由**: GRADE 是医学意义的证据等级，匹配度是技术意义的检索得分。两者意义不同，但 GRADE 优先更符合用户需求。

## Risks / Trade-offs

### Risk 1: 数据一致性风险

**风险**: 检索结果与 GRADE 评估结果数量/顺序不匹配

**Mitigation**: 
- GRADE 评估在 retrieval observe 之后立即执行
- 使用同一数组索引关联
- 添加 validation check: `evidenceEval.length === retrievalResults.length`

### Risk 2: 前端兼容性风险

**风险**: 旧版前端收到新数据结构可能解析失败

**Mitigation**: 
- 新字段均为可选 (`evidenceEvaluation?:`)
- 前端用 `if (result.evidenceEvaluation?.grade)` 检查
- 旧版前端忽略新字段

### Risk 3: 性能风险

**风险**: GRADE 评估增加响应时间

**Mitigation**: 
- GRADE 评估是关键词匹配 + 数值计算，无 LLM 调用
- 已在 Agent 循环中执行，无需额外时间
- 只需传递数据，无额外计算开销

### Trade-off 1: 两个 A-D 体系共存

**问题**: 前端 EvidenceCard 的 A-D（基于 similarityScore）与后端 GRADE 的 A-D（基于文献类型）意义不同

**处理**: 
- 明确命名区分：GRADE 等级 vs 匹配度等级
- UI 显示 "GRADE A (RCT)" 而非简单 "A"
- 文献类型标签澄清含义

## Open Questions

1. **是否需要在 Stats Dashboard 中展示 GRADE 分布？**
   - 当前 scope 未包含，可作为后续优化

2. **文献类型关键词识别是否需要 LLM 增强？**
   - 当前基于关键词匹配，可能漏识别
   - 可在后续迭代中加入 LLM 分类

3. **是否需要缓存 GRADE 评估结果？**
   - 同一文档多次检索结果相同，可缓存
   - 当前 scope 未包含，性能影响较小