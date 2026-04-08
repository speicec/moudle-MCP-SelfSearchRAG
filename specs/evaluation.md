# 评估体系规格 (Evaluation Spec)

## 概述

集成 LlamaIndex Evaluation 和回归测试，建立完整的质量评估体系。

## 评估维度

| 维度 | 描述 | 指标 |
|------|------|------|
| **检索质量** | 检索结果相关性 | Recall@K, Precision@K, MRR, NDCG |
| **生成质量** | RAG 生成答案质量 | Faithfulness, Relevance, Coherence |
| **性能指标** | 系统响应效率 | Latency, Throughput, Memory |
| **稳定性** | 系统可靠性 | Error Rate, Availability |
| **回归测试** | 功能正确性 | Test Pass Rate, Coverage |

## LlamaIndex Evaluation 集成

### 检索评估

```typescript
import { RetrieverEvaluator } from 'llamaindex';

// 检索评估器
interface RetrievalEvaluator {
  // 评估配置
  config: {
    metrics: ('hit_rate' | 'mrr' | 'ndcg')[];
    kValues: number[];  // [1, 5, 10, 20]
  };

  // 执行评估
  evaluate(
    queries: EvaluationQuery[],
    retriever: Retriever
  ): Promise<RetrievalMetrics>;
}

interface EvaluationQuery {
  query: string;
  expectedDocIds: string[];  // 期望检索到的文档ID
  expectedChunks?: string[]; // 期望的具体片段
}

interface RetrievalMetrics {
  hit_rate: Map<number, number>;  // k -> hit_rate
  mrr: number;
  ndcg: Map<number, number>;

  details: {
    query: string;
    retrieved: string[];
    expected: string[];
    hit: boolean;
    rank: number;
  }[];
}

// 示例评估
const retrievalEval = new RetrievalEvaluator({
  metrics: ['hit_rate', 'mrr', 'ndcg'],
  kValues: [1, 5, 10, 20]
});

const queries = [
  { query: "如何实现向量检索?", expectedDocIds: ["doc1", "doc5"] },
  { query: "MCP协议是什么?", expectedDocIds: ["doc3"] },
];

const metrics = await retrievalEval.evaluate(queries, ragRetriever);
// 输出:
// hit_rate@5: 0.85
// hit_rate@10: 0.95
// mrr: 0.72
// ndcg@10: 0.81
```

### 生成评估

```typescript
import { ResponseEvaluator } from 'llamaindex';

// 生成评估器
interface GenerationEvaluator {
  // 评估类型
  types: ('faithfulness' | 'relevance' | 'coherence')[];

  // 执行评估
  evaluate(
    responses: EvaluationResponse[],
    context: Document[]
  ): Promise<GenerationMetrics>;
}

interface EvaluationResponse {
  query: string;
  response: string;  // RAG 生成的答案
  retrievedContext: Document[];
}

interface GenerationMetrics {
  faithfulness: number;  // 答案是否基于检索内容（无幻觉）
  relevance: number;     // 答案是否回答了问题
  coherence: number;     // 答案是否连贯

  details: {
    query: string;
    response: string;
    faithfulnessScore: number;
    relevanceScore: number;
    issues: string[];     // 发现的问题
  }[];
}

// 示例评估
const genEval = new GenerationEvaluator({
  types: ['faithfulness', 'relevance', 'coherence']
});

const responses = [
  {
    query: "向量检索原理?",
    response: "向量检索通过计算查询向量与文档向量的相似度...",
    retrievedContext: [doc1, doc2]
  }
];

const metrics = await genEval.evaluate(responses, context);
// 输出:
// faithfulness: 0.92
// relevance: 0.88
// coherence: 0.95
```

### 综合评估管道

```typescript
interface EvaluationPipeline {
  // 评估流程
  run(config: EvaluationConfig): Promise<EvaluationReport>;
}

interface EvaluationConfig {
  // 数据集
  dataset: {
    name: string;
    queries: EvaluationQuery[];
    groundTruth: Map<string, string[]>;  // query -> expected answers
  };

  // 评估器配置
  retrieverEval: {
    enabled: boolean;
    metrics: string[];
    kValues: number[];
  };

  generatorEval: {
    enabled: boolean;
    types: string[];
  };

  // 重复次数（统计显著性）
  iterations: number;
}

interface EvaluationReport {
  timestamp: Date;
  config: EvaluationConfig;

  retrieval: RetrievalMetrics;
  generation?: GenerationMetrics;

  performance: {
    avgRetrievalLatency: number;
    avgGenerationLatency: number;
    totalLatency: number;
  };

  summary: {
    overallScore: number;
    passed: boolean;
    recommendations: string[];
  };

  // 历史对比
  comparison?: {
    previous: EvaluationReport;
    delta: Map<string, number>;
  };
}
```

## 回归测试套件

### 功能回归测试

```typescript
// 回归测试用例
interface RegressionTestCase {
  id: string;
  name: string;
  category: 'index' | 'search' | 'delete' | 'config' | 'mcp';

  // 测试步骤
  steps: TestStep[];

  // 期望结果
  expected: ExpectedResult;

  // 环境要求
  requirements: {
    milvus: boolean;
    offline: boolean;
    multimodal: boolean;
  };
}

interface TestStep {
  action: string;
  input: object;
  expectedOutput?: object;
}

interface ExpectedResult {
  success: boolean;
  output?: object;
  metrics?: {
    maxLatency: number;
    minResults: number;
  };
}

// 测试套件示例
const regressionTests: RegressionTestCase[] = [
  {
    id: 'search-basic-001',
    name: '基础向量检索',
    category: 'search',
    steps: [
      { action: 'rag_index', input: { path: './test-data/docs' } },
      { action: 'rag_search', input: { query: 'test query', topK: 10 } }
    ],
    expected: {
      success: true,
      metrics: { maxLatency: 500, minResults: 5 }
    },
    requirements: { milvus: true, offline: false, multimodal: false }
  },
  {
    id: 'search-hybrid-002',
    name: '混合检索',
    category: 'search',
    steps: [
      { action: 'rag_index', input: { path: './test-data/mixed' } },
      { action: 'rag_search', input: { query: 'code example', mode: 'hybrid' } }
    ],
    expected: {
      success: true,
      metrics: { maxLatency: 800, minResults: 10 }
    },
    requirements: { milvus: true, offline: false, multimodal: false }
  }
];
```

### 性能基准测试

```typescript
// 性能基准
interface PerformanceBenchmark {
  name: string;

  // 测试场景
  scenario: {
    docsCount: number;
    chunksCount: number;
    queryCount: number;
  };

  // 基准指标
  benchmarks: {
    indexLatency: number;     // 索引延迟（ms/doc）
    searchLatency: number;    // 检索延迟（ms）
    throughput: number;       // QPS
    memoryUsage: number;      // 内存使用（MB）
  };

  // 执行测试
  run(): Promise<BenchmarkResult>;
}

interface BenchmarkResult {
  name: string;
  actual: {
    indexLatency: number;
    searchLatency: number;
    throughput: number;
    memoryUsage: number;
  };
  baseline: PerformanceBenchmark['benchmarks'];
  passed: boolean;
  delta: Map<string, number>;
}

// 基准测试套件
const benchmarks: PerformanceBenchmark[] = [
  {
    name: 'small-dataset',
    scenario: { docsCount: 100, chunksCount: 500, queryCount: 50 },
    benchmarks: { indexLatency: 100, searchLatency: 50, throughput: 100, memoryUsage: 200 }
  },
  {
    name: 'medium-dataset',
    scenario: { docsCount: 1000, chunksCount: 5000, queryCount: 100 },
    benchmarks: { indexLatency: 150, searchLatency: 80, throughput: 50, memoryUsage: 500 }
  },
  {
    name: 'large-dataset',
    scenario: { docsCount: 10000, chunksCount: 50000, queryCount: 200 },
    benchmarks: { indexLatency: 200, searchLatency: 150, throughput: 20, memoryUsage: 1500 }
  }
];
```

### 自动回归流程

```typescript
// 回归测试运行器
interface RegressionRunner {
  // 运行所有测试
  runAll(): Promise<RegressionReport>;

  // 运行指定类别
  runCategory(category: string): Promise<RegressionReport>;

  // 运行单个测试
  runTest(testId: string): Promise<TestResult>;
}

interface RegressionReport {
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;

  results: TestResult[];

  summary: {
    passRate: number;
    categories: Map<string, { passed: number, failed: number }>;
    avgLatency: number;
  };

  // 与上次对比
  comparison?: {
    previousPassRate: number;
    newFailures: string[];
    fixedTests: string[];
  };
}

interface TestResult {
  testId: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';

  actualOutput?: object;
  expectedOutput: object;

  latency: number;
  error?: string;

  metrics?: BenchmarkResult;
}
```

## MCP Tool 支持

```typescript
// 新增评估 Tool
interface EvalTools {
  // rag_eval_retrieval: 检索评估
  rag_eval_retrieval(input: {
    dataset?: string;       // 数据集名称
    queries?: EvaluationQuery[];  // 自定义查询
    metrics?: string[];
    kValues?: number[];
  }): Promise<RetrievalMetrics>;

  // rag_eval_generation: 生成评估
  rag_eval_generation(input: {
    responses: EvaluationResponse[];
    types?: string[];
  }): Promise<GenerationMetrics>;

  // rag_eval_run: 综合评估
  rag_eval_run(input: {
    config: EvaluationConfig;
  }): Promise<EvaluationReport>;

  // rag_regression_run: 回归测试
  rag_regression_run(input: {
    category?: string;
    testIds?: string[];
  }): Promise<RegressionReport>;

  // rag_benchmark_run: 性能基准
  rag_benchmark_run(input: {
    name?: string;
  }): Promise<BenchmarkResult>;
}
```

## Harness 可追踪评估

```typescript
// 评估追踪记录
interface EvaluationTrace {
  evalId: string;
  timestamp: Date;
  type: 'retrieval' | 'generation' | 'regression' | 'benchmark';

  config: object;
  results: object;

  // Harness 集成
  harness: {
    constraintsChecked: string[];
    feedbackGenerated: string[];
    adjustmentsRecommended: string[];
  };

  // 持久化
  persisted: boolean;
  path: string;
}
```

## CI/CD 集成

```yaml
# GitHub Actions 评估流程
name: Evaluation

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  evaluation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install
        run: npm ci

      - name: Regression Tests
        run: npm run test:regression

      - name: Retrieval Evaluation
        run: npm run eval:retrieval

      - name: Performance Benchmark
        run: npm run benchmark

      - name: Generate Report
        run: npm run eval:report

      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: evaluation-results
          path: ./eval-results/
```

## 验收标准

- [ ] 检索评估集成 LlamaIndex Eval
- [ ] 生成评估可选集成
- [ ] 回归测试套件覆盖核心功能
- [ ] 性能基准测试定义明确
- [ ] CI/CD 流程包含评估步骤
- [ ] 评估报告可生成和存储
- [ ] 评估结果可追踪和历史对比
- [ ] Recall@10 > 80% 基准达标
- [ ] 回归测试通过率 100%