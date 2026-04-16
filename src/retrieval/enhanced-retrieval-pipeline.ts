/**
 * Enhanced Retrieval Pipeline
 *
 * Orchestrates all stages: Analyzer → Rewriter → Decomposer → Expander → Retriever → Reranker → Assembler
 */

import type {
  QueryAnalysisResult,
  QueryOptimizationOutput,
  ConfidenceRetrievalResult,
  EnhancedAssembledContext,
  NoMatchResult,
} from './types.js';
import type { EnhancedRetrievalConfig, TopKResult } from './config.js';
import { DEFAULT_ENHANCED_RETRIEVAL_CONFIG, mergeEnhancedRetrievalConfig } from './config.js';

import { QueryAnalyzer, createQueryAnalyzer } from './query-analyzer.js';
import { QueryRewriter, createQueryRewriter } from './query-rewriter.js';
import { QueryDecomposer, createQueryDecomposer } from './query-decomposer.js';
import { QueryExpander, createQueryExpander } from './query-expander.js';
import { DynamicTopKCalculator, createDynamicTopKCalculator } from './dynamic-topk-calculator.js';
import { HybridReranker, createHybridReranker } from './hybrid-reranker.js';
import { LowConfidenceHandler, createLowConfidenceHandler } from './low-confidence-handler.js';
import { EnhancedContextAssembler, createEnhancedContextAssembler } from './enhanced-context-assembler.js';

import type { SmallToBigRetriever } from '../chunking/small-to-big-retriever.js';
import type { HierarchicalStore } from '../chunking/hierarchical-store.js';

/**
 * LLM caller function type
 */
type LLMCaller = (prompt: string) => Promise<string>;

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  success: boolean;
  query: string;
  analysis?: QueryAnalysisResult;
  optimization?: QueryOptimizationOutput;
  topKConfig?: TopKResult;
  results?: ConfidenceRetrievalResult[];
  context?: EnhancedAssembledContext;
  noMatch?: NoMatchResult;
  stats?: PipelineStats;
  error?: string;
}

/**
 * Pipeline execution statistics
 */
export interface PipelineStats {
  analysisTime: number;
  retrievalTime: number;
  rerankingTime: number;
  assemblyTime: number;
  totalTime: number;
  method: 'local-reranker' | 'internal-confidence';
}

/**
 * Enhanced Retrieval Pipeline class
 */
export class EnhancedRetrievalPipeline {
  private config: EnhancedRetrievalConfig;

  // Pipeline components
  private analyzer: QueryAnalyzer;
  private rewriter: QueryRewriter;
  private decomposer: QueryDecomposer;
  private expander: QueryExpander;
  private topKCalculator: DynamicTopKCalculator;
  private reranker: HybridReranker;
  private lowConfidenceHandler: LowConfidenceHandler;
  private assembler: EnhancedContextAssembler;

  // External dependencies
  private retriever?: SmallToBigRetriever;
  private store?: HierarchicalStore;
  private llmCaller: LLMCaller | undefined;

  constructor(
    config?: Partial<EnhancedRetrievalConfig>,
    llmCaller?: LLMCaller
  ) {
    this.config = mergeEnhancedRetrievalConfig(config);
    this.llmCaller = llmCaller ?? undefined;

    // Initialize all pipeline components
    this.analyzer = createQueryAnalyzer(this.config, llmCaller ?? undefined);
    this.rewriter = createQueryRewriter(this.config, llmCaller ?? undefined);
    this.decomposer = createQueryDecomposer(this.config, llmCaller ?? undefined);
    this.expander = createQueryExpander(this.config);
    this.topKCalculator = createDynamicTopKCalculator(this.config);
    this.reranker = createHybridReranker(this.config);
    this.lowConfidenceHandler = createLowConfidenceHandler(this.config);
    this.assembler = createEnhancedContextAssembler(this.config);
  }

  /**
   * Set retriever dependency
   */
  setRetriever(retriever: SmallToBigRetriever): void {
    this.retriever = retriever;
  }

  /**
   * Set store dependency
   */
  setStore(store: HierarchicalStore): void {
    this.store = store;
  }

  /**
   * Set LLM caller for query optimization
   */
  setLLMCaller(caller: LLMCaller): void {
    this.llmCaller = caller;
    this.analyzer.setLLMCaller(caller);
    this.rewriter.setLLMCaller(caller);
    this.decomposer.setLLMCaller(caller);
  }

  /**
   * Initialize pipeline (async setup)
   */
  async initialize(): Promise<void> {
    console.log('[EnhancedPipeline] Initializing...');

    // Initialize reranker (may need to load model)
    await this.reranker.initialize();

    // Ensure expander is loaded
    await this.expander.expandWithOriginal(''); // Trigger loading

    console.log('[EnhancedPipeline] Ready');
  }

  /**
   * Execute full pipeline
   */
  async execute(query: string): Promise<PipelineResult> {
    const startTime = Date.now();
    const stats: Partial<PipelineStats> = {};

    console.log('[EnhancedPipeline] Executing for query:', query);

    try {
      // === Stage 1: Query Analysis ===
      const analysisStart = Date.now();
      const analysis = await this.analyze(query);
      stats.analysisTime = Date.now() - analysisStart;

      // === Stage 2: Query Optimization ===
      const optimization = await this.optimize(query, analysis);

      // === Stage 3: Multi-Query Retrieval ===
      if (!this.retriever) {
        return this.errorResult(query, 'Retriever not configured');
      }

      const retrievalStart = Date.now();
      const queries = this.buildQueries(query, optimization);

      // Get dynamic topK
      const avgParentTokens = this.store?.getAvgParentTokenLength() ?? 800;
      const topKConfig = this.topKCalculator.calculate(avgParentTokens);

      // Execute retrieval
      const rawResults = await this.retriever.retrieveMultiQueryWithConfidence(queries, {
        topK: topKConfig.coarseTopK,
        mergeStrategy: 'weighted',
      });

      stats.retrievalTime = Date.now() - retrievalStart;

      // === Stage 4: Confidence Check ===
      const noMatch = this.lowConfidenceHandler.check(rawResults);
      if (noMatch) {
        console.log('[EnhancedPipeline] Low confidence detected');
        stats.totalTime = Date.now() - startTime;
        return {
          success: false,
          query,
          analysis,
          optimization,
          topKConfig,
          noMatch,
          stats: stats as PipelineStats,
        };
      }

      // === Stage 5: Reranking ===
      const rerankingStart = Date.now();
      const rerankOutput = await this.reranker.rerank(query, rawResults);
      const rankedResults = rerankOutput.results;
      stats.rerankingTime = Date.now() - rerankingStart;

      // === Stage 6: Context Assembly ===
      const assemblyStart = Date.now();
      const context = this.assembler.assemble(rankedResults, topKConfig);
      stats.assemblyTime = Date.now() - assemblyStart;

      stats.totalTime = Date.now() - startTime;
      stats.method = rerankOutput.method;

      console.log('[EnhancedPipeline] Complete:', stats.totalTime, 'ms');

      return {
        success: true,
        query,
        analysis,
        optimization,
        topKConfig,
        results: rankedResults,
        context,
        stats: stats as PipelineStats,
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('[EnhancedPipeline] Error:', error);

      return this.errorResult(query, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Stage 1: Analyze query
   */
  private async analyze(query: string): Promise<QueryAnalysisResult> {
    return this.analyzer.analyze(query);
  }

  /**
   * Stage 2: Optimize query (rewrite, decompose, expand)
   */
  private async optimize(
    query: string,
    analysis: QueryAnalysisResult
  ): Promise<QueryOptimizationOutput> {
    const output: QueryOptimizationOutput = {
      originalQuery: query,
      expandedTerms: [],
      complexity: analysis.complexity,
      detectedFilters: analysis.detectedFilters ?? {},
    };

    // Rewrite if needed
    if (analysis.needsRewrite && this.config.enableRewrite) {
      output.rewrittenQuery = await this.rewriter.rewrite(query);
    }

    // Decompose if needed
    if (analysis.needsDecomposition && this.config.enableDecomposition) {
      const decomposition = await this.decomposer.decompose(output.rewrittenQuery || query);
      output.subQueries = decomposition.subQueries;
    }

    // Expand if enabled
    if (this.config.enableExpansion) {
      output.expandedTerms = await this.expander.expand(output.rewrittenQuery || query);
    }

    return output;
  }

  /**
   * Build queries for multi-query retrieval
   */
  private buildQueries(
    original: string,
    optimization: QueryOptimizationOutput
  ): string[] {
    const queries: string[] = [];

    // Always include original
    queries.push(original);

    // Include rewritten if available
    if (optimization.rewrittenQuery && optimization.rewrittenQuery !== original) {
      queries.push(optimization.rewrittenQuery);
    }

    // Include sub-queries
    const subQueries = optimization.subQueries;
    if (subQueries && subQueries.length > 0) {
      for (const sq of subQueries) {
        queries.push(sq);
      }
    }

    // Include expanded terms (as queries)
    if (optimization.expandedTerms.length > 0) {
      queries.push(...optimization.expandedTerms.slice(0, 3));
    }

    console.log('[EnhancedPipeline] Built', queries.length, 'queries');

    return queries;
  }

  /**
   * Create error result
   */
  private errorResult(query: string, error: string): PipelineResult {
    return {
      success: false,
      query,
      error,
      stats: {
        analysisTime: 0,
        retrievalTime: 0,
        rerankingTime: 0,
        assemblyTime: 0,
        totalTime: 0,
        method: 'internal-confidence',
      },
    };
  }

  /**
   * Get pipeline status
   */
  getStatus(): {
    initialized: boolean;
    rerankerReady: boolean;
    config: EnhancedRetrievalConfig;
  } {
    return {
      initialized: true,
      rerankerReady: this.reranker.isLocalRerankerAvailable(),
      config: { ...this.config },
    };
  }

  /**
   * Shutdown pipeline
   */
  async shutdown(): Promise<void> {
    console.log('[EnhancedPipeline] Shutting down');
    await this.reranker.shutdown();
    this.analyzer.clearCache();
    this.rewriter.clearCache();
    this.expander.clearCache();
  }

  /**
   * Get configuration
   */
  getConfig(): EnhancedRetrievalConfig {
    return { ...this.config };
  }
}

/**
 * Create enhanced retrieval pipeline instance
 */
export function createEnhancedRetrievalPipeline(
  config?: Partial<EnhancedRetrievalConfig>,
  llmCaller?: LLMCaller
): EnhancedRetrievalPipeline {
  return new EnhancedRetrievalPipeline(config, llmCaller);
}