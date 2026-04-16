/**
 * Query Decomposer
 *
 * Decomposes complex queries into sub-queries for multi-dimensional retrieval.
 */

import type { DecompositionResult } from './types.js';
import type { EnhancedRetrievalConfig } from './config.js';
import { DEFAULT_ENHANCED_RETRIEVAL_CONFIG } from './config.js';

/**
 * Decomposition prompt template
 */
const DECOMPOSITION_PROMPT_TEMPLATE = `
将以下复杂查询分解为多个子查询，以便从不同角度检索相关信息：

原始查询: "{{query}}"

分解要求：
- 每个子查询应该是一个独立的检索目标
- 子查询之间不要重叠
- 最多分解为 {{maxSubQueries}} 个子查询
- 如果查询不复杂，可以返回空数组

返回JSON格式:
{
  "subQueries": ["子查询1", "子查询2", ...],
  "strategy": "parallel" 或 "sequential"
}

只返回JSON，不要解释。
`;

/**
 * Common decomposition patterns (for heuristic)
 */
const DECOMPOSITION_PATTERNS = {
  comparison: {
    pattern: /对比|比较|区别|异同|优缺点/,
    strategy: 'parallel',
    extract: (query: string) => {
      // Extract comparison subjects
      const subjects = query.split(/对比|比较|和|与|的/)
        .map(s => s.trim())
        .filter(s => s.length > 2 && s.length < 50);
      return subjects;
    },
  },
  multiple_questions: {
    pattern: /[?？].*[?？]/,
    strategy: 'parallel',
    extract: (query: string) => {
      const questions = query.split(/[?？]/)
        .map(s => s.trim())
        .filter(s => s.length > 5);
      return questions;
    },
  },
  and_clause: {
    pattern: /同时|并且|以及|还|和/,
    strategy: 'parallel',
    extract: (query: string) => {
      const parts = query.split(/同时|并且|以及|还/)
        .map(s => s.trim())
        .filter(s => s.length > 5);
      return parts;
    },
  },
};

/**
 * Query Decomposer class
 */
export class QueryDecomposer {
  private config: EnhancedRetrievalConfig;
  private llmCaller: ((prompt: string) => Promise<string>) | undefined;

  constructor(
    config?: Partial<EnhancedRetrievalConfig>,
    llmCaller?: (prompt: string) => Promise<string>
  ) {
    this.config = { ...DEFAULT_ENHANCED_RETRIEVAL_CONFIG, ...config };
    this.llmCaller = llmCaller ?? undefined;
  }

  /**
   * Set LLM caller function
   */
  setLLMCaller(caller: (prompt: string) => Promise<string>): void {
    this.llmCaller = caller;
  }

  /**
   * Decompose complex query into sub-queries
   */
  async decompose(query: string): Promise<DecompositionResult> {
    // Check if query needs decomposition
    if (!this.needsDecomposition(query)) {
      return {
        originalQuery: query,
        subQueries: [],
        strategy: 'parallel',
      };
    }

    // Try heuristic decomposition first
    const heuristicResult = this.heuristicDecompose(query);
    if (heuristicResult.subQueries.length > 0) {
      console.log('[QueryDecomposer] Heuristic decomposition:', heuristicResult.subQueries);
      return this.limitSubQueries(heuristicResult);
    }

    // Use LLM for sophisticated decomposition
    if (!this.llmCaller) {
      console.warn('[QueryDecomposer] No LLM caller, returning empty decomposition');
      return {
        originalQuery: query,
        subQueries: [],
        strategy: 'parallel',
      };
    }

    try {
      const prompt = DECOMPOSITION_PROMPT_TEMPLATE
        .replace('{{query}}', query)
        .replace('{{maxSubQueries}}', String(this.config.maxSubQueries));

      const llmResult = await this.callLLMWithTimeout(prompt);
      const parsed = this.parseLLMResponse(llmResult);

      console.log('[QueryDecomposer] LLM decomposition:', parsed.subQueries);
      return this.limitSubQueries(parsed);

    } catch (error) {
      console.warn('[QueryDecomposer] LLM decomposition failed:', error);
      return {
        originalQuery: query,
        subQueries: [],
        strategy: 'parallel',
      };
    }
  }

  /**
   * Check if query needs decomposition
   */
  private needsDecomposition(query: string): boolean {
    // Check query length
    if (query.length < 20) {
      return false;
    }

    // Check decomposition patterns
    for (const pattern of Object.values(DECOMPOSITION_PATTERNS)) {
      if (pattern.pattern.test(query)) {
        return true;
      }
    }

    // Check for multiple aspects indicators
    const multiAspectIndicators = ['多个', '各种', '不同', '所有', '全部'];
    return multiAspectIndicators.some(ind => query.includes(ind));
  }

  /**
   * Heuristic decomposition using patterns
   */
  private heuristicDecompose(query: string): DecompositionResult {
    // Try each decomposition pattern
    for (const [name, pattern] of Object.entries(DECOMPOSITION_PATTERNS)) {
      if (pattern.pattern.test(query)) {
        const subQueries = pattern.extract(query);
        if (subQueries.length > 0) {
          console.log(`[QueryDecomposer] Pattern ${name} matched`);
          return {
            originalQuery: query,
            subQueries,
            strategy: pattern.strategy as 'parallel' | 'sequential',
          };
        }
      }
    }

    // No pattern matched
    return {
      originalQuery: query,
      subQueries: [],
      strategy: 'parallel',
    };
  }

  /**
   * Call LLM with timeout
   */
  private async callLLMWithTimeout(prompt: string): Promise<string> {
    if (!this.llmCaller) {
      throw new Error('No LLM caller configured');
    }

    const timeoutMs = this.config.queryDecomposeTimeoutMs;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM decomposition timeout')), timeoutMs);
    });

    return Promise.race([
      this.llmCaller(prompt),
      timeoutPromise,
    ]);
  }

  /**
   * Parse LLM JSON response
   */
  private parseLLMResponse(response: string): DecompositionResult {
    let jsonStr = response.trim();

    // Remove markdown wrapper
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    try {
      const parsed = JSON.parse(jsonStr);

      return {
        originalQuery: '', // Will be set by caller
        subQueries: Array.isArray(parsed.subQueries)
          ? parsed.subQueries.filter((q: string) => q && q.trim().length > 0)
          : [],
        strategy: parsed.strategy === 'sequential' ? 'sequential' : 'parallel',
      };
    } catch (e) {
      console.warn('[QueryDecomposer] Failed to parse LLM response:', jsonStr.slice(0, 100));
      return {
        originalQuery: '',
        subQueries: [],
        strategy: 'parallel',
      };
    }
  }

  /**
   * Limit sub-queries to maxSubQueries
   */
  private limitSubQueries(result: DecompositionResult): DecompositionResult {
    return {
      ...result,
      subQueries: result.subQueries.slice(0, this.config.maxSubQueries),
    };
  }

  /**
   * Get configuration
   */
  getConfig(): EnhancedRetrievalConfig {
    return { ...this.config };
  }

  /**
   * Get max sub-queries limit
   */
  getMaxSubQueries(): number {
    return this.config.maxSubQueries;
  }
}

/**
 * Create query decomposer instance
 */
export function createQueryDecomposer(
  config?: Partial<EnhancedRetrievalConfig>,
  llmCaller?: (prompt: string) => Promise<string>
): QueryDecomposer {
  return new QueryDecomposer(config, llmCaller);
}