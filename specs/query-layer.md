# 查询层规格 (Query Layer Spec)

## 概述

查询层是 Retrieval Pipeline 的入口，负责将用户原始查询转化为结构化的检索请求。核心机制：多查询分解、退步提示、查询路由、自反思。

## 架构定位

```
用户查询
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Query Layer                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │ Query Parse │ →  │ Query Router│ →  │ Query Expand│          │
│  │ (意图解析)   │    │ (路由决策)   │    │ (查询扩展)   │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         ↓                 ↓                 ↓                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │ Query Decomp│    │ Step-back   │    │ Self-Reflect│          │
│  │ (查询分解)   │    │ (退步提示)   │    │ (自反思)    │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         ↓                 ↓                 ↓                   │
│  ┌───────────────────────────────────────────────────┐          │
│  │              Query Fusion (查询融合)               │          │
│  └───────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
    ↓
Retrieval Layer (检索层)
```

## 模块详解

### 1. Query Parser (意图解析)

**职责**: 解析用户查询的意图、关键词、语义结构

```typescript
interface QueryParser {
  parse(rawQuery: string): Promise<ParsedQuery>;
}

interface ParsedQuery {
  // 原始输入
  raw: string;

  // 意图分类
  intent: QueryIntent;
  intentConfidence: number;

  // 关键词提取
  keywords: {
    core: string[];       // 核心关键词（必须包含）
    related: string[];    // 相关关键词（可选包含）
    excluded: string[];   // 排除关键词
  };

  // 语义结构
  semantic: {
    subject?: string;     // 主体
    action?: string;      // 动作
    object?: string;      // 对象
    conditions?: string[];// 条件
  };

  // 复杂度评估
  complexity: {
    level: 'simple' | 'medium' | 'complex';
    score: number;        // 0-10
    reasons: string[];    // 复杂原因
  };

  // 模态检测
  modality: 'text' | 'code' | 'mixed';

  // 语言检测
  language: string;
}

type QueryIntent =
  | 'definition'      // "什么是X?"
  | 'how-to'          // "如何实现X?"
  | 'example'         // "X的示例代码"
  | 'comparison'      // "X和Y的区别"
  | 'debug'           // "为什么X报错?"
  | 'optimization'    // "如何优化X?"
  | 'exploration'     // "关于X的所有信息"
  | 'fact-check'      // "X是否正确?"
  | 'multi-hop';      // 复合查询（需要多跳）
```

**实现逻辑**:

```typescript
// 关键词提取算法
function extractKeywords(query: string): Keywords {
  // 1. 移除停用词
  const stopwords = ['的', '是', '在', '有', '和', '了', '如何', '怎么', '什么'];
  const cleaned = removeStopwords(query, stopwords);

  // 2. TF-IDF 关键词权重
  const tfidf = calculateTFIDF(cleaned);

  // 3. NLP 分词 + 词性标注
  const tokens = tokenize(cleaned);
  const posTags = posTagging(tokens);

  // 4. 核心词识别（名词、动词优先）
  const coreKeywords = tokens
    .filter(t => posTags[t] === 'noun' || posTags[t] === 'verb')
    .slice(0, 5);

  // 5. 相关词（形容词、副词）
  const relatedKeywords = tokens
    .filter(t => posTags[t] === 'adj' || posTags[t] === 'adv');

  // 6. 排除词（否定词）
  const excluded = tokens.filter(t => isNegation(t));

  return { core: coreKeywords, related: relatedKeywords, excluded };
}

// 复杂度评估
function assessComplexity(query: string): Complexity {
  const signals = {
    // 多实体信号
    multipleEntities: countEntities(query) > 2,

    // 多条件信号
    multipleConditions: countConditions(query) > 1,

    // 需要推理
    needsInference: hasInferenceWords(query),

    // 跨领域
    crossDomain: detectCrossDomain(query),

    // 长度
    longQuery: query.length > 50
  };

  const score = Object.values(signals).filter(Boolean).length * 2;
  const level = score <= 2 ? 'simple' : score <= 6 ? 'medium' : 'complex';

  return { level, score, reasons: Object.keys(signals).filter(k => signals[k]) };
}
```

---

### 2. Query Router (路由决策)

**职责**: 根据查询意图和复杂度，决定使用哪种检索策略

```typescript
interface QueryRouter {
  route(parsedQuery: ParsedQuery): Promise<RouteDecision>;
}

interface RouteDecision {
  // 主策略
  strategy: RetrievalStrategy;

  // 子策略
  subStrategies?: RetrievalStrategy[];

  // 理由
  reason: string;

  // 预估资源
  estimatedResources: {
    retrievalPaths: number;
    maxCandidates: number;
    estimatedTokens: number;
    estimatedLatency: number;
  };
}

type RetrievalStrategy =
  | 'single-hop'       // 单次检索
  | 'multi-hop'        // 多跳检索
  | 'decomposition'    // 查询分解
  | 'step-back'        // 退步提示
  | 'hybrid-reasoning' // 混合推理
  | 'exploratory'      // 探索式检索
  | 'fact-verification';// 事实验证
```

**路由规则**:

```typescript
// 路由决策表
const routingRules: RoutingRule[] = [
  {
    condition: (q) => q.complexity.level === 'simple' && q.intent === 'definition',
    strategy: 'single-hop',
    reason: '简单定义查询，单次检索足够'
  },
  {
    condition: (q) => q.intent === 'multi-hop' || q.complexity.score > 6,
    strategy: 'decomposition',
    reason: '复杂查询，需要分解为子查询'
  },
  {
    condition: (q) => q.intent === 'comparison',
    strategy: 'multi-hop',
    reason: '比较查询需要检索多个实体'
  },
  {
    condition: (q) => q.intent === 'debug' && q.semantic.conditions?.length > 0,
    strategy: 'step-back',
    reason: '调试问题需要退步思考上下文'
  },
  {
    condition: (q) => q.intent === 'exploration',
    strategy: 'exploratory',
    reason: '探索式查询需要广度检索'
  }
];

// 路由执行
function route(parsedQuery: ParsedQuery): RouteDecision {
  for (const rule of routingRules) {
    if (rule.condition(parsedQuery)) {
      return {
        strategy: rule.strategy,
        reason: rule.reason,
        estimatedResources: estimateResources(rule.strategy, parsedQuery)
      };
    }
  }

  // 默认策略
  return { strategy: 'single-hop', reason: '默认单次检索' };
}
```

---

### 3. Query Decomposition (查询分解)

**职责**: 将复杂查询分解为多个独立子查询

```typescript
interface QueryDecomposer {
  decompose(query: ParsedQuery): Promise<DecomposedQueries>;
}

interface DecomposedQueries {
  // 子查询列表
  subQueries: SubQuery[];

  // 依赖关系
  dependencies: Map<string, string[]>;  // queryId -> dependentIds

  // 执行顺序
  executionOrder: string[];  // queryIds

  // 融合策略
  fusionStrategy: 'sequential' | 'parallel' | 'conditional';
}

interface SubQuery {
  id: string;
  query: string;
  type: 'atomic' | 'derived';  // 原子查询 / 派生查询

  // 派生查询需要等待前置查询结果
  dependsOn?: string[];

  // 预期结果类型
  expectedResult: 'definition' | 'code' | 'example' | 'fact';

  // 权重（用于结果融合）
  weight: number;
}
```

**分解算法**:

```typescript
// LLM 驱动的查询分解
async function decomposeWithLLM(query: string): Promise<DecomposedQueries> {
  const prompt = `
将以下复杂查询分解为独立的子查询。每个子查询应该：
1. 可以独立检索
2. 保持语义完整
3. 标注是否依赖其他子查询的结果

原始查询: ${query}

输出格式（JSON）:
{
  "subQueries": [
    {
      "id": "q1",
      "query": "子查询文本",
      "type": "atomic",
      "expectedResult": "definition",
      "weight": 0.5
    }
  ],
  "dependencies": {},
  "executionOrder": ["q1", "q2"],
  "fusionStrategy": "parallel"
}
`;

  const response = await llm.generate(prompt);
  return parseDecomposition(response);
}

// 示例
// 输入: "如何用Python实现一个支持多模态检索的RAG系统，并与Milvus集成？"
// 输出:
{
  subQueries: [
    { id: 'q1', query: 'RAG系统架构设计', type: 'atomic', expectedResult: 'definition', weight: 0.3 },
    { id: 'q2', query: '多模态检索实现方法', type: 'atomic', expectedResult: 'how-to', weight: 0.25 },
    { id: 'q3', query: 'Python RAG实现代码示例', type: 'atomic', expectedResult: 'code', weight: 0.25 },
    { id: 'q4', query: 'Milvus集成方式', type: 'atomic', expectedResult: 'how-to', weight: 0.2 }
  ],
  dependencies: {},
  executionOrder: ['q1', 'q2', 'q3', 'q4'],
  fusionStrategy: 'parallel'
}

// 输入: "比较向量检索和全文检索的效果，然后给出选择建议"
// 输出:
{
  subQueries: [
    { id: 'q1', query: '向量检索原理和效果', type: 'atomic', expectedResult: 'definition', weight: 0.35 },
    { id: 'q2', query: '全文检索原理和效果', type: 'atomic', expectedResult: 'definition', weight: 0.35 },
    { id: 'q3', query: '向量检索vs全文检索选择建议', type: 'derived', dependsOn: ['q1', 'q2'], expectedResult: 'comparison', weight: 0.3 }
  ],
  dependencies: { q3: ['q1', 'q2'] },
  executionOrder: ['q1', 'q2', 'q3'],
  fusionStrategy: 'sequential'
}
```

---

### 4. Step-back Prompting (退步提示)

**职责**: 对于需要背景知识的问题，先检索高层概念再检索具体内容

```typescript
interface StepBackPrompter {
  generateStepBackQuery(query: string): Promise<StepBackQuery>;
}

interface StepBackQuery {
  // 原始查询
  original: string;

  // 退步查询（高层概念）
  stepBack: string;

  // 退步层级
  level: number;  // 1=上一层, 2=更高层

  // 退步原因
  reason: string;

  // 执行策略
  strategy: 'parallel' | 'step-back-first';
}
```

**退步生成算法**:

```typescript
// 识别需要退步的情况
function needsStepBack(query: ParsedQuery): boolean {
  const signals = [
    query.intent === 'debug',          // 调试问题需要背景
    query.intent === 'optimization',   // 优化问题需要原理
    query.semantic.action?.includes('实现'), // 实现类需要架构背景
    query.complexity.reasons.includes('needsInference')
  ];

  return signals.some(Boolean);
}

// 生成退步查询
async function generateStepBack(query: string): Promise<StepBackQuery> {
  const prompt = `
对于以下具体问题，生成一个更高层次的背景问题：
1. 背景问题应该是原问题的上层概念或原理
2. 背景问题的答案能为原问题提供必要的上下文

具体问题: ${query}

输出JSON:
{
  "stepBack": "背景问题",
  "level": 1,
  "reason": "为什么需要这个背景",
  "strategy": "step-back-first"
}
`;

  const response = await llm.generate(prompt);
  return parseStepBack(response);
}

// 示例
// 输入: "为什么我的向量检索返回结果不相关？"
// 输出:
{
  stepBack: "向量检索的原理和影响检索准确率的因素",
  level: 1,
  reason: "需要理解向量检索原理才能诊断问题",
  strategy: 'step-back-first'
}

// 输入: "如何优化RAG系统的响应延迟？"
// 输出:
{
  stepBack: "RAG系统性能瓶颈分析",
  level: 1,
  reason: "需要识别瓶颈才能针对性优化",
  strategy: 'step-back-first'
}
```

**执行流程**:

```typescript
async function executeStepBack(stepBack: StepBackQuery): Promise<SearchResult[]> {
  // 1. 先检索退步查询
  const backgroundResults = await retrievalLayer.search({
    query: stepBack.stepBack,
    topK: 10
  });

  // 2. 将背景结果作为上下文，再检索原始查询
  const enrichedQuery = {
    query: stepBack.original,
    context: backgroundResults.map(r => r.content).join('\n')
  };

  const finalResults = await retrievalLayer.searchWithContext(enrichedQuery);

  // 3. 合并结果
  return mergeResults(backgroundResults, finalResults, stepBack.strategy);
}
```

---

### 5. Query Expansion (查询扩展)

**职责**: 扩展查询以覆盖更多语义相关内容

```typescript
interface QueryExpander {
  expand(query: ParsedQuery): Promise<ExpandedQuery>;
}

interface ExpandedQuery {
  // 原始查询
  original: string;

  // 扩展查询
  expansions: Expansion[];

  // 扩展策略
  strategy: ExpansionStrategy;
}

interface Expansion {
  text: string;
  type: 'synonym' | 'related' | 'hypernym' | 'hyponym' | 'rewritten';
  source: 'dictionary' | 'llm' | 'corpus';
  confidence: number;
}

type ExpansionStrategy =
  | 'synonym-expansion'    // 同义词扩展
  | 'semantic-expansion'   // 语义扩展
  | 'multi-query'          // 多查询生成
  | 'hyde';                // HyDE (假设文档嵌入)
```

**扩展算法**:

```typescript
// 同义词扩展
function expandSynonyms(keywords: string[]): Expansion[] {
  const synonymDict = loadSynonymDict();
  const expansions: Expansion[] = [];

  for (const keyword of keywords) {
    const synonyms = synonymDict.get(keyword) || [];
    for (const syn of synonyms) {
      expansions.push({
        text: syn,
        type: 'synonym',
        source: 'dictionary',
        confidence: 0.8
      });
    }
  }

  return expansions;
}

// HyDE (假设文档嵌入)
async function generateHyDE(query: string): Promise<Expansion> {
  const prompt = `
生成一个假设的文档片段，这个文档应该能回答以下问题：
问题: ${query}

假设文档（不包含问题本身，只包含答案内容）:
`;

  const hypotheticalDoc = await llm.generate(prompt);

  return {
    text: hypotheticalDoc,
    type: 'rewritten',
    source: 'llm',
    confidence: 0.7
  };
}

// 多查询生成
async function generateMultiQueries(query: string): Promise<Expansion[]> {
  const prompt = `
生成3个与以下查询语义相同但表达不同的查询变体：
原始查询: ${query}

输出JSON数组:
["变体1", "变体2", "变体3"]
`;

  const variants = await llm.generate(prompt);
  const parsed = JSON.parse(variants);

  return parsed.map((v: string, i: number) => ({
    text: v,
    type: 'rewritten',
    source: 'llm',
    confidence: 0.6 + (0.1 * (3 - i))  // 第一个置信度最高
  }));
}
```

---

### 6. Self-Reflection (自反思)

**职责**: 检索后自我评估，决定是否需要补充检索

```typescript
interface SelfReflector {
  reflect(query: ParsedQuery, results: SearchResult[]): Promise<ReflectionResult>;
}

interface ReflectionResult {
  // 是否需要补充检索
  needsSupplement: boolean;

  // 补充查询
  supplementQueries?: string[];

  // 反思理由
  reason: string;

  // 信心评估
  confidence: {
    overall: number;      // 0-1
    coverage: number;     // 语义覆盖度
    relevance: number;    // 结果相关性
    completeness: number; // 信息完整性
  };

  // 缺失信息
  missingInfo?: string[];
}
```

**反思算法**:

```typescript
async function reflect(
  query: ParsedQuery,
  results: SearchResult[]
): Promise<ReflectionResult> {
  // 1. 覆盖度评估
  const coverage = assessCoverage(query.keywords, results);

  // 2. 相关性评估
  const relevance = assessRelevance(query, results);

  // 3. 完整性评估（LLM驱动）
  const completeness = await assessCompleteness(query, results);

  // 4. 综合判断
  const overallConfidence = (coverage + relevance + completeness) / 3;
  const needsSupplement = overallConfidence < 0.7;

  // 5. 生成补充查询
  let supplementQueries: string[] = [];
  if (needsSupplement) {
    supplementQueries = await generateSupplementQueries(query, results);
  }

  return {
    needsSupplement,
    supplementQueries,
    reason: needsSupplement ? '检索结果不完整' : '检索结果充分',
    confidence: { overall: overallConfidence, coverage, relevance, completeness }
  };
}

// 覆盖度评估
function assessCoverage(keywords: Keywords, results: SearchResult[]): number {
  const allTexts = results.map(r => r.content).join(' ');

  const coreCoverage = keywords.core
    .filter(k => allTexts.includes(k)).length / keywords.core.length;

  const relatedCoverage = keywords.related
    .filter(k => allTexts.includes(k)).length / Math.max(keywords.related.length, 1);

  return coreCoverage * 0.7 + relatedCoverage * 0.3;
}

// 完整性评估（LLM驱动）
async function assessCompleteness(
  query: ParsedQuery,
  results: SearchResult[]
): Promise<number> {
  const prompt = `
评估以下检索结果是否能完整回答查询：

查询: ${query.raw}
意图: ${query.intent}

检索结果:
${results.map(r => `【${r.source}】${r.content}`).join('\n')}

评分（0-1）:
- 0: 完全无法回答
- 0.5: 能回答部分
- 1: 能完整回答

输出JSON:
{
  "score": 0.8,
  "missingInfo": ["缺失的信息1", "缺失的信息2"]
}
`;

  const response = await llm.generate(prompt);
  const parsed = JSON.parse(response);
  return parsed.score;
}

// 生成补充查询
async function generateSupplementQueries(
  query: ParsedQuery,
  results: SearchResult[]
): Promise<string[]> {
  const prompt = `
基于以下检索结果的缺失信息，生成补充查询：

原始查询: ${query.raw}
缺失信息: ${results.missingInfo?.join(',') || '未覆盖的核心内容'}

生成2-3个补充查询（JSON数组）:
["补充查询1", "补充查询2"]
`;

  const response = await llm.generate(prompt);
  return JSON.parse(response);
}
```

---

### 7. Query Fusion (查询融合)

**职责**: 融合多个查询/子查询的检索结果

```typescript
interface QueryFusion {
  fuse(multiQueryResults: Map<string, SearchResult[]>): Promise<FusedResults>;
}

interface FusedResults {
  // 融合后的结果
  results: SearchResult[];

  // 融合方法
  method: 'rrf' | 'weighted' | 'rank-based' | 'semantic-merge';

  // 来源追踪
  sources: Map<string, string[]>;  // resultId -> queryIds

  // 融合信息
  fusionMeta: {
    queriesUsed: number;
    duplicatesRemoved: number;
    avgScoreBefore: number;
    avgScoreAfter: number;
  };
}
```

**融合算法**:

```typescript
// Reciprocal Rank Fusion (RRF)
function fuseWithRRF(
  multiQueryResults: Map<string, SearchResult[]>,
  k: number = 60
): SearchResult[] {
  const scoreMap = new Map<string, number>();

  for (const [queryId, results] of multiQueryResults) {
    for (const result of results) {
      const rank = results.indexOf(result) + 1;
      const rrfScore = 1 / (k + rank);

      const currentScore = scoreMap.get(result.chunkId) || 0;
      scoreMap.set(result.chunkId, currentScore + rrfScore);
    }
  }

  // 按融合分数排序
  const sorted = Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1]);

  return sorted.map(([chunkId, score]) => ({
    chunkId,
    fusedScore: score,
    sourceQueries: findSourceQueries(chunkId, multiQueryResults)
  }));
}

// 权重融合（考虑查询权重）
function fuseWithWeights(
  multiQueryResults: Map<string, SearchResult[]>,
  queryWeights: Map<string, number>
): SearchResult[] {
  const scoreMap = new Map<string, number>();

  for (const [queryId, results] of multiQueryResults) {
    const weight = queryWeights.get(queryId) || 1;

    for (const result of results) {
      const weightedScore = result.score * weight;

      const currentScore = scoreMap.get(result.chunkId) || 0;
      scoreMap.set(result.chunkId, Math.max(currentScore, weightedScore));
    }
  }

  return sortByScore(scoreMap);
}
```

---

## 模块接口汇总

```typescript
// Query Layer 完整接口
interface QueryLayer {
  // 入口方法
  process(rawQuery: string): Promise<ProcessedQuery>;

  // 子模块
  parser: QueryParser;
  router: QueryRouter;
  decomposer: QueryDecomposer;
  stepBackPrompter: StepBackPrompter;
  expander: QueryExpander;
  reflector: SelfReflector;
  fusion: QueryFusion;
}

interface ProcessedQuery {
  // 解析结果
  parsed: ParsedQuery;

  // 路由决策
  route: RouteDecision;

  // 处理后的查询列表
  queries: ExecutionQuery[];

  // 执行计划
  executionPlan: ExecutionPlan;
}

interface ExecutionQuery {
  id: string;
  text: string;
  type: 'original' | 'sub' | 'step-back' | 'expansion' | 'supplement';
  weight: number;
  dependencies?: string[];
}

interface ExecutionPlan {
  // 阶段
  phases: ExecutionPhase[];

  // 预估资源
  estimated: {
    totalQueries: number;
    estimatedTokens: number;
    estimatedLatency: number;
  };
}

interface ExecutionPhase {
  name: string;
  queries: string[];  // queryIds
  parallel: boolean;
  dependsOn?: string[];  // phase names
}
```

---

## 执行流程示例

```typescript
// 复杂查询处理流程
async function processComplexQuery(rawQuery: string): Promise<SearchResult[]> {
  // Phase 1: 解析
  const parsed = await parser.parse(rawQuery);

  // Phase 2: 路由
  const route = await router.route(parsed);

  // Phase 3: 根据策略执行
  switch (route.strategy) {
    case 'decomposition':
      // 分解为子查询
      const decomposed = await decomposer.decompose(parsed);
      const subResults = await executeDecomposed(decomposed);
      const fused = await fusion.fuse(subResults);
      return fused.results;

    case 'step-back':
      // 生成退步查询
      const stepBack = await stepBackPrompter.generateStepBackQuery(rawQuery);
      const stepBackResults = await executeStepBack(stepBack);
      return stepBackResults;

    case 'multi-hop':
      // 多跳检索
      const expanded = await expander.expand(parsed);
      const multiResults = await executeExpanded(expanded);
      return fusion.fuse(multiResults).results;

    default:
      // 单次检索
      const results = await retrievalLayer.search({ query: rawQuery });

      // 自反思
      const reflection = await reflector.reflect(parsed, results);
      if (reflection.needsSupplement) {
        const supplementResults = await executeSupplements(reflection.supplementQueries);
        return fusion.fuse(new Map([
          ['original', results],
          ['supplement', supplementResults]
        ])).results;
      }

      return results;
  }
}
```

---

## Harness 可追踪

```typescript
interface QueryLayerTrace {
  traceId: string;
  rawQuery: string;
  timestamp: Date;

  stages: {
    parse: {
      duration: number;
      output: ParsedQuery;
    };
    route: {
      duration: number;
      decision: RouteDecision;
    };
    process: {
      duration: number;
      strategy: string;
      queriesGenerated: number;
    };
    execution: {
      phases: {
        name: string;
        duration: number;
        queries: number;
        results: number;
      }[];
    };
    reflection?: {
      duration: number;
      needsSupplement: boolean;
      confidence: number;
    };
    fusion: {
      duration: number;
      method: string;
      inputQueries: number;
      outputResults: number;
    };
  };

  totalDuration: number;
  totalQueries: number;
  totalResults: number;
}
```

---

## 验收标准

- [ ] 查询意图正确识别（准确率 > 85%）
- [ ] 复杂度评估准确（误差 < 20%）
- [ ] 路由决策正确（符合预期策略）
- [ ] 查询分解有效（子查询可独立执行）
- [ ] 退步提示生成合理（背景问题有意义）
- [ ] 查询扩展覆盖语义（同义词+变体）
- [ ] 自反思触发正确（置信度阈值有效）
- [ ] 融合结果质量高（RRF效果验证）
- [ ] 全流程可追踪（Trace完整记录）
- [ ] Token消耗可控（预估误差 < 30%）