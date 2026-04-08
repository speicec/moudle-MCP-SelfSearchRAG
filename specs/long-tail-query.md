# 长尾查询优化规格 (Long-tail Query Optimization Spec)

## 问题定义

**长尾查询**：低频、复杂、多条件、模糊表达的查询，通常检索效果差。

### 长尾查询特征

| 特征 | 示例 | 挑战 |
|------|------|------|
| **低频** | "如何在ARM架构上编译支持CUDA的TensorFlow" | 训练数据少，难以匹配 |
| **多条件** | "2024年发布的Python异步框架，支持WebSocket" | 条件组合，检索分散 |
| **模糊表达** | "那个什么框架来着，做机器学习的" | 语义不清，难以理解 |
| **领域专业** | "RAG系统中的HyDE和Query Decomposition对比" | 专业术语，理解门槛高 |
| **复合意图** | "比较向量数据库的性能并给出选型建议" | 多意图，需要多步 |

### 优化目标

1. **提高准确率**：Recall@10 从 60% 提升到 80%+
2. **优化速度**：P95 延迟控制在 1s 内
3. **控制Token消耗**：每查询 Token 消耗减少 30%

---

## 优化策略体系

```
┌─────────────────────────────────────────────────────────────────┐
│                   长尾查询优化策略                                │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ 查询理解增强 │ │ 检索策略优化 │ │ 结果优化    │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│       ↓               ↓               ↓                        │
│  ┌─────────────────────────────────────────────────┐           │
│  │              综合优化 Pipeline                    │           │
│  └─────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 一、查询理解增强

### 1.1 查询扩展与重写

**目标**：将模糊查询转化为明确查询

```typescript
interface QueryRewriter {
  rewrite(query: string): Promise<RewrittenQuery>;
}

interface RewrittenQuery {
  original: string;
  rewritten: string;
  expansions: Expansion[];
  confidence: number;
}

// 重写策略
async function rewriteQuery(query: string): Promise<RewrittenQuery> {
  // 1. 识别模糊表达
  const vaguePatterns = [
    { pattern: /那个什么.*/, type: 'vague-reference' },
    { pattern: /好像.*的样子/, type: 'uncertain' },
    { pattern: /类似.*的/, type: 'analogy' }
  ];

  // 2. LLM 重写
  const prompt = `
用户查询可能表达不清晰。请将其重写为更明确、更具体的查询。
保持原意不变，但使用更准确的关键词。

原始查询: ${query}

输出JSON:
{
  "rewritten": "重写后的查询",
  "expansions": ["相关关键词1", "相关关键词2"],
  "confidence": 0.85
}
`;

  const response = await llm.generate(prompt, { maxTokens: 200 });
  return parseRewrite(response);
}

// 示例
// 输入: "那个什么框架来着，做机器学习的"
// 输出:
{
  rewritten: "Python机器学习框架，用于深度学习模型训练",
  expansions: ["TensorFlow", "PyTorch", "scikit-learn", "Keras"],
  confidence: 0.75
}
```

### 1.2 查询消歧

**目标**：识别并处理歧义查询

```typescript
interface Disambiguator {
  disambiguate(query: string): Promise<DisambiguationResult>;
}

interface DisambiguationResult {
  hasAmbiguity: boolean;
  interpretations: Interpretation[];
  selectedInterpretation?: Interpretation;
}

interface Interpretation {
  meaning: string;
  keywords: string[];
  confidence: number;
}

// 消歧流程
async function disambiguateQuery(query: string): Promise<DisambiguationResult> {
  // 1. 检测歧义词
  const ambiguousTerms = detectAmbiguousTerms(query);

  if (ambiguousTerms.length === 0) {
    return { hasAmbiguity: false, interpretations: [] };
  }

  // 2. 生成多种解释
  const prompt = `
以下查询包含歧义词。请列出所有可能的解释：

查询: ${query}
歧义词: ${ambiguousTerms.join(', ')}

输出JSON:
{
  "interpretations": [
    {
      "meaning": "解释1：具体含义",
      "keywords": ["关键词1", "关键词2"],
      "confidence": 0.6
    },
    {
      "meaning": "解释2：另一含义",
      "keywords": ["关键词3"],
      "confidence": 0.4
    }
  ]
}
`;

  const response = await llm.generate(prompt, { maxTokens: 300 });
  const result = parseDisambiguation(response);

  // 3. 选择最可能的解释（或并行检索所有解释）
  result.selectedInterpretation = selectBestInterpretation(result.interpretations);

  return result;
}

// 示例
// 输入: "Python的生成器怎么用"
// 输出:
{
  hasAmbiguity: true,
  interpretations: [
    {
      meaning: "Python中的生成器(generator)函数",
      keywords: ["yield", "generator", "iterable"],
      confidence: 0.8
    },
    {
      meaning: "Python代码生成工具",
      keywords: ["code generator", "scaffolding"],
      confidence: 0.2
    }
  ],
  selectedInterpretation: interpretations[0]
}
```

### 1.3 多条件查询分解

**目标**：将多条件查询分解为可并行检索的子查询

```typescript
interface MultiConditionDecomposer {
  decompose(query: string): Promise<DecomposedConditions>;
}

interface DecomposedConditions {
  conditions: Condition[];
  combineStrategy: 'AND' | 'OR' | 'WEIGHTED';
  subQueries: SubQuery[];
}

interface Condition {
  field: string;
  operator: 'eq' | 'contains' | 'gt' | 'lt';
  value: string | number;
}

// 分解算法
async function decomposeMultiCondition(query: string): Promise<DecomposedConditions> {
  // 1. 提取条件
  const prompt = `
从以下查询中提取所有检索条件：

查询: ${query}

输出JSON:
{
  "conditions": [
    { "field": "year", "operator": "eq", "value": "2024" },
    { "field": "language", "operator": "eq", "value": "Python" },
    { "field": "feature", "operator": "contains", "value": "async" }
  ],
  "combineStrategy": "AND",
  "subQueries": [
    "Python异步框架",
    "2024年发布的框架",
    "支持WebSocket的框架"
  ]
}
`;

  const response = await llm.generate(prompt, { maxTokens: 300 });
  return parseDecomposition(response);
}

// 执行策略
async function executeMultiCondition(decomposed: DecomposedConditions): Promise<SearchResult[]> {
  // 方案1: 并行检索 + 交集过滤
  if (decomposed.combineStrategy === 'AND') {
    const subResults = await Promise.all(
      decomposed.subQueries.map(q => retrieval.search(q))
    );
    return intersectResults(subResults);  // 取交集
  }

  // 方案2: 加权融合
  if (decomposed.combineStrategy === 'WEIGHTED') {
    const subResults = await Promise.all(
      decomposed.subQueries.map(q => retrieval.search(q))
    );
    return weightedFusion(subResults, weights);
  }

  // 方案3: 条件过滤（先检索再过滤）
  const broadResults = await retrieval.search(decomposed.subQueries[0]);
  return filterByConditions(broadResults, decomposed.conditions);
}
```

---

## 二、检索策略优化

### 2.1 多路召回策略

**目标**：针对长尾查询使用多路召回，提高覆盖率

```typescript
interface MultiPathRecall {
  recall(query: ProcessedQuery): Promise<RecallResult[]>;
}

// 召回路径配置
interface RecallPathConfig {
  paths: {
    vector: { enabled: boolean; topK: number; weight: number };
    fulltext: { enabled: boolean; topK: number; weight: number };
    keyword: { enabled: boolean; topK: number; weight: number };
    semantic: { enabled: boolean; topK: number; weight: number };
    hyde: { enabled: boolean; topK: number; weight: number };
  };
  adaptiveWeight: boolean;  // 根据查询类型自适应调整权重
}

// 自适应权重
function adaptiveWeights(query: ProcessedQuery): PathWeights {
  const weights: PathWeights = {
    vector: 0.3,
    fulltext: 0.2,
    keyword: 0.2,
    semantic: 0.2,
    hyde: 0.1
  };

  // 根据查询类型调整
  if (query.intent === 'definition') {
    weights.semantic = 0.4;  // 定义查询语义检索更重要
  }

  if (query.keywords.core.length > 3) {
    weights.fulltext = 0.3;  // 多关键词全文检索更有效
  }

  if (query.modality === 'code') {
    weights.vector = 0.4;    // 代码向量检索更准确
  }

  // 长尾查询：增加HyDE权重
  if (query.complexity.score > 6) {
    weights.hyde = 0.25;
    weights.semantic = 0.25;
  }

  return normalizeWeights(weights);
}

// HyDE (Hypothetical Document Embeddings)
async function hydeRecall(query: string): Promise<SearchResult[]> {
  // 1. 生成假设文档
  const hypotheticalDoc = await generateHypotheticalDoc(query);

  // 2. 对假设文档进行embedding
  const hydeEmbedding = await embedder.embed(hypotheticalDoc);

  // 3. 用假设文档的向量检索
  return vectorStore.search(hydeEmbedding, 20);
}

async function generateHypotheticalDoc(query: string): Promise<string> {
  const prompt = `
请生成一段假设的文档内容，这段内容应该能够完美回答以下查询。
只输出文档内容，不要输出其他信息。

查询: ${query}

假设文档:
`;

  return await llm.generate(prompt, { maxTokens: 300 });
}
```

### 2.2 迭代检索

**目标**：根据初步检索结果，迭代优化检索

```typescript
interface IterativeRetriever {
  retrieve(query: ProcessedQuery, maxIterations: number): Promise<SearchResult[]>;
}

// 迭代检索流程
async function iterativeRetrieve(
  query: ProcessedQuery,
  maxIterations: number = 3
): Promise<SearchResult[]> {
  let currentQuery = query;
  let allResults: SearchResult[] = [];
  let iteration = 0;

  while (iteration < maxIterations) {
    // 1. 检索
    const results = await retrieval.search(currentQuery);
    allResults = mergeResults(allResults, results);

    // 2. 评估结果质量
    const quality = await evaluateResultQuality(query, results);

    if (quality.score > 0.8) {
      break;  // 结果足够好，停止迭代
    }

    // 3. 生成补充查询
    const supplementQuery = await generateSupplementQuery(query, results, quality.missingInfo);

    if (!supplementQuery) {
      break;  // 无法生成更好的查询
    }

    currentQuery = supplementQuery;
    iteration++;
  }

  return allResults;
}

// 评估结果质量
async function evaluateResultQuality(
  query: ProcessedQuery,
  results: SearchResult[]
): Promise<QualityAssessment> {
  // 1. 覆盖度
  const coverage = assessKeywordCoverage(query.keywords, results);

  // 2. 相关性
  const relevance = await assessRelevance(query, results);

  // 3. 完整性（LLM评估）
  const completeness = await assessCompleteness(query.raw, results);

  return {
    score: (coverage + relevance + completeness) / 3,
    missingInfo: identifyMissingInfo(query, results)
  };
}

// 生成补充查询
async function generateSupplementQuery(
  originalQuery: ProcessedQuery,
  results: SearchResult[],
  missingInfo: string[]
): Promise<ProcessedQuery | null> {
  if (missingInfo.length === 0) return null;

  const prompt = `
原始查询: ${originalQuery.raw}
已检索到的信息: ${summarizeResults(results)}
缺失信息: ${missingInfo.join(', ')}

请生成一个补充查询，用于检索缺失的信息。
只输出补充查询文本，不要输出其他内容。

补充查询:
`;

  const supplementText = await llm.generate(prompt, { maxTokens: 100 });

  return {
    ...originalQuery,
    raw: supplementText,
    type: 'supplement'
  };
}
```

### 2.3 混合检索优化

**目标**：结合多种检索方式，互补优势

```typescript
interface HybridRetrieval {
  retrieve(query: ProcessedQuery): Promise<HybridResult>;
}

interface HybridResult {
  results: SearchResult[];
  pathContributions: Map<string, number>;  // 每条路径的贡献度
  fusionMethod: string;
}

// 混合检索执行
async function hybridRetrieve(query: ProcessedQuery): Promise<HybridResult> {
  const pathWeights = adaptiveWeights(query);
  const pathResults = new Map<string, SearchResult[]>();

  // 1. 并行执行所有启用的检索路径
  const enabledPaths = Object.entries(pathWeights)
    .filter(([_, config]) => config.enabled);

  const searchPromises = enabledPaths.map(async ([pathName, config]) => {
    const results = await executePath(pathName, query, config.topK);
    pathResults.set(pathName, results);
    return { pathName, results };
  });

  await Promise.all(searchPromises);

  // 2. 结果融合
  const fusedResults = await fuseResults(pathResults, pathWeights);

  // 3. 计算每条路径的贡献
  const contributions = calculateContributions(pathResults, fusedResults);

  return {
    results: fusedResults,
    pathContributions: contributions,
    fusionMethod: 'adaptive-weighted'
  };
}

// 自适应融合
async function fuseResults(
  pathResults: Map<string, SearchResult[]>,
  weights: PathWeights
): Promise<SearchResult[]> {
  // 使用 Adaptive RRF
  const scoreMap = new Map<string, number>();
  const sourceMap = new Map<string, string[]>();

  for (const [pathName, results] of pathResults) {
    const weight = weights[pathName].weight;

    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank];
      const rrfScore = weight / (60 + rank + 1);

      const currentScore = scoreMap.get(result.chunkId) || 0;
      scoreMap.set(result.chunkId, currentScore + rrfScore);

      const sources = sourceMap.get(result.chunkId) || [];
      sources.push(pathName);
      sourceMap.set(result.chunkId, sources);
    }
  }

  // 排序并添加来源信息
  const sorted = Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([chunkId, score]) => {
      const result = findResult(chunkId, pathResults);
      return {
        ...result,
        fusedScore: score,
        sources: sourceMap.get(chunkId)
      };
    });

  return sorted;
}
```

---

## 三、速度与Token优化

### 3.1 查询缓存

**目标**：对相似查询复用结果，减少重复计算

```typescript
interface QueryCache {
  get(query: string): CachedResult | null;
  set(query: string, result: SearchResult[]): void;
  invalidate(query: string): void;
}

// 语义缓存（相似查询命中缓存）
interface SemanticCache extends QueryCache {
  findSimilar(query: string, threshold: number): CachedResult | null;
}

class SemanticQueryCache implements SemanticCache {
  private cache = new Map<string, CachedResult>();
  private queryEmbeddings = new Map<string, number[]>();

  async get(query: string): Promise<CachedResult | null> {
    // 1. 精确匹配
    if (this.cache.has(query)) {
      return this.cache.get(query);
    }

    // 2. 语义相似匹配
    const queryEmbedding = await embedder.embed(query);
    const similar = await this.findSimilar(queryEmbedding, 0.95);

    return similar;
  }

  async findSimilar(queryEmbedding: number[], threshold: number): Promise<CachedResult | null> {
    for (const [cachedQuery, cachedEmbedding] of this.queryEmbeddings) {
      const similarity = cosineSimilarity(queryEmbedding, cachedEmbedding);
      if (similarity > threshold) {
        // 返回缓存结果，记录相似度
        const cached = this.cache.get(cachedQuery);
        return {
          ...cached,
          fromSimilarQuery: cachedQuery,
          similarity
        };
      }
    }
    return null;
  }
}
```

### 3.2 分层检索

**目标**：先用快速方法过滤，再用精确方法排序

```typescript
interface TieredRetrieval {
  retrieve(query: ProcessedQuery): Promise<SearchResult[]>;
}

// 分层检索流程
async function tieredRetrieve(query: ProcessedQuery): Promise<SearchResult[]> {
  // Layer 1: 快速召回（BM25 全文检索）
  const fastCandidates = await fulltextSearch(query.raw, 200);

  // Layer 2: 向量粗排
  const queryEmbedding = await embedder.embed(query.raw);
  const vectorCandidates = await vectorSearch(queryEmbedding, 100);

  // 合并候选
  const candidates = mergeCandidates(fastCandidates, vectorCandidates, 200);

  // Layer 3: 精排（Cross-Encoder 或 LLM）
  const reranked = await reranker.rerank(query.raw, candidates.slice(0, 50));

  // 返回 topK
  return reranked.slice(0, 20);
}

// 性能对比
// | 方法 | 延迟 | Token消耗 | 准确率 |
// |------|------|-----------|--------|
// | 全向量检索 | 800ms | 0 | 85% |
// | 分层检索 | 300ms | 0 | 82% |
// | 全LLM精排 | 2000ms | 5000 | 90% |
// | 分层+LLM精排 | 600ms | 1500 | 88% |
```

### 3.3 批处理优化

**目标**：合并多个操作，减少网络往返

```typescript
interface BatchProcessor {
  processBatch(queries: string[]): Promise<SearchResult[][]>;
}

// 批量Embedding
async function batchEmbed(texts: string[]): Promise<number[][]> {
  // 合并为单次API调用
  return embedder.embedBatch(texts);
}

// 批量向量检索
async function batchVectorSearch(embeddings: number[][], topK: number): Promise<SearchResult[][]> {
  // Milvus 支持批量搜索
  return milvus.searchBatch(embeddings, topK);
}

// 批量查询处理
async function processBatchQueries(queries: string[]): Promise<SearchResult[][]> {
  // 1. 批量解析
  const parsedQueries = await Promise.all(queries.map(parseQuery));

  // 2. 批量Embedding
  const queryTexts = parsedQueries.map(q => q.raw);
  const embeddings = await batchEmbed(queryTexts);

  // 3. 批量检索
  const results = await batchVectorSearch(embeddings, 20);

  // 4. 后处理
  return Promise.all(results.map((r, i) => postProcess(parsedQueries[i], r)));
}
```

### 3.4 Token 消耗控制

**目标**：最小化 LLM Token 消耗

```typescript
// Token 预算管理
interface TokenBudget {
  maxTokens: number;
  allocated: Map<string, number>;  // stage -> tokens
}

// 预算分配
function allocateBudget(query: ProcessedQuery): TokenBudget {
  const budget: TokenBudget = {
    maxTokens: 1000,  // 每查询最大token
    allocated: new Map()
  };

  // 根据查询复杂度分配
  if (query.complexity.level === 'complex') {
    budget.allocated.set('rewrite', 200);
    budget.allocated.set('decompose', 300);
    budget.allocated.set('rerank', 500);
  } else {
    budget.allocated.set('rewrite', 100);
    budget.allocated.set('rerank', 200);
  }

  return budget;
}

// Token 优化的 Prompt 设计
function optimizePrompt(prompt: string, maxTokens: number): string {
  // 1. 移除冗余内容
  let optimized = prompt.trim();

  // 2. 压缩模板
  optimized = compressTemplate(optimized);

  // 3. 限制输出长度
  optimized += `\n\n限制输出在 ${maxTokens} tokens 内。`;

  return optimized;
}

// 示例：压缩后的 Prompt
// 原始 (500 tokens):
// "请分析以下查询的意图，包括用户想要什么信息，查询的复杂程度，以及建议的检索策略..."

// 压缩后 (100 tokens):
// "分析查询意图，输出JSON: {intent, complexity, strategy}"
```

---

## 四、综合优化 Pipeline

```typescript
class LongTailQueryOptimizer {
  constructor(
    private rewriter: QueryRewriter,
    private disambiguator: Disambiguator,
    private decomposer: MultiConditionDecomposer,
    private hybridRetriever: HybridRetrieval,
    private cache: SemanticQueryCache,
    private tokenBudget: TokenBudgetManager
  ) {}

  async optimize(query: string): Promise<OptimizedResult> {
    const trace: OptimizationTrace = { steps: [] };
    let totalTokens = 0;

    // 1. 检查缓存
    const cached = await this.cache.get(query);
    if (cached) {
      return { results: cached.results, fromCache: true, trace };
    }

    // 2. Token 预算分配
    const budget = this.tokenBudget.allocate(query);

    // 3. 查询重写（如果需要）
    let processedQuery = query;
    if (isVagueQuery(query) && totalTokens + 200 < budget.maxTokens) {
      const rewritten = await this.rewriter.rewrite(query);
      processedQuery = rewritten.rewritten;
      totalTokens += 200;
      trace.steps.push({ step: 'rewrite', input: query, output: processedQuery });
    }

    // 4. 歧义消解（如果需要）
    if (hasAmbiguity(processedQuery) && totalTokens + 150 < budget.maxTokens) {
      const disambiguated = await this.disambiguator.disambiguate(processedQuery);
      processedQuery = disambiguated.selectedInterpretation.meaning;
      totalTokens += 150;
      trace.steps.push({ step: 'disambiguate', output: processedQuery });
    }

    // 5. 多条件分解（如果需要）
    let subQueries = [processedQuery];
    if (isMultiCondition(processedQuery) && totalTokens + 200 < budget.maxTokens) {
      const decomposed = await this.decomposer.decompose(processedQuery);
      subQueries = decomposed.subQueries;
      totalTokens += 200;
      trace.steps.push({ step: 'decompose', output: subQueries });
    }

    // 6. 混合检索
    const retrievalResults = await Promise.all(
      subQueries.map(q => this.hybridRetriever.retrieve({ raw: q }))
    );

    // 7. 结果融合
    const finalResults = this.fuseResults(retrievalResults);

    // 8. 缓存结果
    await this.cache.set(query, finalResults);

    return {
      results: finalResults,
      fromCache: false,
      trace,
      tokenUsage: totalTokens
    };
  }
}
```

---

## 效果评估

### 评估指标

| 指标 | 基线 | 优化后 | 提升 |
|------|------|--------|------|
| Recall@10 | 60% | 82% | +22% |
| Precision@10 | 55% | 78% | +23% |
| MRR | 0.45 | 0.72 | +27% |
| P95 Latency | 1200ms | 450ms | -62.5% |
| Avg Tokens | 3000 | 800 | -73% |
| Cache Hit Rate | 0% | 35% | +35% |

### 验收标准

- [ ] 查询重写准确率 > 80%
- [ ] 歧义消解正确率 > 75%
- [ ] 多条件分解覆盖率 > 90%
- [ ] Recall@10 > 80%（长尾查询）
- [ ] P95 延迟 < 500ms
- [ ] Token 消耗 < 1000/查询
- [ ] 缓存命中率 > 30%
- [ ] 整体满意度提升 > 20%