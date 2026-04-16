/**
 * Query Analyzer
 *
 * Analyzes query complexity and determines optimization strategy using LLM.
 */

import type {
  QueryAnalysisResult,
  QueryComplexity,
  QueryDSL,
} from './types.js';
import type { EnhancedRetrievalConfig } from './config.js';
import { DEFAULT_ENHANCED_RETRIEVAL_CONFIG } from './config.js';

/**
 * LLM prompt for query analysis
 */
const ANALYSIS_PROMPT_TEMPLATE = `
分析以下用户查询，返回JSON格式结果：

用户查询: "{{query}}"

请判断:
1. 复杂度: simple(单一问题), complex(多维度问题需要分解), structured(包含过滤条件如年份、类别)
2. 是否需要分解为子查询 (复杂问题可能需要多个角度检索)
3. 是否需要重写为专业术语 (口语化表达需要标准化)
4. 检测到的过滤条件(年份、类别等)
5. 建议的子查询(如需分解，最多5个)
6. 重写后的查询(如果需要重写)

返回格式(必须是有效的JSON):
{
  "complexity": "simple|complex|structured",
  "needsDecomposition": true或false,
  "needsRewrite": true或false,
  "detectedFilters": {"year": 2023, "category": "技术文档"} 或 {},
  "suggestedSubQueries": ["子查询1", "子查询2"] 或 [],
  "rewrittenQuery": "重写后的查询" 或 null
}

注意：
- 只返回JSON，不要其他内容
- 不要包含任何解释或注释
- JSON必须可以解析
`;

/**
 * Query Analyzer class
 */
export class QueryAnalyzer {
  private config: EnhancedRetrievalConfig;
  private cache: Map<string, QueryAnalysisResult> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private llmCaller: ((prompt: string) => Promise<string>) | undefined;

  constructor(
    config?: Partial<EnhancedRetrievalConfig>,
    llmCaller?: (prompt: string) => Promise<string>
  ) {
    this.config = { ...DEFAULT_ENHANCED_RETRIEVAL_CONFIG, ...config };
    this.llmCaller = llmCaller ?? undefined;
  }

  /**
   * Set LLM caller function (for dependency injection)
   */
  setLLMCaller(caller: (prompt: string) => Promise<string>): void {
    this.llmCaller = caller;
  }

  /**
   * Analyze query complexity and optimization needs
   */
  async analyze(query: string): Promise<QueryAnalysisResult> {
    // Check cache first
    const cached = this.getCachedResult(query);
    if (cached) {
      console.log('[QueryAnalyzer] Cache hit for query:', query.slice(0, 50));
      return cached;
    }

    // Detect filters without LLM (fast path)
    const detectedFilters = this.detectFilters(query);

    // Simple heuristic for complexity
    const heuristicComplexity = this.heuristicComplexity(query);

    // If heuristic suggests simple and no filters, return early
    if (heuristicComplexity === 'simple' && Object.keys(detectedFilters).length === 0) {
      const result: QueryAnalysisResult = {
        complexity: 'simple',
        needsDecomposition: false,
        needsRewrite: this.needsRewriteHeuristic(query),
        detectedFilters: {},
        analysisTimestamp: Date.now(),
      };
      this.setCachedResult(query, result);
      return result;
    }

    // Use LLM for complex analysis
    if (!this.llmCaller) {
      console.warn('[QueryAnalyzer] No LLM caller configured, using heuristic analysis');
      const result: QueryAnalysisResult = {
        complexity: heuristicComplexity,
        needsDecomposition: heuristicComplexity === 'complex',
        needsRewrite: this.needsRewriteHeuristic(query),
        detectedFilters,
        suggestedSubQueries: heuristicComplexity === 'complex'
          ? this.heuristicSubQueries(query)
          : undefined,
        analysisTimestamp: Date.now(),
      };
      this.setCachedResult(query, result);
      return result;
    }

    try {
      // Call LLM with timeout
      const prompt = ANALYSIS_PROMPT_TEMPLATE.replace('{{query}}', query);
      const llmResult = await this.callLLMWithTimeout(prompt);

      // Parse LLM response
      const parsed = this.parseLLMResponse(llmResult);

      const result: QueryAnalysisResult = {
        complexity: parsed.complexity ?? heuristicComplexity,
        needsDecomposition: parsed.needsDecomposition ?? false,
        needsRewrite: parsed.needsRewrite ?? false,
        detectedFilters: { ...detectedFilters, ...parsed.detectedFilters },
        suggestedSubQueries: parsed.suggestedSubQueries,
        rewrittenQuery: parsed.rewrittenQuery,
        analysisTimestamp: Date.now(),
      };

      this.setCachedResult(query, result);
      console.log('[QueryAnalyzer] LLM analysis complete:', result.complexity);
      return result;

    } catch (error) {
      console.warn('[QueryAnalyzer] LLM analysis failed, using heuristic:', error);
      // Fallback to heuristic
      const result: QueryAnalysisResult = {
        complexity: heuristicComplexity,
        needsDecomposition: heuristicComplexity === 'complex',
        needsRewrite: this.needsRewriteHeuristic(query),
        detectedFilters,
        suggestedSubQueries: heuristicComplexity === 'complex'
          ? this.heuristicSubQueries(query)
          : undefined,
        analysisTimestamp: Date.now(),
      };
      this.setCachedResult(query, result);
      return result;
    }
  }

  /**
   * Call LLM with timeout
   */
  private async callLLMWithTimeout(prompt: string): Promise<string> {
    if (!this.llmCaller) {
      throw new Error('No LLM caller configured');
    }

    const timeoutMs = this.config.queryAnalysisTimeoutMs;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM call timeout')), timeoutMs);
    });

    return Promise.race([
      this.llmCaller(prompt),
      timeoutPromise,
    ]);
  }

  /**
   * Parse LLM JSON response
   */
  private parseLLMResponse(response: string): Partial<QueryAnalysisResult> {
    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = response.trim();

    // Remove markdown code block if present
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

      // Validate complexity value
      const complexity: QueryComplexity =
        ['simple', 'complex', 'structured'].includes(parsed.complexity)
          ? parsed.complexity
          : 'simple';

      return {
        complexity,
        needsDecomposition: Boolean(parsed.needsDecomposition),
        needsRewrite: Boolean(parsed.needsRewrite),
        detectedFilters: parsed.detectedFilters || {},
        suggestedSubQueries: Array.isArray(parsed.suggestedSubQueries)
          ? parsed.suggestedSubQueries.slice(0, this.config.maxSubQueries)
          : undefined,
        rewrittenQuery: parsed.rewrittenQuery || undefined,
      };
    } catch (e) {
      console.warn('[QueryAnalyzer] Failed to parse LLM response:', jsonStr.slice(0, 100));
      return {};
    }
  }

  /**
   * Detect filters from query text (without LLM)
   */
  private detectFilters(query: string): Record<string, string | number> {
    const filters: Record<string, string | number> = {};

    // Year detection
    const yearMatch = query.match(/\b(20[0-2][0-9])\b/);
    if (yearMatch) {
      filters.year = parseInt(yearMatch[1]!, 10);
    }

    // Month detection
    const monthMatch = query.match(/(\d+)月|月份|month\s*(\d+)/i);
    if (monthMatch) {
      const month = parseInt(monthMatch[1] || monthMatch[2]!, 10);
      if (month >= 1 && month <= 12) {
        filters.month = month;
      }
    }

    // Category keywords detection
    const categoryKeywords: Record<string, string> = {
      '技术': '技术文档',
      '产品': '产品文档',
      '用户': '用户手册',
      '开发': '开发文档',
      '测试': '测试文档',
      '部署': '部署文档',
      '配置': '配置文档',
    };

    for (const [keyword, category] of Object.entries(categoryKeywords)) {
      if (query.includes(keyword)) {
        filters.category = category;
        break;
      }
    }

    // Document type detection
    if (query.includes('PDF') || query.includes('pdf')) {
      filters.documentType = 'PDF';
    }
    if (query.includes('Word') || query.includes('word') || query.includes('文档')) {
      filters.documentType = 'Word';
    }

    return filters;
  }

  /**
   * Heuristic complexity detection
   */
  private heuristicComplexity(query: string): QueryComplexity {
    // Structured query indicators
    if (/\d{4}年|\d+月|第\d+章|第\d+节/.test(query)) {
      return 'structured';
    }

    // Complex query indicators
    const complexIndicators = [
      '对比', '比较', '区别', '优缺点', '异同',
      '同时', '并且', '以及', '和', '还有',
      '怎么', '如何', '为什么', '原因',
      '多个', '各种', '不同', '所有',
    ];

    const hasComplexIndicator = complexIndicators.some(ind => query.includes(ind));
    const hasMultipleQuestions = (query.match(/[?？]/g) || []).length > 1;
    const isLongQuery = query.length > 50;

    if (hasComplexIndicator || hasMultipleQuestions || isLongQuery) {
      return 'complex';
    }

    return 'simple';
  }

  /**
   * Heuristic for rewrite need
   */
  private needsRewriteHeuristic(query: string): boolean {
    // Colloquial expressions that may need rewriting
    const colloquialPatterns = [
      '怎么让', '怎么搞', '咋', '咋整',
      '跑得快', '跑不动', '太慢', '太卡',
      '搞不定', '弄不了', '搞不懂',
      '更牛', '更强', '更好', '更厉害',
      '啥', '什么鬼', '怎么回事',
    ];

    return colloquialPatterns.some(p => query.includes(p));
  }

  /**
   * Heuristic sub-queries generation
   */
  private heuristicSubQueries(query: string): string[] {
    const subQueries: string[] = [];

    // Split by comparison keywords
    if (query.includes('对比') || query.includes('比较')) {
      const parts = query.split(/对比|比较|和|与/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length > 5 && trimmed.length < 100) {
          subQueries.push(trimmed);
        }
      }
    }

    // Extract question-like segments
    const questionPattern = /[^?？]+[?？]/g;
    const questions = query.match(questionPattern);
    if (questions) {
      for (const q of questions) {
        const trimmed = q.trim();
        if (trimmed.length > 5) {
          subQueries.push(trimmed);
        }
      }
    }

    return subQueries.slice(0, this.config.maxSubQueries);
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(query: string): QueryAnalysisResult | null {
    const cached = this.cache.get(query);
    const timestamp = this.cacheTimestamps.get(query);

    if (!cached || !timestamp) {
      return null;
    }

    const ttl = this.config.analysisCacheTTL;
    if (Date.now() - timestamp > ttl) {
      this.cache.delete(query);
      this.cacheTimestamps.delete(query);
      return null;
    }

    return cached;
  }

  /**
   * Set cached result
   */
  private setCachedResult(query: string, result: QueryAnalysisResult): void {
    this.cache.set(query, result);
    this.cacheTimestamps.set(query, Date.now());
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.config.analysisCacheTTL,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): EnhancedRetrievalConfig {
    return { ...this.config };
  }
}

/**
 * Create query analyzer instance
 */
export function createQueryAnalyzer(
  config?: Partial<EnhancedRetrievalConfig>,
  llmCaller?: (prompt: string) => Promise<string>
): QueryAnalyzer {
  return new QueryAnalyzer(config, llmCaller);
}