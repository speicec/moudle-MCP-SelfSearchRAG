/**
 * @spec plugin-system.md#内置插件
 * @layer 1
 * @description 内置Reranker插件
 */

import { BasePlugin } from '../../interface';
import type { PluginDefinition } from '../../../types/index';
import type { IReranker, RerankedResult, RerankStrategy, ProcessedQuery } from '../../../retrieval/interface';
import type { RecallResult } from '../../../retrieval/interface';
import { RuleBasedReranker } from '../../../retrieval/rerank/index';

// Rule-based Reranker Plugin
class RuleBasedRerankerPlugin extends BasePlugin implements IReranker {
  meta = {
    name: 'reranker:rule-based',
    version: '1.0.0',
    type: 'reranker' as const,
    compatibleVersions: ['1.x']
  };

  private reranker = new RuleBasedReranker();

  async rerank(query: ProcessedQuery, candidates: RecallResult[]): Promise<RerankedResult[]> {
    return this.reranker.rerank(query, candidates);
  }

  getStrategy(): RerankStrategy {
    return this.reranker.getStrategy();
  }
}

// 插件定义
export const ruleBasedRerankerDefinition: PluginDefinition = {
  meta: {
    name: 'reranker:rule-based',
    version: '1.0.0',
    type: 'reranker',
    compatibleVersions: ['1.x']
  },
  factory: () => new RuleBasedRerankerPlugin()
};

export { RuleBasedRerankerPlugin };