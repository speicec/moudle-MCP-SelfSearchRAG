/**
 * @spec prompts.md
 * @layer 6
 * @description MCP Prompts实现
 */

import type { PromptDefinition, PromptResult } from './interface';

// Search Optimize Prompt
export const searchOptimizePrompt: PromptDefinition = {
  name: 'search-optimize',
  description: '优化检索查询以提高结果相关性',
  arguments: [
    { name: 'query', description: '原始检索查询', required: true },
    { name: 'context', description: '查询上下文', required: false }
  ]
};

export function createSearchOptimizePrompt(args: Record<string, string>): PromptResult {
  const query = args.query || '';
  const context = args.context || '';

  return {
    description: '优化检索查询以提高结果相关性',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `请优化以下检索查询以提高结果相关性：

原始查询: ${query}
${context ? `上下文: ${context}` : ''}

请提供:
1. 优化后的查询文本
2. 建议的检索模式 (vector/fulltext/hybrid/code)
3. 可能的过滤条件
4. 查询扩展关键词`
        }
      }
    ]
  };
}

// Result Summary Prompt
export const resultSummaryPrompt: PromptDefinition = {
  name: 'result-summary',
  description: '汇总和总结检索结果',
  arguments: [
    { name: 'query', description: '原始查询', required: true },
    { name: 'results', description: '检索结果JSON', required: true }
  ]
};

export function createResultSummaryPrompt(args: Record<string, string>): PromptResult {
  const query = args.query || '';
  const results = args.results || '[]';

  return {
    description: '汇总和总结检索结果',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `请汇总以下检索结果：

原始查询: ${query}

检索结果:
${results}

请提供:
1. 结果摘要（关键信息提炼）
2. 结果相关性分析
3. 信息完整性评估
4. 建议的后续查询（如有需要）`
        }
      }
    ]
  };
}

// 所有Prompt定义
export const allPromptDefinitions: PromptDefinition[] = [
  searchOptimizePrompt,
  resultSummaryPrompt
];