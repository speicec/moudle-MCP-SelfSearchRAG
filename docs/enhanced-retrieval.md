# Enhanced Retrieval System

> 查询优化 + 置信度重排 + 动态TopK

## Overview

本系统增强传统Small-to-Big检索，引入：

1. **Query Optimization Layer** - 智能分析、重写、扩展、分解用户查询
2. **Dynamic TopK Calculator** - 根据模型上下文窗口动态计算检索量
3. **Reranking Layer** - 置信度计算 + 本地重排模型 + 低置信度处理
4. **Enhanced Pipeline** - 8阶段检索流程

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Enhanced Retrieval Pipeline                          │
└─────────────────────────────────────────────────────────────────────────┘

User Query
    │
    ▼
┌───────────────┐
│   Analyzer    │  复杂度判断 + 滤镜检测
│   (LLM)       │  → QueryAnalysisResult
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   Rewriter    │  口语化 → 专业术语
│   (LLM)       │  → rewrittenQuery
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   Expander    │  同义词扩展
│  (Dictionary) │  → expandedTerms[]
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  Decomposer   │  复杂问题拆分
│   (Rules)     │  → subQueries[]
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   Retriever   │  Multi-Query检索 + 结果合并
│ (Small-to-Big)│  → ConfidenceRetrievalResult[]
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   Reranker    │  Hybrid策略 (阈值路由)
│   (Hybrid)    │  → rerankedResults
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   Assembler   │  置信度标注 + 动态截断
│  (Context)    │  → EnhancedAssembledContext
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  LLM Service  │  置信度Prompt + 答案生成
│  (DeepSeek)   │  → StreamingAnswer
└───────────────┘
```

---

## Phase 1: Query Optimization

### 1.1 QueryAnalyzer

**职责**：分析用户查询意图

```typescript
interface QueryAnalysisResult {
  complexity: 'simple' | 'complex' | 'structured';
  detectedFilters?: {
    year?: number;
    month?: number;
    category?: string[];
    documentType?: string[];
  };
  intent?: string;
  keywords: string[];
}
```

**复杂度判断规则**：

| 复杂度 | 触发条件 | 处理策略 |
|--------|----------|----------|
| simple | 单关键词、短句 | 直接检索 |
| complex | 对比类、多问题 | 分解子查询 |
| structured | 含时间、分类筛选 | 构建DSL |

**滤镜检测**：

- `year`: 正则匹配 `\d{4}年`
- `month`: 正则匹配 `\d{1,2}月`
- `category`: 预定义分类词典匹配
- `documentType`: 预定义文档类型匹配

### 1.2 QueryRewriter

**职责**：口语化查询 → 专业术语

```typescript
// 示例映射
const PROFESSIONAL_TERMS = {
  '跑得快': '性能优化',
  '更稳': '系统可用性',
  '省内存': '内存管理优化',
  '不卡': '响应时间优化',
  ...
};
```

**LLM Prompt模板**：

```
你是查询重写专家。将用户的口语化表达转换为专业术语。

用户查询: {query}
输出要求: 仅输出重写后的查询，不要解释。
```

### 1.3 QueryDecomposer

**职责**：复杂问题拆分为子查询

**分解模式**：

```typescript
const DECOMPOSITION_PATTERNS = [
  {
    pattern: /对比|比较|vs|versus/i,
    type: 'comparison',
    template: (match) => ['{A}的特点', '{B}的特点', '{A}与{B}的对比']
  },
  {
    pattern: /和|与|以及|同时/i,
    type: 'and_clause',
    template: (match) => [splitByAnd(match)]
  },
  {
    pattern: /问题|疑问|疑问\d|Q\d/i,
    type: 'multiple_questions',
    template: (match) => extractQuestions(match)
  }
];
```

**限制**：`maxSubQueries = 5`，防止过度分解

### 1.4 QueryExpander

**职责**：同义词扩展

```json
// config/synonyms.json 示例
{
  "性能优化": ["提速", "性能提升", "响应优化"],
  "缓存": ["cache", "Redis", "Memcached"],
  "数据库": ["DB", "存储系统", "持久化"]
}
```

### 1.5 QueryDSLBuilder

**职责**：构建检索DSL

```typescript
interface QueryDSL {
  filters: {
    year?: { eq?: number; range?: [number, number] };
    category?: { in?: string[] };
  };
  textQuery: string;
}
```

---

## Phase 2: Dynamic TopK

### 计算公式

```
effectiveWindow = modelContextWindow - systemPromptTokens - outputReservation
targetTokens = effectiveWindow × fillRatio
coarseTopK = ceil(targetTokens × overfetchRatio / avgParentTokens)
```

### 预设配置

| Preset | Context Window | Target Tokens | 适用场景 |
|--------|----------------|---------------|----------|
| light | 32K | ~19K | 快速检索 |
| standard | 64K | ~38K | 默认平衡 |
| extended | 128K | ~77K | 复杂分析 |

### 代码示例

```typescript
import { createDynamicTopKCalculator } from './retrieval';

const calculator = createDynamicTopKCalculator({
  preset: 'standard',
  overfetchRatio: 2.0
});

const result = calculator.calculate(avgParentTokenLength);
// { coarseTopK: 25, targetTokens: 38400, effectiveWindow: 64000 }
```

---

## Phase 3: Reranking

### 3.1 ConfidenceCalculator

**四维度置信度计算**：

| 维度 | 权重 | 说明 |
|------|------|------|
| similarityScore | 0.5 | 向量相似度 |
| keywordMatchScore | 0.2 | Jaccard关键词覆盖率 |
| positionScore | 0.1 | 检索位置排名 |
| chunkQualityScore | 0.2 | 分块质量评分 |

```typescript
function calculateKeywordMatchScore(query: string, content: string): number {
  const queryTerms = tokenize(query);
  const contentTerms = tokenize(content);
  const intersection = queryTerms.filter(t => contentTerms.includes(t));
  return intersection.length / queryTerms.length; // Jaccard
}
```

### 3.2 HybridReranker

**路由策略**：

```typescript
function determineMethod(resultCount: number): 'local-reranker' | 'internal-confidence' {
  const threshold = 20;
  return resultCount <= threshold ? 'local-reranker' : 'internal-confidence';
}
```

| 样本数 | 路由 | 模型 |
|--------|------|------|
| ≤20 | LocalReranker | bge-reranker-v2-m3 |
| >20 | ConfidenceCalculator | 内部计算 |

### 3.3 LowConfidenceHandler

**阈值判断**：

```typescript
function check(results: ConfidenceRetrievalResult[]): NoMatchResult | null {
  const avgConfidence = calculateAvgConfidence(results);
  const threshold = 0.3;

  if (avgConfidence < threshold) {
    return {
      status: 'no_match',
      avgConfidence,
      suggestion: '请尝试更具体的查询或检查文档内容'
    };
  }
  return null;
}
```

---

## Phase 4: Pipeline Integration

### EnhancedRetrievalPipeline

```typescript
import { createEnhancedRetrievalPipeline } from './retrieval';

const pipeline = createEnhancedRetrievalPipeline({
  modelContextWindow: 64000,
  minConfidenceThreshold: 0.3,
  rerankerThreshold: 20
});

// 执行检索
const result = await pipeline.execute('怎么让系统响应更快');

// 结果结构
interface PipelineResult {
  success: boolean;
  analysis: QueryAnalysisResult;
  optimization: {
    rewritten?: string;
    expandedTerms?: string[];
    subQueries?: string[];
    wasDecomposed?: boolean;
  };
  results: ConfidenceRetrievalResult[];
  context: EnhancedAssembledContext;
  noMatch?: NoMatchResult;
  stats: {
    totalTime: number;
    method: 'local-reranker' | 'internal-confidence';
    coarseTopK: number;
    refinedCount: number;
  };
}
```

---

## Phase 5: API & Frontend

### API Endpoints

**增强检索端点**：

```
POST /api/chat/enhanced
Body: { query: string, config?: Partial<EnhancedRetrievalConfig> }
Response: {
  answer: string,
  sources: [...],
  queryAnalysis: QueryAnalysisResult,
  retrievalStats: RetrievalStats
}
```

**配置管理端点**：

```
GET /api/chat/config
Response: { presets: {...}, default: EnhancedRetrievalConfig }

POST /api/chat/config
Body: Partial<EnhancedRetrievalConfig>
Response: { merged: EnhancedRetrievalConfig }
```

### Frontend Components

**ConfidenceBadge**：置信度可视化

- High (≥70%): 绿色 ShieldCheck
- Medium (≥50%): 黄色 Shield
- Low (<50%): 红色 ShieldAlert

**RetrievalStatsPanel**：检索统计展示

- 粗排TopK
- 精排数量
- 平均置信度
- 重排方法

---

## Performance Benchmarks

| 模块 | 目标 | 实测 |
|------|------|------|
| TopK Calculator | <1ms | ~0.5ms |
| Confidence (20 results) | <100ms | ~80ms |
| LowConfidence Check | <10ms | ~2ms |
| Context Assembly (100 chunks) | <100ms | ~50ms |
| Full Pipeline | <3s | ~1.5s |

---

## Configuration Reference

```typescript
interface EnhancedRetrievalConfig {
  // Model Context
  modelContextWindow: 32000 | 64000 | 128000;
  systemPromptTokens: number;  // default: 2000
  outputReservation: number;   // default: 1000
  fillRatio: number;           // default: 0.6
  overfetchRatio: number;      // default: 2.0

  // Query Optimization
  enableDecomposition: boolean;  // default: true
  enableRewrite: boolean;        // default: true
  enableExpansion: boolean;      // default: true
  maxSubQueries: number;         // default: 5
  maxExpandedTerms: number;      // default: 5

  // Reranking
  rerankerThreshold: number;     // default: 20
  rerankerModel: string;         // default: 'bge-reranker-v2-m3'

  // Confidence
  minConfidenceThreshold: number; // default: 0.3
  confidenceWeights: {
    similarity: number;    // default: 0.5
    keywordMatch: number;  // default: 0.2
    position: number;      // default: 0.1
    chunkQuality: number;  // default: 0.2
  };
}
```

---

## Testing

### E2E Tests

```bash
npm run test src/__tests__/enhanced-retrieval.test.ts
```

### Performance Benchmarks

```bash
npm run test src/__tests__/performance-benchmarks.test.ts
```

### Recall Evaluation

```bash
npm run test src/__tests__/recall-evaluation.test.ts
```

目标：
- 平均召回率 ≥90%
- 高置信度精确率 ≥80%