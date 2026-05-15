# 增强检索流水线 (Enhanced Retrieval Pipeline)

```plantuml
@startuml
skinparam backgroundColor #f0f4f8
skinparam defaultFontSize 10
skinparam sequenceMessageAlign center
skinparam responseMessageBelowArrow true

title Enhanced Retrieval Pipeline — 7 阶段检索流程

actor "用户" as User
participant "EnhancedRetrieval\nPipeline" as Pipeline #dbeafe
participant "Query\nAnalyzer" as Analyzer #e0e7ff
participant "Query\nRewriter" as Rewriter #e0e7ff
participant "Query\nDecomposer" as Decomposer #e0e7ff
participant "Query\nExpander" as Expander #e0e7ff
participant "DynamicTopK\nCalculator" as TopKCalc #fef3c7
participant "SmallToBig\nRetriever" as Retriever #d1fae5
database "Hierarchical\nStore" as Store #ecfdf5
participant "Hybrid\nReranker" as Reranker #ede9fe
participant "LowConfidence\nHandler" as LowConf #fce7f3
participant "Context\nAssembler" as Assembler #e2e8f0
participant "LLM Generation\nService (DeepSeek)" as LLM #fef3c7

== Stage 1: 查询分析 (Query Analysis) ==

User -> Pipeline: execute(query)
activate Pipeline

Pipeline -> Analyzer: analyze(query)
activate Analyzer
Analyzer -> Analyzer: 意图识别 + 复杂度评估\n检测过滤条件
Analyzer --> Pipeline: QueryAnalysisResult\n{intent, complexity,\nneedsRewrite, needsDecomposition,\ndetectedFilters}
deactivate Analyzer

== Stage 2: 查询优化 (Query Optimization) ==

opt needsRewrite == true
  Pipeline -> Rewriter: rewrite(query)
  activate Rewriter
  Rewriter -> Rewriter: LLM 改写优化查询表述
  Rewriter --> Pipeline: rewrittenQuery
  deactivate Rewriter
end

opt needsDecomposition == true
  Pipeline -> Decomposer: decompose(query)
  activate Decomposer
  Decomposer -> Decomposer: LLM 将复杂查询拆分为子查询
  Decomposer --> Pipeline: subQueries[]
  deactivate Decomposer
end

opt enableExpansion == true
  Pipeline -> Expander: expand(query)
  activate Expander
  Expander -> Expander: 同义词 + 领域词典扩展
  Expander --> Pipeline: expandedTerms[]
  deactivate Expander
end

Pipeline -> Pipeline: buildQueries()\n收集所有查询变体

== Stage 3: 多查询检索 (Multi-Query Retrieval) ==

Pipeline -> TopKCalc: calculate(avgParentTokens)
activate TopKCalc
TopKCalc -> TopKCalc: coarseTopK = max(10, min(50, 2000/tokens))\nfineTopK = min(coarseTopK, defaultTopK*2)
TopKCalc --> Pipeline: TopKResult {coarseTopK, fineTopK}
deactivate TopKCalc

Pipeline -> Retriever: retrieveMultiQueryWithConfidence(\n  queries[], {topK: coarseTopK,\n  mergeStrategy: 'weighted'})
activate Retriever

loop 每个查询变体
  Retriever -> Retriever: embed(queryVariant)
  Retriever -> Store: searchSmallChunks(embedding, topK)
  activate Store
  Store --> Retriever: matchingSmallChunks[]
  deactivate Store
  Retriever -> Store: getParentChunks(matched)
  activate Store
  Store --> Retriever: parentChunks[] (完整上下文)
  deactivate Store
  Retriever -> Retriever: 计算 similarityScore\n提取 contextWindow
end

Retriever -> Retriever: weighted RRF 融合去重
Retriever --> Pipeline: ConfidenceRetrievalResult[]\n{smallChunkId, parentChunkContent,\nsimilarityScore, contextWindow}
deactivate Retriever

== Stage 4: 置信度检查 (Confidence Check) ==

Pipeline -> LowConf: check(allResults)
activate LowConf
LowConf -> LowConf: 检查最高分 < threshold?\n或结果数 < minResults?
alt 全部低于置信度阈值
  LowConf --> Pipeline: NoMatchResult {reason, suggestions}
  Pipeline --> User: 提前返回 (低置信度)\n{success: false, noMatch}
  deactivate LowConf
  deactivate Pipeline
else 存在有效结果
  LowConf --> Pipeline: null (继续)
  deactivate LowConf
end

== Stage 5: 重排序 (Reranking) ==

Pipeline -> Reranker: rerank(query, rawResults)
activate Reranker

opt 本地 reranker 可用
  Reranker -> Reranker: Cross-Encoder 精排\n逐对计算 query-chunk 相关性
else fallback
  Reranker -> Reranker: 置信度排序\n综合 similarityScore + sourceCount
end

Reranker --> Pipeline: RerankOutput\n{results[], method: 'local-reranker'\n | 'internal-confidence'}
deactivate Reranker

== Stage 6: 上下文组装 (Context Assembly) ==

Pipeline -> Assembler: assemble(rankedResults, topKConfig)
activate Assembler
Assembler -> Assembler: 截断到 fineTopK\n合并 parentChunkContent\n去重 + 窗口提取\ntoken 计数 & 截断
Assembler --> Pipeline: EnhancedAssembledContext\n{chunks[], metadata, totalTokens}
deactivate Assembler

== Stage 7: LLM 生成 (Generation) ==

Pipeline -> LLM: generate({query, context, sources})
activate LLM
LLM -> LLM: DeepSeek API 调用\nreasoning_content (思考链)\ncontent (最终答案)
LLM --> Pipeline: SSE 流式响应\n{thinking, answer}
deactivate LLM

Pipeline --> User: PipelineResult\n{success: true, query,\nanalysis, optimization,\ntopKConfig, results, context, stats}
deactivate Pipeline

@enduml
```

## 各阶段职责

| 阶段 | 组件 | 核心功能 | 输出 |
|------|------|---------|------|
| **1. 分析** | QueryAnalyzer | 意图识别、复杂度评估、过滤条件检测 | QueryAnalysisResult |
| **2. 优化** | Rewriter + Decomposer + Expander | 查询改写、子查询分解、术语扩展 | QueryOptimizationOutput |
| **3. 检索** | DynamicTopK + SmallToBigRetriever | 自适应K值、多查询加权融合检索 | ConfidenceRetrievalResult[] |
| **4. 检查** | LowConfidenceHandler | 低置信度检测，提前返回或继续 | NoMatchResult / null |
| **5. 重排** | HybridReranker | Cross-Encoder精排 或 置信度排序 | RerankOutput |
| **6. 组装** | EnhancedContextAssembler | 截断、合并、去重、token计数 | EnhancedAssembledContext |
| **7. 生成** | LLM Generation Service | DeepSeek 思考链 + 答案生成 (SSE) | {thinking, answer} |
