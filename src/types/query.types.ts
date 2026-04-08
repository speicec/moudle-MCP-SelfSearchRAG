/**
 * @spec query-layer.md
 * @layer 0
 * @description 查询类型定义
 */

export type QueryIntent =
  | 'definition'
  | 'how-to'
  | 'example'
  | 'comparison'
  | 'debug'
  | 'optimization'
  | 'exploration'
  | 'fact-check'
  | 'multi-hop';

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

export type RetrievalStrategy =
  | 'single-hop'
  | 'multi-hop'
  | 'decomposition'
  | 'step-back'
  | 'hybrid-reasoning'
  | 'exploratory'
  | 'fact-verification';

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

export interface ExecutionQuery {
  id: string;
  text: string;
  type: 'original' | 'sub' | 'step-back' | 'expansion' | 'supplement';
  weight: number;
  dependencies?: string[];
}

export interface ProcessedQuery {
  parsed: ParsedQuery;
  route: RouteDecision;
  queries: ExecutionQuery[];
}