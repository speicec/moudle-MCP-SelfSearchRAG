# Design: Query Optimization and Reranking

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Enhanced Retrieval Pipeline                              │
└─────────────────────────────────────────────────────────────────────────────┘

                           用户Query
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Stage 1: Query Analysis                              │
│                        (QueryAnalyzer)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  analyze(query) → {                                                         │
│    complexity: 'simple' | 'complex' | 'structured',                        │
│    needsDecomposition: boolean,                                             │
│    needsRewrite: boolean,                                                   │
│    detectedFilters: { year?, category?, ... },                              │
│    suggestedSubQueries?: string[]                                           │
│  }                                                                          │
│                                                                             │
│  LLM调用: DeepSeek API                                                      │
│  超时: 2000ms                                                               │
│  缓存: Query分析结果缓存 (TTL 5min)                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
               ▼               ▼               ▼
          Simple         Complex        Structured
          Query          Query          Query
               │               │               │
               ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ QueryRewriter    │ │ QueryDecomposer  │ │ QueryDSLBuilder  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
               │               │               │
               └───────────────┼───────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Stage 2: Query Expansion                             │
│                        (QueryExpander)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  expand(query) → expandedTerms[]                                            │
│                                                                             │
│  来源:                                                                      │
│  • 同义词词典 (本地JSON配置)                                                │
│  • 领域术语映射 (可配置)                                                    │
│  • 历史高频词 (可选)                                                        │
│                                                                             │
│  默认配置: maxExpandedTerms = 5                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Stage 3: Multi-Query Retrieval                       │
│                        (EnhancedSmallToBigRetriever)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  queries = [rewritten, ...subQueries, ...expandedTerms]                    │
│                                                                             │
│  results = await Promise.all(                                               │
│    queries.map(q => baseRetriever.retrieve(q))                             │
│  )                                                                          │
│                                                                             │
│  merged = mergeAndDeduplicate(results)                                     │
│                                                                             │
│  // Dynamic topK calculation                                                │
│  config = dynamicTopK.calculate()                                           │
│  coarseResults = merged.slice(0, config.coarseTopK)                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Stage 4: Confidence Check                            │
│                        (LowConfidenceHandler)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  avgSimilarity = mean(coarseResults.map(r => r.similarityScore))           │
│                                                                             │
│  if (avgSimilarity < MIN_CONFIDENCE_THRESHOLD) { // 0.3                    │
│    return {                                                                 │
│      status: 'no_match',                                                    │
│      message: '未找到与您问题相关的信息',                                   │
│      suggestions: ['请尝试其他关键词', '检查文档是否已索引']               │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Stage 5: Reranking                                   │
│                        (HybridReranker)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  if (coarseResults.length <= RERANKER_THRESHOLD) { // 20                   │
│    // Local BGE Reranker                                                    │
│    scores = await localReranker.rerank(query, coarseResults)               │
│  } else {                                                                   │
│    // Internal Confidence Calculator                                        │
│    scores = confidenceCalculator.calculate(query, coarseResults)            │
│  }                                                                          │
│                                                                             │
│  refinedResults = sortByConfidence(coarseResults, scores)                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Stage 6: Dynamic Truncation                          │
│                        (DynamicTruncator)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  finalResults = []                                                          │
│  totalTokens = 0                                                            │
│                                                                             │
│  for (result of refinedResults) {                                           │
│    if (totalTokens + result.tokens <= config.targetTokens) {               │
│      finalResults.push(result)                                              │
│      totalTokens += result.tokens                                           │
│    } else break                                                             │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Stage 7: Context Assembly                            │
│                        (EnhancedContextAssembler)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  context = finalResults.map(r => {                                          │
│    confidenceLevel =                                                        │
│      r.confidence >= 0.7 ? 'high'                                           │
│      : r.confidence >= 0.5 ? 'medium'                                       │
│      : 'low'                                                                │
│                                                                             │
│    return {                                                                 │
│      content: r.content,                                                    │
│      confidence: r.confidence,                                              │
│      confidenceLevel,                                                        │
│      source: r.sourceDocumentId,                                            │
│      page: r.metadata.pageNumber                                            │
│    }                                                                         │
│  })                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Stage 8: LLM Generation                              │
│                        (EnhancedLLMGenerationService)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  prompt = constructPromptWithConfidence(query, context)                    │
│                                                                             │
│  // Prompt包含置信度标签                                                    │
│  // 高置信度可直接引用                                                      │
│  // 中置信度谨慎总结                                                        │
│  // 低置信度仅供参考                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                           最终答案
                    + 来源置信度说明
```

---

## Module Design

### 1. QueryAnalyzer

**位置**: `src/retrieval/query-analyzer.ts`

**职责**: 分析Query复杂度和类型

```typescript
interface QueryAnalysisResult {
  complexity: 'simple' | 'complex' | 'structured';
  needsDecomposition: boolean;
  needsRewrite: boolean;
  detectedFilters?: Record<string, string | number>;
  suggestedSubQueries?: string[];
  rewrittenQuery?: string;
}

class QueryAnalyzer {
  private llmService: LLMGenerationService;
  private cache: Map<string, QueryAnalysisResult>;
  private cacheTTL: number = 300000; // 5 minutes
  
  async analyze(query: string): Promise<QueryAnalysisResult>;
  private callLLM(query: string): Promise<QueryAnalysisResult>;
  private detectFilters(query: string): Record<string, string | number>;
}
```

**LLM Prompt模板**:
```typescript
const ANALYSIS_PROMPT = `
分析以下用户查询，返回JSON格式结果：

用户查询: "${query}"

请判断:
1. 复杂度: simple(单一问题), complex(多维度), structured(有过滤条件)
2. 是否需要分解为子查询
3. 是否需要重写为专业术语
4. 检测到的过滤条件(年份、类别等)
5. 建议的子查询(如需分解)
6. 重写后的查询

返回格式:
{
  "complexity": "...",
  "needsDecomposition": true/false,
  "needsRewrite": true/false,
  "detectedFilters": {...},
  "suggestedSubQueries": [...],
  "rewrittenQuery": "..."
}
`;
```

---

### 2. QueryRewriter

**位置**: `src/retrieval/query-rewriter.ts`

**职责**: 重写口语化表达为专业术语

```typescript
class QueryRewriter {
  private llmService: LLMGenerationService;
  
  async rewrite(query: string): Promise<string>;
}
```

**LLM Prompt模板**:
```typescript
const REWRITE_PROMPT = `
将以下口语化查询重写为专业术语表达，保持语义不变：

用户查询: "${query}"

重写后的查询应该是:
- 使用专业术语
- 语义明确
- 适合文档检索

只输出重写后的查询，不要解释。
`;
```

---

### 3. QueryDecomposer

**位置**: `src/retrieval/query-decomposer.ts`

**职责**: 分解复杂问题为子查询

```typescript
interface DecompositionResult {
  originalQuery: string;
  subQueries: string[];
  strategy: 'parallel' | 'sequential';
}

class QueryDecomposer {
  private maxSubQueries: number = 5;
  
  async decompose(query: string): Promise<DecompositionResult>;
}
```

---

### 4. QueryDSLBuilder

**位置**: `src/retrieval/query-dsl-builder.ts`

**职责**: 构建结构化过滤条件

```typescript
interface QueryDSL {
  textQuery: string;
  filters: Array<{
    field: string;
    operator: 'eq' | 'gt' | 'lt' | 'in';
    value: string | number | string[];
  }>;
  sortBy?: { field: string; order: 'asc' | 'desc' };
}

class QueryDSLBuilder {
  build(analysisResult: QueryAnalysisResult): QueryDSL;
}
```

---

### 5. QueryExpander

**位置**: `src/retrieval/query-expander.ts`

**职责**: 同义词和相关词扩展

```typescript
interface ExpansionConfig {
  maxExpandedTerms: number;
  synonymDictionaryPath: string;
  domainTermsPath?: string;
}

class QueryExpander {
  private synonyms: Map<string, string[]>;
  
  constructor(config: ExpansionConfig);
  
  expand(query: string): string[];
  private loadSynonyms(path: string): void;
}
```

**同义词词典格式** (`config/synonyms.json`):
```json
{
  "性能优化": ["速度提升", "响应时间", "延迟降低", "吞吐量提高"],
  "架构设计": ["系统设计", "技术方案", "结构规划"],
  "数据分析": ["数据统计", "数据挖掘", "数据报表"]
}
```

---

### 6. DynamicTopKCalculator

**位置**: `src/retrieval/dynamic-topk-calculator.ts`

**职责**: 动态计算粗排topK

```typescript
interface TopKConfig {
  modelContextWindow: 32000 | 64000 | 128000;
  systemPromptTokens: number;
  outputReservation: number;
  fillRatio: number;
  overfetchRatio: number;
}

interface TopKResult {
  coarseTopK: number;
  targetTokens: number;
  effectiveWindow: number;
}

class DynamicTopKCalculator {
  private config: TopKConfig;
  
  constructor(config: TopKConfig);
  
  calculate(avgParentTokens: number): TopKResult;
  
  // 计算公式:
  // effectiveWindow = modelContextWindow - systemPromptTokens - outputReservation
  // targetTokens = effectiveWindow × fillRatio
  // coarseTopK = ceil(targetTokens × overfetchRatio / avgParentTokens)
}
```

**默认配置**:
```typescript
const DEFAULT_TOPK_CONFIG: TopKConfig = {
  modelContextWindow: 64000,
  systemPromptTokens: 500,
  outputReservation: 12000,
  fillRatio: 0.6,
  overfetchRatio: 1.5,
};
```

---

### 7. ConfidenceCalculator

**位置**: `src/retrieval/confidence-calculator.ts`

**职责**: 内部置信度计算（大样本场景）

```typescript
interface ConfidenceWeights {
  similarity: number;     // 0.5
  keywordMatch: number;   // 0.2
  position: number;       // 0.1
  chunkQuality: number;   // 0.2
}

class ConfidenceCalculator {
  private weights: ConfidenceWeights;
  
  calculate(query: string, results: RetrievalResult[]): number[];
  
  private calculateSimilarityScore(result: RetrievalResult): number;
  private calculateKeywordMatchScore(query: string, result: RetrievalResult): number;
  private calculatePositionScore(result: RetrievalResult): number;
  private calculateChunkQualityScore(result: RetrievalResult): number;
}
```

**计算公式**:
```
confidenceScore = 
  0.5 × similarityScore +
  0.2 × keywordMatchScore +
  0.1 × positionScore +
  0.2 × chunkQualityScore
```

---

### 8. LocalReranker

**位置**: `src/retrieval/local-reranker.ts`

**职责**: 本地bge-reranker-v2-m3集成（小样本场景）

```typescript
interface RerankResult {
  index: number;
  score: number;
}

class LocalReranker {
  private modelPath: string;
  private initialized: boolean;
  
  async initialize(): Promise<void>;
  async rerank(query: string, documents: string[]): Promise<RerankResult[]>;
  async shutdown(): Promise<void>;
}
```

**实现方案**:
- 使用 `@xenova/transformers` 或 `sentence-transformers` Node绑定
- 模型下载到本地缓存
- 支持GPU加速（可选）

---

### 9. HybridReranker

**位置**: `src/retrieval/hybrid-reranker.ts`

**职责**: 混合Reranker策略协调

```typescript
interface HybridRerankConfig {
  threshold: number;  // 20
  localModel: string; // 'bge-reranker-v2-m3'
}

class HybridReranker {
  private localReranker: LocalReranker;
  private confidenceCalculator: ConfidenceCalculator;
  private config: HybridRerankConfig;
  
  async rerank(
    query: string,
    results: RetrievalResult[]
  ): Promise<RetrievalResult[]>;
}
```

**策略逻辑**:
```typescript
async rerank(query, results) {
  if (results.length <= this.config.threshold) {
    // 小样本: 本地模型
    const scores = await this.localReranker.rerank(
      query,
      results.map(r => r.content)
    );
    return this.applyScores(results, scores);
  } else {
    // 大样本: 内部计算
    const scores = this.confidenceCalculator.calculate(query, results);
    return this.applyScores(results, scores);
  }
}
```

---

### 10. LowConfidenceHandler

**位置**: `src/retrieval/low-confidence-handler.ts`

**职责**: 低置信度结果处理

```typescript
interface NoMatchResult {
  status: 'no_match';
  message: string;
  suggestions: string[];
}

class LowConfidenceHandler {
  private threshold: number = 0.3;
  
  check(results: RetrievalResult[]): NoMatchResult | null;
}
```

---

### 11. EnhancedContextAssembler

**位置**: `src/retrieval/enhanced-context-assembler.ts`

**职责**: 组装Context + 置信度元数据

```typescript
interface ContextWithConfidence {
  content: string;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  source: string;
  page?: number;
}

class EnhancedContextAssembler {
  assemble(
    results: RetrievalResult[],
    targetTokens: number
  ): {
    context: ContextWithConfidence[];
    totalTokens: number;
    truncated: boolean;
  };
}
```

---

### 12. EnhancedLLMGenerationService

**位置**: `src/server/services/enhanced-llm-generation-service.ts`

**职责**: Prompt包含置信度信息

```typescript
class EnhancedLLMGenerationService extends LLMGenerationService {
  constructPromptWithConfidence(
    query: string,
    context: ContextWithConfidence[]
  ): string;
}
```

**Prompt模板**:
```typescript
const CONFIDENCE_PROMPT = `
用户问题: ${query}

参考资料（按置信度排序）:

${context.map(c => `
[置信度: ${c.confidenceLevel}] [来源: ${c.source}${c.page ? ` 第${c.page}页` : ''}]
${c.content}
`).join('\n\n---\n\n')}

回答指南:
• 高置信度资料可直接引用，标注来源
• 中置信度资料谨慎总结，说明"根据相关资料..."
• 低置信度资料仅供参考，谨慎使用
• 如果参考资料无法回答问题，请直接说明"根据现有资料无法回答"
• 不要编造或推测信息
`;
```

---

## Configuration Design

**位置**: `src/retrieval/config.ts`

```typescript
interface EnhancedRetrievalConfig {
  // 模型上下文窗口
  modelContextWindow: 32000 | 64000 | 128000;
  
  // 动态topK
  systemPromptTokens: number;
  outputReservation: number;
  fillRatio: number;
  overfetchRatio: number;
  
  // 置信度
  minConfidenceThreshold: number;
  confidenceWeights: ConfidenceWeights;
  
  // Reranker
  rerankerThreshold: number;
  localRerankerModel: string;
  
  // Query优化
  enableDecomposition: boolean;
  maxSubQueries: number;
  enableExpansion: boolean;
  maxExpandedTerms: number;
  enableRewrite: boolean;
  
  // 缓存
  queryCacheTTL: number;
  analysisCacheTTL: number;
}

const DEFAULT_ENHANCED_CONFIG: EnhancedRetrievalConfig = {
  modelContextWindow: 64000,
  systemPromptTokens: 500,
  outputReservation: 12000,
  fillRatio: 0.6,
  overfetchRatio: 1.5,
  
  minConfidenceThreshold: 0.3,
  confidenceWeights: {
    similarity: 0.5,
    keywordMatch: 0.2,
    position: 0.1,
    chunkQuality: 0.2,
  },
  
  rerankerThreshold: 20,
  localRerankerModel: 'bge-reranker-v2-m3',
  
  enableDecomposition: true,
  maxSubQueries: 5,
  enableExpansion: true,
  maxExpandedTerms: 5,
  enableRewrite: true,
  
  queryCacheTTL: 300000,
  analysisCacheTTL: 300000,
};
```

---

## API Changes

### 新增API端点

**检索配置更新**:
```typescript
// POST /api/chat/config
interface UpdateConfigRequest {
  modelContextWindow?: 32000 | 64000 | 128000;
  fillRatio?: number;
  minConfidenceThreshold?: number;
  enableDecomposition?: boolean;
  enableExpansion?: boolean;
}
```

### 响应格式变更

```typescript
interface EnhancedChatResponse {
  query: string;
  results: RetrievalResult[];
  
  // 新增字段
  queryAnalysis: {
    complexity: string;
    wasRewritten: boolean;
    wasDecomposed: boolean;
    expandedTerms: string[];
  };
  
  retrievalStats: {
    coarseTopK: number;
    refinedCount: number;
    avgConfidence: number;
    truncated: boolean;
  };
  
  context: {
    content: string;
    chunksWithConfidence: ContextWithConfidence[];
  };
  
  answer: string;
  thinking: string;
}
```

---

## Integration Points

### 改造现有模块

| 模块 | 改造内容 |
|------|---------|
| `SmallToBigRetriever` | 接收Multi-Query输入，合并结果 |
| `HierarchicalStore` | 新增 `getAvgParentTokenLength()` |
| `LLMGenerationService` | 新增置信度Prompt构造 |
| `chat.ts routes` | 调用新Pipeline，返回增强响应 |

### 新增模块

| 模块 | 职责 |
|------|------|
| `QueryAnalyzer` | Query复杂度分析 |
| `QueryRewriter` | Query重写 |
| `QueryDecomposer` | Query分解 |
| `QueryDSLBuilder` | 结构化DSL构建 |
| `QueryExpander` | 同义词扩展 |
| `DynamicTopKCalculator` | 动态topK计算 |
| `ConfidenceCalculator` | 内部置信度计算 |
| `LocalReranker` | 本地Reranker |
| `HybridReranker` | 混合策略协调 |
| `LowConfidenceHandler` | 低置信度处理 |
| `EnhancedContextAssembler` | 置信度Context组装 |
| `EnhancedLLMGenerationService` | 置信度Prompt |

---

## Error Handling

```typescript
// 查询优化失败 → 使用原始Query继续
if (analysisError) {
  console.warn('[QueryAnalyzer] Analysis failed, using original query');
  queries = [originalQuery];
}

// Reranker失败 → 使用相似度排序
if (rerankError) {
  console.warn('[Reranker] Rerank failed, using similarity sort');
  results = sortBySimilarity(results);
}

// LLM调用超时 → 返回部分结果
if (llmTimeout) {
  return { ...results, warning: 'Query optimization timed out' };
}
```

---

## Performance Considerations

| 操作 | 预估耗时 | 缓解措施 |
|------|---------|---------|
| Query分析LLM | 500-2000ms | 缓存结果，异步预分析 |
| 本地Reranker | 100-500ms (20样本) | 仅小样本使用 |
| 内部置信度计算 | 50-100ms | 无LLM调用 |
| Multi-Query检索 | N×检索时间 | 并行执行 |

**总延迟增加预估**: 1-3秒（可接受范围）