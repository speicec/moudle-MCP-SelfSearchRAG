/**
 * @spec evaluation.md
 * @layer 4
 * @description 评估体系接口定义
 */

// 评估查询
export interface EvaluationQuery {
  query: string;
  expectedDocIds: string[];
  expectedChunks?: string[];
}

// 检索评估指标
export interface RetrievalMetrics {
  hitRate: Map<number, number>;
  mrr: number;
  ndcg: Map<number, number>;
  precision: Map<number, number>;
  recall: Map<number, number>;
  details: Array<{
    query: string;
    retrieved: string[];
    expected: string[];
    hit: boolean;
    rank: number;
  }>;
}

// 生成评估响应
export interface EvaluationResponse {
  query: string;
  response: string;
  retrievedContext: Array<{ content: string }>;
}

// 生成评估指标
export interface GenerationMetrics {
  faithfulness: number;
  relevance: number;
  coherence: number;
  details: Array<{
    query: string;
    response: string;
    faithfulnessScore: number;
    relevanceScore: number;
    issues: string[];
  }>;
}

// 评估配置
export interface EvaluationConfig {
  dataset: {
    name: string;
    queries: EvaluationQuery[];
  };
  retrieverEval: {
    enabled: boolean;
    metrics: string[];
    kValues: number[];
  };
  generatorEval: {
    enabled: boolean;
    types: string[];
  };
  iterations: number;
}

// 评估报告
export interface EvaluationReport {
  timestamp: Date;
  config: EvaluationConfig;
  retrieval?: RetrievalMetrics;
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
}

// 评估器接口
export interface IRetrievalEvaluator {
  evaluate(queries: EvaluationQuery[], results: Array<{ query: string; retrievedIds: string[] }>): Promise<RetrievalMetrics>;
}

export interface IGenerationEvaluator {
  evaluate(responses: EvaluationResponse[]): Promise<GenerationMetrics>;
}

export interface IEvaluationPipeline {
  run(config: EvaluationConfig): Promise<EvaluationReport>;
}