/**
 * @spec query-layer.md
 * @layer 3
 * @description 查询层接口定义
 */

// 查询意图
export type QueryIntent =
  | 'definition'
  | 'how-to'
  | 'example'
  | 'comparison'
  | 'debug'
  | 'optimization'
  | 'exploration'
  | 'fact-check'
  | 'multi-hop'
  | 'general';

// 检索策略
export type RetrievalStrategy =
  | 'single-hop'
  | 'multi-hop'
  | 'decomposition'
  | 'step-back'
  | 'hybrid-reasoning'
  | 'exploratory'
  | 'fact-verification';

// 解析后的查询
export interface ParsedQuery {
  raw: string;
  intent: QueryIntent;
  intentConfidence: number;
  keywords: {
    core: string[];
    related: string[];
    excluded: string[];
  };
  semantic: {
    subject?: string;
    action?: string;
    object?: string;
    conditions?: string[];
  };
  complexity: {
    level: 'simple' | 'medium' | 'complex';
    score: number;
    reasons: string[];
  };
  modality: 'text' | 'code' | 'mixed';
  language: string;
}

// 路由决策
export interface RouteDecision {
  strategy: RetrievalStrategy;
  subStrategies?: RetrievalStrategy[];
  reason: string;
  estimatedResources: {
    retrievalPaths: number;
    maxCandidates: number;
    estimatedTokens: number;
    estimatedLatency: number;
  };
}

// 子查询
export interface SubQuery {
  id: string;
  query: string;
  type: 'atomic' | 'derived';
  dependsOn?: string[];
  expectedResult: 'definition' | 'code' | 'example' | 'fact';
  weight: number;
}

// 分解后的查询
export interface DecomposedQueries {
  subQueries: SubQuery[];
  dependencies: Map<string, string[]>;
  executionOrder: string[];
  fusionStrategy: 'sequential' | 'parallel' | 'conditional';
}

// 执行查询
export interface ExecutionQuery {
  id: string;
  text: string;
  type: 'original' | 'sub' | 'step-back' | 'expansion' | 'supplement';
  weight: number;
  dependencies?: string[];
  embedding?: number[];
}

// 子查询预期结果类型
export type ExpectedResult = 'definition' | 'code' | 'example' | 'fact';

// 处理后的查询
export interface ProcessedQuery {
  parsed: ParsedQuery;
  route: RouteDecision;
  queries: ExecutionQuery[];
  executionPlan: {
    phases: { name: string; queries: string[]; parallel: boolean }[];
  };
}

// 查询解析器接口
export interface IQueryParser {
  parse(rawQuery: string): Promise<ParsedQuery>;
}

// 查询路由器接口
export interface IQueryRouter {
  route(parsedQuery: ParsedQuery): Promise<RouteDecision>;
}

// 查询分解器接口
export interface IQueryDecomposer {
  decompose(query: ParsedQuery): Promise<DecomposedQueries>;
}

// 查询扩展器接口
export interface IQueryExpander {
  expand(query: ParsedQuery): Promise<{ original: string; expansions: string[] }>;
}

// 查询追踪
export interface QueryTrace {
  traceId: string;
  rawQuery: string;
  timestamp: Date;
  stages: {
    parse: { duration: number; output: ParsedQuery };
    route: { duration: number; decision: RouteDecision };
    process: { duration: number; strategy: string; queriesGenerated: number };
  };
  totalDuration: number;
  totalQueries: number;
}