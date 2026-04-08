/**
 * @spec query-layer.md#查询分解
 * @layer 3
 * @description 查询分解器实现
 */

import type { ParsedQuery, DecomposedQueries, SubQuery } from './interface';

export class QueryDecomposer {
  async decompose(query: ParsedQuery): Promise<DecomposedQueries> {
    // 简单规则分解（实际应用中可使用LLM）
    const subQueries: SubQuery[] = [];

    if (query.intent === 'comparison') {
      // 比较查询分解
      const entities = this.extractEntities(query);
      for (let i = 0; i < entities.length; i++) {
        subQueries.push({
          id: `q${i + 1}`,
          query: `${entities[i]} 的特点和特性`,
          type: 'atomic',
          expectedResult: 'definition',
          weight: 0.4
        });
      }
      // 添加比较子查询
      if (entities.length >= 2) {
        subQueries.push({
          id: `q${entities.length + 1}`,
          query: `${entities[0]} 和 ${entities[1]} 的区别`,
          type: 'derived',
          dependsOn: ['q1', 'q2'],
          expectedResult: 'definition',
          weight: 0.6
        });
      }
    } else if (query.intent === 'how-to' && query.complexity.score > 4) {
      // 复杂how-to分解
      const steps = this.extractSteps(query.raw);
      steps.forEach((step, i) => {
        subQueries.push({
          id: `q${i + 1}`,
          query: step,
          type: 'atomic',
          expectedResult: 'definition',
          weight: 1 / steps.length
        });
      });
    } else if (query.intent === 'multi-hop') {
      // 多跳查询分解
      const parts = query.raw.split(/然后|接着|之后/);
      parts.forEach((part, i) => {
        subQueries.push({
          id: `q${i + 1}`,
          query: part.trim(),
          type: i === 0 ? 'atomic' : 'derived',
          dependsOn: i > 0 ? [`q${i}`] : undefined,
          expectedResult: 'definition',
          weight: 1 / parts.length
        });
      });
    } else {
      // 默认：保持原查询
      subQueries.push({
        id: 'q1',
        query: query.raw,
        type: 'atomic',
        expectedResult: 'definition',
        weight: 1
      });
    }

    // 计算依赖关系
    const dependencies = new Map<string, string[]>();
    subQueries.forEach(sq => {
      if (sq.dependsOn) {
        dependencies.set(sq.id, sq.dependsOn);
      }
    });

    // 计算执行顺序
    const executionOrder = this.calculateExecutionOrder(subQueries);

    // 确定融合策略
    const fusionStrategy = this.determineFusionStrategy(subQueries);

    return {
      subQueries,
      dependencies,
      executionOrder,
      fusionStrategy
    };
  }

  private extractEntities(query: ParsedQuery): string[] {
    // 简单实体提取
    const text = query.raw;
    const match = text.match(/比较\s*([\u4e00-\u9fa5a-zA-Z]+)\s*(和|与|同)\s*([\u4e00-\u9fa5a-zA-Z]+)/);
    if (match) {
      return [match[1], match[3]];
    }
    return query.keywords.core.slice(0, 2);
  }

  private extractSteps(query: string): string[] {
    // 简单步骤提取
    const stepPatterns = /首先|然后|接着|最后|第一步|第二步/g;
    const hasSteps = stepPatterns.test(query);

    if (hasSteps) {
      return query.split(stepPatterns).filter(s => s.trim().length > 0);
    }

    // 单一任务
    return [query];
  }

  private calculateExecutionOrder(subQueries: SubQuery[]): string[] {
    // 拓扑排序
    const order: string[] = [];
    const visited = new Set<string>();
    const dependencies = new Map<string, string[]>();

    subQueries.forEach(sq => {
      if (sq.dependsOn) {
        dependencies.set(sq.id, sq.dependsOn);
      }
    });

    // 先处理无依赖的
    subQueries.forEach(sq => {
      if (!sq.dependsOn) {
        order.push(sq.id);
        visited.add(sq.id);
      }
    });

    // 处理有依赖的
    while (order.length < subQueries.length) {
      for (const sq of subQueries) {
        if (!visited.has(sq.id)) {
          const deps = dependencies.get(sq.id) || [];
          if (deps.every(d => visited.has(d))) {
            order.push(sq.id);
            visited.add(sq.id);
          }
        }
      }
    }

    return order;
  }

  private determineFusionStrategy(subQueries: SubQuery[]): 'sequential' | 'parallel' | 'conditional' {
    const hasDependencies = subQueries.some(sq => sq.dependsOn);
    return hasDependencies ? 'sequential' : 'parallel';
  }
}

export const queryDecomposer = new QueryDecomposer();