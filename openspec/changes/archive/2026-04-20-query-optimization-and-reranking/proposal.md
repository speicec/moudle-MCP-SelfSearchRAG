# Proposal: Query Optimization and Reranking

## Summary

增强RAG系统的检索召回率和精确度，通过引入查询优化层和重排精排层，解决当前系统的两大缺陷：
1. 直接使用原始Query检索，无法处理口语化表达和复杂多维度问题
2. 固定topK截断，不考虑模型上下文窗口动态变化，无置信度排序机制

---

## Problem Statement

### 当前系统的缺陷

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  现有流程问题                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Query直接使用，无优化                                                    │
│     • 口语化表达 → embedding语义漂移 → 漏掉相关文档                          │
│     • 复杂问题 → 单次检索 → 无法覆盖多维度                                   │
│                                                                             │
│  2. 固定topK=5，不考虑上下文窗口                                             │
│     • 64K模型窗口只填充4000 tokens (6%) → 资源浪费                          │
│     • 无置信度排序 → 低质量结果可能排在前面                                  │
│                                                                             │
│  3. 无"我不知道"机制                                                         │
│     • 低置信度结果强行组装context → LLM可能编造                              │
│                                                                             │
│  实测影响:                                                                   │
│  • 召回率不足导致的漏答率 ≈ 15-25%                                          │
│  • 低置信度结果导致的错误回答率 ≈ 10%                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 用户场景

| 场景 | 当前系统行为 | 期望行为 |
|------|-------------|---------|
| 用户问"怎么让系统跑得更快" | embedding匹配"跑得更快"字面，可能漏掉"性能优化"文档 | Query重写为"系统性能优化"，提高命中率 |
| 用户问"对比Redis和Memcached的优缺点" | 单次检索，可能只命中部分内容 | Query分解为3个子查询，并行检索后合并 |
| 用户问"2023年销售数据" | 无元数据过滤，返回所有年份文档 | Query DSL构建过滤条件，精准检索 |
| 所有检索结果相似度<0.3 | 强行组装context，LLM可能编造答案 | 直接返回"未找到相关信息" |

---

## Proposed Solution

### 核心架构

引入三个新Stage：

1. **QueryOptimizationStage** - 查询优化层
2. **DynamicTopKCalculator** - 动态topK计算
3. **RerankingStage** - 置信度精排层

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     改造后流程                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Query → QueryAnalyzer → [Rewrite/Decompose/DSL] → Expansion               │
│                                                                             │
│  Multi-Query Retrieval → DynamicTopK (粗排)                                │
│                                                                             │
│  Confidence Check (avg < 0.3 → "未找到相关信息")                            │
│                                                                             │
│  Reranking (≤20用本地模型 / >20用内部计算) → 精排                           │
│                                                                             │
│  Dynamic Truncation → Context Assembly → LLM Generation                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Design Decisions

### D1: 模型上下文窗口配置

提供三档预设配置：
- 32K (轻量场景)
- 64K (标准场景，默认)
- 128K (大上下文场景)

### D2: Reranker策略 - 混合方案

动态选择Reranker：
- 粗排结果 ≤ 20个：使用本地 `bge-reranker-v2-m3` (高准确性)
- 粗排结果 > 20个：使用内部置信度计算 (快速、低成本)

避免大样本场景下本地模型的计算瓶颈。

### D3: Query Decomposition - 需要实现

复杂查询分解为子查询：
- LLM判断Query复杂度
- 分解为最多5个SubQueries
- 并行检索 → 结果合并

### D4: 低置信度处理

当所有粗排结果置信度 < 0.3：
- 直接返回"未找到相关信息"
- 不组装context，不调用LLM生成
- 提供建议："请尝试其他关键词"

---

## Success Criteria

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| 召回率（答案在检索结果中） | ~75% | ≥90% |
| 精确度（高置信度结果排序靠前） | 无排序 | 置信度排序 |
| 上下文利用率 | 6% (4000/64K) | 60% |
| 低置信度误答率 | ~10% | 0% (直接告知未找到) |
| 复杂Query处理成功率 | 60% | ≥85% |

---

## Scope

### In Scope

- QueryAnalyzer: 分析Query复杂度和类型
- QueryRewriter: LLM重写口语化表达
- QueryDecomposer: 分解复杂问题为子查询
- QueryDSLBuilder: 构建结构化过滤条件
- QueryExpander: 同义词/相关词扩展
- DynamicTopKCalculator: 基于模型窗口动态计算
- ConfidenceCalculator: 内部置信度计算
- LocalReranker: 本地bge-reranker-v2-m3集成
- LowConfidenceHandler: 低置信度返回机制
- ContextAssembler改造: 附带置信度元数据
- LLMPrompt改造: 包含置信度信息

### Out of Scope

- 向量数据库替换（当前是内存存储）
- 多租户支持
- 实时索引更新
- 用户反馈收集系统

---

## Risks and Mitigations

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LLM查询优化增加延迟 | 检索前多一次LLM调用 | 异步并行处理，缓存Query分析结果 |
| 本地Reranker资源消耗 | GPU/内存占用 | 仅在≤20样本时使用，大样本fallback |
| Query Decomposition过度分解 | 检索次数增多 | 限制maxSubQueries=5，简单Query不分解 |
| 动态topK计算不准确 | Token超限或不足 | 实际Token累加验证，可配置调整 |

---

## Dependencies

- DeepSeek API (Query优化LLM调用)
- bge-reranker-v2-m3 本地模型部署
- 现有SmallToBigRetriever改造
- HierarchicalStore新增avgParentTokenLength方法

---

## Timeline Estimate

| 阶段 | 任务 | 预估工作量 |
|------|------|-----------|
| Phase 1 | QueryOptimizationStage实现 | 中等 |
| Phase 2 | DynamicTopKCalculator实现 | 较小 |
| Phase 3 | RerankingStage实现 | 较大 |
| Phase 4 | 集成测试和调优 | 中等 |

---

## Alternatives Considered

### A1: 纯LLM Reranking
使用LLM直接判断每个chunk的相关性。
- 优势：准确性最高
- 劣势：成本极高，延迟长
- 结论：不采用，仅用于Query优化阶段

### A2: 外部Reranker API (Cohere)
使用云端Reranker服务。
- 优势：无需本地部署
- 劣势：API费用，网络延迟
- 结论：作为备选，优先本地模型

### A3: 固定topK增大到50
简单粗暴提高召回。
- 优势：实现简单
- 劣势：噪声增加，Token浪费，可能干扰LLM
- 结论：不采用，动态计算更合理