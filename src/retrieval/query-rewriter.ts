/**
 * Query Rewriter
 *
 * Rewrites colloquial queries to professional terminology using LLM.
 */

import type { EnhancedRetrievalConfig } from './config.js';
import { DEFAULT_ENHANCED_RETRIEVAL_CONFIG } from './config.js';

/**
 * Rewrite prompt template
 */
const REWRITE_PROMPT_TEMPLATE = `
将以下口语化查询重写为专业术语表达，保持语义不变：

用户查询: "{{query}}"

重写要求：
- 使用专业术语和标准表达
- 语义明确，便于文档检索
- 保持原意，不要添加额外信息
- 输出简洁，只有一个重写版本

只输出重写后的查询，不要包含任何解释或说明。
`;

/**
 * Professional term mappings (for heuristic fallback)
 */
const PROFESSIONAL_TERMS: Record<string, string> = {
  '跑得快': '高性能',
  '跑不动': '性能问题',
  '太慢': '响应延迟',
  '太卡': '响应延迟',
  '怎么让': '如何实现',
  '怎么搞': '如何实现',
  '搞不定': '问题解决',
  '弄不了': '问题解决',
  '更牛': '更优',
  '更强': '更优',
  '更好': '优化',
  '啥': '什么',
  '咋': '如何',
};

/**
 * Query Rewriter class
 */
export class QueryRewriter {
  private config: EnhancedRetrievalConfig;
  private llmCaller: ((prompt: string) => Promise<string>) | undefined;
  private rewriteCache: Map<string, string> = new Map();

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
   * Rewrite query to professional terminology
   */
  async rewrite(query: string): Promise<string> {
    // Check cache
    const cached = this.rewriteCache.get(query);
    if (cached) {
      console.log('[QueryRewriter] Cache hit for query:', query.slice(0, 50));
      return cached;
    }

    // Fast heuristic rewrite for common patterns
    const heuristicResult = this.heuristicRewrite(query);
    if (heuristicResult !== query) {
      console.log('[QueryRewriter] Heuristic rewrite:', query, '→', heuristicResult);
      this.rewriteCache.set(query, heuristicResult);
      return heuristicResult;
    }

    // Use LLM for more sophisticated rewriting
    if (!this.llmCaller) {
      console.warn('[QueryRewriter] No LLM caller, returning original query');
      return query;
    }

    try {
      const prompt = REWRITE_PROMPT_TEMPLATE.replace('{{query}}', query);
      const rewritten = await this.callLLMWithTimeout(prompt);

      // Clean up response
      const cleaned = this.cleanRewriteResponse(rewritten, query);

      console.log('[QueryRewriter] LLM rewrite:', query, '→', cleaned);
      this.rewriteCache.set(query, cleaned);
      return cleaned;

    } catch (error) {
      console.warn('[QueryRewriter] LLM rewrite failed:', error);
      // Return original if LLM fails
      return query;
    }
  }

  /**
   * Call LLM with timeout
   */
  private async callLLMWithTimeout(prompt: string): Promise<string> {
    if (!this.llmCaller) {
      throw new Error('No LLM caller configured');
    }

    const timeoutMs = this.config.queryRewriteTimeoutMs;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM rewrite timeout')), timeoutMs);
    });

    return Promise.race([
      this.llmCaller(prompt),
      timeoutPromise,
    ]);
  }

  /**
   * Clean up LLM rewrite response
   */
  private cleanRewriteResponse(response: string, originalQuery: string): string {
    // Remove any explanations or quotes
    let cleaned = response.trim();

    // Remove "重写后的查询:" prefix if present
    cleaned = cleaned.replace(/^重写后的查询[：:]\s*/i, '');

    // Remove surrounding quotes
    cleaned = cleaned.replace(/^["'「」『』]|["'「」『』]$/g, '');

    // If result is empty or too different, return original
    if (cleaned.length < 3 || cleaned.length > originalQuery.length * 3) {
      return originalQuery;
    }

    return cleaned;
  }

  /**
   * Heuristic rewrite using term mappings
   */
  private heuristicRewrite(query: string): string {
    let rewritten = query;

    for (const [colloquial, professional] of Object.entries(PROFESSIONAL_TERMS)) {
      if (rewritten.includes(colloquial)) {
        rewritten = rewritten.replace(colloquial, professional);
      }
    }

    return rewritten;
  }

  /**
   * Batch rewrite multiple queries
   */
  async batchRewrite(queries: string[]): Promise<string[]> {
    return Promise.all(queries.map(q => this.rewrite(q)));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.rewriteCache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number } {
    return { size: this.rewriteCache.size };
  }

  /**
   * Get configuration
   */
  getConfig(): EnhancedRetrievalConfig {
    return { ...this.config };
  }
}

/**
 * Create query rewriter instance
 */
export function createQueryRewriter(
  config?: Partial<EnhancedRetrievalConfig>,
  llmCaller?: (prompt: string) => Promise<string>
): QueryRewriter {
  return new QueryRewriter(config, llmCaller);
}