/**
 * @spec query-layer.md#路由决策
 * @layer 3
 * @description 查询路由器实现
 */

import type { ParsedQuery, RouteDecision, RetrievalStrategy } from './interface';

interface RoutingRule {
  condition: (q: ParsedQuery) => boolean;
  strategy: RetrievalStrategy;
  reason: string;
}

export class QueryRouter {
  private routingRules: RoutingRule[] = [
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
      condition: (q) => q.intent === 'debug' && (q.semantic.conditions?.length || 0) > 0,
      strategy: 'step-back',
      reason: '调试问题需要退步思考上下文'
    },
    {
      condition: (q) => q.intent === 'exploration',
      strategy: 'exploratory',
      reason: '探索式查询需要广度检索'
    },
    {
      condition: (q) => q.intent === 'fact-check',
      strategy: 'fact-verification',
      reason: '事实验证需要精确匹配'
    }
  ];

  async route(parsedQuery: ParsedQuery): Promise<RouteDecision> {
    // 遍历规则表
    for (const rule of this.routingRules) {
      if (rule.condition(parsedQuery)) {
        return this.createDecision(rule.strategy, rule.reason, parsedQuery);
      }
    }

    // 默认策略
    return this.createDecision('single-hop', '默认单次检索', parsedQuery);
  }

  private createDecision(
    strategy: RetrievalStrategy,
    reason: string,
    query: ParsedQuery
  ): RouteDecision {
    const resources = this.estimateResources(strategy, query);

    return {
      strategy,
      reason,
      estimatedResources: resources
    };
  }

  private estimateResources(
    strategy: RetrievalStrategy,
    query: ParsedQuery
  ): RouteDecision['estimatedResources'] {
    const baseLatency = 100;
    const baseTokens = query.raw.length;

    switch (strategy) {
      case 'single-hop':
        return {
          retrievalPaths: 1,
          maxCandidates: 20,
          estimatedTokens: baseTokens + 500,
          estimatedLatency: baseLatency
        };

      case 'decomposition':
        const subQueryCount = Math.ceil(query.complexity.score / 2);
        return {
          retrievalPaths: subQueryCount,
          maxCandidates: 20 * subQueryCount,
          estimatedTokens: baseTokens * subQueryCount + 1000,
          estimatedLatency: baseLatency * subQueryCount
        };

      case 'multi-hop':
        return {
          retrievalPaths: 2,
          maxCandidates: 40,
          estimatedTokens: baseTokens * 2 + 800,
          estimatedLatency: baseLatency * 2
        };

      case 'exploratory':
        return {
          retrievalPaths: 3,
          maxCandidates: 50,
          estimatedTokens: baseTokens + 1500,
          estimatedLatency: baseLatency * 1.5
        };

      default:
        return {
          retrievalPaths: 1,
          maxCandidates: 20,
          estimatedTokens: baseTokens + 500,
          estimatedLatency: baseLatency
        };
    }
  }
}

export const queryRouter = new QueryRouter();