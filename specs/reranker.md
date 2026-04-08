# 重排精排规格 (Reranker Spec)

## 概述

完整的检索管道：召回 → 粗排 → 精排 → 重排 → 过滤 → 融合

## 检索管道架构

```
┌─────────┐    ┌───────────────────────────────┐    ┌─────────────┐    ┌─────────────┐
│  Query  │ →  │         Recall (多路召回)      │ →  │   Rerank    │ →  │   Result    │
│  Parse  │    │                               │    │  (精排)     │    │   Fusion    │
└─────────┘    │  ┌───────┐ ┌───────┐ ┌───────┐│    └─────────────┘    └─────────────┘
               │  │Vector │ │Fulltext│ │ Code ││           │                │
               │  │Recall │ │Recall │ │Recall││           ↓                ↓
               │  └───────┘ └───────┘ └───────┘│    ┌─────────────┐    ┌─────────────┐
               │         ↓      ↓      ↓       │ →  │   Filter    │ →  │   Format    │
               │         └──────┴──────┘       │    │  (过滤)     │    │   Output    │
               │              ↓                │    └─────────────┘    └─────────────┘
               └───────────────────────────────┘
```

## 阶段详解

### 1. Query Parse (查询解析)

```typescript
interface QueryParser {
  parse(rawQuery: string): ParsedQuery;
}

interface ParsedQuery {
  // 原始查询
  raw: string;

  // 解析结果
  keywords: string[];           // 关键词提取
  semanticQuery: string;        // 语义查询文本
  filters: QueryFilter[];       // 过滤条件
  intent: QueryIntent;          // 查询意图

  // 模态
  modality: ModalityType;

  // 扩展
  expansions: string[];         // 查询扩展（同义词、相关词）
}

type QueryIntent = 'definition' | 'how-to' | 'example' | 'comparison' | 'debug' | 'general';
```

### 2. Recall (多路召回)

```typescript
interface RecallEngine {
  // 多路召回
  recall(query: ParsedQuery, config: RecallConfig): Promise<RecallResult[]>;
}

interface RecallConfig {
  // 各路召回配置
  vector: {
    enabled: boolean;
    topK: number;
    threshold: number;
  };
  fulltext: {
    enabled: boolean;
    topK: number;
    minScore: number;
  };
  code: {
    enabled: boolean;
    topK: number;
    astMatch: boolean;
  };
  offline: {
    enabled: boolean;
    topK: number;
  };

  // 并行配置
  parallel: boolean;
  timeout: number;
}

interface RecallResult {
  chunkId: string;
  docId: string;
  content: string;
  source: string;
  score: number;
  recallPath: 'vector' | 'fulltext' | 'code' | 'offline';
  metadata: ChunkMetadata;
}

// 召回合并（粗排）
function mergeRecallResults(results: Map<string, RecallResult[]>): MergedRecall {
  // 去重
  // 分数归一化
  // 按分数排序
  // 返回 top candidates
}
```

### 3. Rerank (精排)

```typescript
interface Reranker extends Plugin {
  // 精排方法
  rerank(query: ParsedQuery, candidates: RecallResult[]): Promise<RerankedResult[]>;

  // 支持的类型
  type: 'cross-encoder' | 'llm-rerank' | 'learning-to-rank' | 'rule-based';

  // 配置
  config: RerankerConfig;
}

interface RerankerConfig {
  // 输入数量限制
  maxCandidates: number;        // 最多处理多少候选

  // 输出数量
  topK: number;

  // 是否使用 LLM
  useLLM: boolean;
  llmConfig?: {
    model: string;
    maxTokens: number;
  };
}

interface RerankedResult extends RecallResult {
  rerankScore: number;          // 精排分数
  relevanceReason?: string;     // LLM 生成的相关性解释
  confidence: number;           // 置信度
}

// 精排策略
type RerankStrategy =
  | 'cross-encoder'    // Cross-Encoder 模型（精度高，速度慢）
  | 'llm-based'        // LLM 评分（最灵活，成本高）
  | 'colbert'          // ColBERT late interaction（平衡）
  | 'rule-based'       // 规则排序（速度快，精度低）
  | 'hybrid';          // 多策略组合
```

### 4. Filter (过滤)

```typescript
interface ResultFilter {
  filter(results: RerankedResult[], criteria: FilterCriteria): Promise<FilteredResult[]>;
}

interface FilterCriteria {
  // 基础过滤
  minScore: number;
  maxAge?: number;              // 文档时效性
  dedupByDoc?: boolean;         // 按文档去重
  dedupByContent?: boolean;     // 按内容去重

  // 元数据过滤
  extensions?: string[];        // 文件类型限制
  languages?: string[];         // 语言限制
  modality?: ModalityType[];    // 模态限制

  // 自定义规则
  customRules?: FilterRule[];
}

interface FilterRule {
  id: string;
  condition: (result: RerankedResult) => boolean;
  action: 'include' | 'exclude' | 'transform';
}
```

### 5. Result Fusion (结果融合)

```typescript
interface ResultFusion {
  fuse(results: FilteredResult[], method: FusionMethod): Promise<FinalResult[]>;
}

type FusionMethod =
  | 'rrf'             // Reciprocal Rank Fusion
  | 'weighted'        // 加权融合
  | 'max'             // 取最大分数
  | 'llm-synthesis';  // LLM 合成摘要

interface FinalResult extends FilteredResult {
  finalScore: number;
  fusionMethod: string;
  rank: number;
}
```

## Reranker 插件接口

```typescript
// Reranker 插件定义
interface RerankerPluginDefinition extends PluginDefinition {
  type: 'reranker';
  strategy: RerankStrategy;
  config: RerankerConfig;
  factory: () => Reranker;
}

// 示例插件注册
pluginRegistry.register('reranker:cross-encoder', {
  type: 'reranker',
  strategy: 'cross-encoder',
  config: { maxCandidates: 100, topK: 20 },
  factory: () => new CrossEncoderReranker({
    model: 'BAAI/bge-reranker-base'
  })
});

pluginRegistry.register('reranker:llm', {
  type: 'reranker',
  strategy: 'llm-based',
  config: { maxCandidates: 50, topK: 10, useLLM: true },
  factory: () => new LLMReranker({
    model: 'claude-3-haiku'
  })
});

pluginRegistry.register('reranker:rule-based', {
  type: 'reranker',
  strategy: 'rule-based',
  config: { maxCandidates: 200, topK: 30 },
  factory: () => new RuleBasedReranker({
    rules: [
      { name: 'exact-match', boost: 2.0 },
      { name: 'keyword-density', weight: 0.5 },
      { name: 'freshness', decay: 0.1 }
    ]
  })
});
```

## 精排流程

### Cross-Encoder 精排
```
候选列表 (100条)
  → 构建 query-doc pair
  → 批量送入 Cross-Encoder 模型
  → 获取相关性分数
  → 按分数排序
  → 返回 topK (20条)
```

### LLM 精排
```
候选列表 (50条)
  → 分批构建 prompt
  → LLM 评分 + 解释
  → 解析分数
  → 按分数排序
  → 返回 topK (10条)

Prompt 示例:
"""
对以下文档片段与查询的相关性进行评分(0-10):
查询: {query}
片段: {content}
评分标准:
- 10: 完全匹配，直接解答查询
- 7-9: 高度相关，包含关键信息
- 4-6: 部分相关，需要进一步提取
- 1-3: 低相关，仅涉及边缘内容
- 0: 不相关

请输出:
分数: X
理由: 简短解释
"""
```

### Rule-Based 精排
```
候选列表 (200条)
  → 计算多个规则分数
    │ → exact-match-score
    │ → keyword-density-score
    │ → semantic-similarity-score
    │ → freshness-score
    │ → authority-score
  → 加权组合
  → 排序
  → 返回 topK (30条)
```

## MCP Tool 接口

```typescript
// rag_search 支持 rerank
interface SearchInput {
  query: string;
  topK?: number;

  // 召回配置
  recall?: {
    paths?: ('vector' | 'fulltext' | 'code' | 'offline')[];
    eachTopK?: number;
  };

  // 精排配置
  rerank?: {
    enabled: boolean;
    strategy?: RerankStrategy;
    reranker?: string;           // 指定插件名
    topK?: number;
  };

  // 过滤配置
  filter?: FilterCriteria;
}

// 返回结果包含精排信息
interface SearchResult {
  // ... 原有字段

  // 精排信息
  rerankInfo?: {
    strategy: string;
    rerankScore: number;
    confidence: number;
    reason?: string;
  };
}
```

## Harness 可追踪

```typescript
// 每个阶段记录追踪信息
interface RetrievalTrace {
  traceId: string;
  query: string;
  timestamp: Date;

  stages: {
    parse: {
      duration: number;
      output: ParsedQuery;
    };
    recall: {
      duration: number;
      paths: {
        vector: { count: number, topScore: number };
        fulltext: { count: number, topScore: number };
        code: { count: number, topScore: number };
        offline: { count: number, topScore: number };
      };
      merged: number;
    };
    rerank: {
      duration: number;
      strategy: string;
      input: number;
      output: number;
      topScore: number;
    };
    filter: {
      duration: number;
      input: number;
      output: number;
      rulesApplied: string[];
    };
    fusion: {
      duration: number;
      method: string;
      output: number;
    };
  };

  totalDuration: number;
  finalResults: number;
}
```

## 验收标准

- [ ] 多路召回正常工作（至少2路）
- [ ] 精排插件可配置替换
- [ ] Cross-Encoder 精排有效果提升
- [ ] LLM 精排可选工作
- [ ] 过滤规则生效
- [ ] 结果融合正确
- [ ] 每个阶段有追踪记录
- [ ] 精排后 Recall@10 提升 10%+