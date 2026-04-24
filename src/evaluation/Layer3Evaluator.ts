/**
 * Layer3Evaluator - Layer 3 LLM 评估器
 *
 * 使用 LLM 批量评估 Evidence Traceability、Completeness、Terminology Accuracy
 */

import type { EvaluationResult } from '../tracing/types.js';
import type { LLMCaller } from '../config/llm-config.js';

/**
 * Layer3Response - LLM 返回结构
 *
 * 任务 5.4.1: 定义 Layer3Response TypeScript 类型
 */
export interface Layer3Response {
  evidenceTraceability: {
    score: number;
    unsupportedClaims: string[];
    hallucinationRisk: boolean;
    reasoning: string;
  };
  completeness: {
    score: number;
    missingElements: string[];
    coveragePercentage: number;
    reasoning: string;
  };
  terminologyAccuracy: {
    score: number;
    incorrectTerms: string[];
    suggestedCorrections: string[];
    reasoning: string;
  };
}

/**
 * TriggerAnalysis - 条件触发分析
 *
 * 任务 5.3.5: 实现 TriggerAnalysis 类型
 */
export interface TriggerAnalysis {
  shouldTriggerLLM: boolean;
  triggers: {
    faithfulness: boolean;
    multiEntity: boolean;
    terminology: boolean;
  };
  reasons: string[];
}

/**
 * Layer3SystemResult - Layer 3 系统结果
 */
export interface Layer3SystemResult {
  metrics: {
    evidenceTraceability: { score: number; details: Record<string, unknown> };
    completeness: { score: number; details: Record<string, unknown> };
    terminologyAccuracy: { score: number; details: Record<string, unknown> };
  };
  triggeredBy: TriggerAnalysis;
  llmUsed: boolean;
  fallbackUsed: boolean;
}

/**
 * Layer3Evaluator - Layer 3 评估器
 *
 * 任务 5.1.1: 创建 src/evaluation/Layer3Evaluator.ts
 */
export class Layer3Evaluator {
  private llmCaller: LLMCaller;
  private useConditionalTrigger: boolean;

  constructor(llmCaller: LLMCaller, options?: { useConditionalTrigger?: boolean }) {
    this.llmCaller = llmCaller;
    this.useConditionalTrigger = options?.useConditionalTrigger ?? true;
  }

  /**
   * 执行 Layer 3 评估
   *
   * 任务 5.1.2: 实现 evaluate() 方法
   */
  async evaluate(
    query: string,
    answer: string,
    chunks: string[],
    existingMetrics: {
      faithfulness?: number;
      entitiesCount?: number;
    }
  ): Promise<Layer3SystemResult> {
    // Analyze triggers
    const triggerAnalysis = this.analyzeTriggers(existingMetrics);

    // Determine if LLM should be used
    const useLLM = !this.useConditionalTrigger || triggerAnalysis.shouldTriggerLLM;

    let response: Layer3Response;
    let llmUsed = false;
    let fallbackUsed = false;

    if (useLLM) {
      try {
        // 任务 5.1.3: 实现 buildBatchPrompt() 方法
        const prompt = this.buildBatchPrompt(query, answer, chunks);

        // Call LLM
        const rawResponse = await this.llmCaller(prompt);

        // 任务 5.1.4: 实现 parseResponse() 方法
        response = this.parseResponse(rawResponse);
        llmUsed = true;
      } catch (error) {
        console.warn('[Layer3Evaluator] LLM call failed, using fallback:', error);
        // 任务 5.1.5: 实现 fallbackToRules() 方法
        response = this.fallbackToRules(query, answer, chunks);
        fallbackUsed = true;
      }
    } else {
      // Use rules-based evaluation
      response = this.fallbackToRules(query, answer, chunks);
    }

    // Build result
    return {
      metrics: {
        evidenceTraceability: {
          score: response.evidenceTraceability.score,
          details: {
            unsupportedClaims: response.evidenceTraceability.unsupportedClaims,
            hallucinationRisk: response.evidenceTraceability.hallucinationRisk,
            reasoning: response.evidenceTraceability.reasoning,
          },
        },
        completeness: {
          score: response.completeness.score,
          details: {
            missingElements: response.completeness.missingElements,
            coveragePercentage: response.completeness.coveragePercentage,
            reasoning: response.completeness.reasoning,
          },
        },
        terminologyAccuracy: {
          score: response.terminologyAccuracy.score,
          details: {
            incorrectTerms: response.terminologyAccuracy.incorrectTerms,
            suggestedCorrections: response.terminologyAccuracy.suggestedCorrections,
            reasoning: response.terminologyAccuracy.reasoning,
          },
        },
      },
      triggeredBy: triggerAnalysis,
      llmUsed,
      fallbackUsed,
    };
  }

  /**
   * 构建批量 Prompt
   *
   * 任务 5.1.3: 实现 buildBatchPrompt() 方法
   * 任务 5.2.1-5.2.4: Prompt 设计
   */
  private buildBatchPrompt(query: string, answer: string, chunks: string[]): string {
    // Truncate for token limit
    const truncatedAnswer = answer.length > 2000 ? answer.slice(0, 2000) + '...' : answer;
    const truncatedChunks = chunks.map(c => c.length > 500 ? c.slice(0, 500) + '...' : c).slice(0, 5);

    return `你是一个医学问答评估专家。请对以下问答进行 Layer 3 评估，输出 JSON 格式结果。

## 输入

**用户问题**: ${query}

**系统回答**: ${truncatedAnswer}

**检索到的证据片段**:
${truncatedChunks.map((c, i) => `[${i + 1}] ${c}`).join('\n')}

## 评估任务

请同时评估以下三个指标：

### 1. Evidence Traceability (证据溯源)
- 判断回答中的每个关键声明是否有证据片段支持
- 识别无支持的声明（幻觉风险）
- 分数: 0-1，1 表示所有声明都有证据支持

### 2. Completeness (完整性)
- 评估回答是否完整覆盖了问题的各个方面
- 识别缺失的关键要素
- 分数: 0-1，1 表示完全覆盖

### 3. Terminology Accuracy (术语准确性)
- 检查医学术语使用是否准确
- 识别错误术语并建议修正
- 分数: 0-1，1 表示术语全部正确

## 输出格式

请输出以下 JSON 格式（不要包含其他文本）：

\`\`\`json
{
  "evidenceTraceability": {
    "score": 0.85,
    "unsupportedClaims": ["声明1", "声明2"],
    "hallucinationRisk": false,
    "reasoning": "简要说明"
  },
  "completeness": {
    "score": 0.9,
    "missingElements": ["缺失要素1"],
    "coveragePercentage": 90,
    "reasoning": "简要说明"
  },
  "terminologyAccuracy": {
    "score": 0.95,
    "incorrectTerms": [],
    "suggestedCorrections": [],
    "reasoning": "简要说明"
  }
}
\`\`\`

请直接输出 JSON，不要包含任何其他文本。`;
  }

  /**
   * 解析 LLM 响应
   *
   * 任务 5.1.4: 实现 parseResponse() 方法
   * 任务 5.4.2-5.4.4: Schema 验证和 fallback
   */
  private parseResponse(rawResponse: string): Layer3Response {
    // 任务 5.4.3: JSON 解析 fallback 逻辑
    try {
      // Extract JSON from response (handle potential wrapping text)
      let jsonStr = rawResponse;

      // Try to find JSON block
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      // 任务 5.4.2: Schema 验证
      const validated = this.validateResponse(parsed);

      return validated;
    } catch (error) {
      console.warn('[Layer3Evaluator] JSON parse failed:', error);
      // 任务 5.4.4: 处理部分解析情况
      throw new Error('Failed to parse LLM response as JSON');
    }
  }

  /**
   * 验证响应 Schema
   *
   * 任务 5.4.2: 实现 schema 验证逻辑
   */
  private validateResponse(parsed: unknown): Layer3Response {
    // Basic structure validation
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Response is not an object');
    }

    const obj = parsed as Record<string, unknown>;

    // Validate each metric exists and has required fields
    const metrics = ['evidenceTraceability', 'completeness', 'terminologyAccuracy'];

    for (const metric of metrics) {
      if (!obj[metric] || typeof obj[metric] !== 'object') {
        throw new Error(`Missing or invalid ${metric}`);
      }

      const metricObj = obj[metric] as Record<string, unknown>;

      if (typeof metricObj.score !== 'number' || metricObj.score < 0 || metricObj.score > 1) {
        // Clamp score to valid range
        metricObj.score = Math.max(0, Math.min(1, Number(metricObj.score) || 0.5));
      }

      if (!metricObj.reasoning || typeof metricObj.reasoning !== 'string') {
        metricObj.reasoning = 'No reasoning provided';
      }
    }

    // Build validated response
    return {
      evidenceTraceability: {
        score: (obj.evidenceTraceability as Record<string, unknown>).score as number,
        unsupportedClaims: Array.isArray((obj.evidenceTraceability as Record<string, unknown>).unsupportedClaims)
          ? (obj.evidenceTraceability as Record<string, unknown>).unsupportedClaims as string[]
          : [],
        hallucinationRisk: Boolean((obj.evidenceTraceability as Record<string, unknown>).hallucinationRisk),
        reasoning: String((obj.evidenceTraceability as Record<string, unknown>).reasoning ?? ''),
      },
      completeness: {
        score: (obj.completeness as Record<string, unknown>).score as number,
        missingElements: Array.isArray((obj.completeness as Record<string, unknown>).missingElements)
          ? (obj.completeness as Record<string, unknown>).missingElements as string[]
          : [],
        coveragePercentage: Number((obj.completeness as Record<string, unknown>).coveragePercentage) || 0,
        reasoning: String((obj.completeness as Record<string, unknown>).reasoning ?? ''),
      },
      terminologyAccuracy: {
        score: (obj.terminologyAccuracy as Record<string, unknown>).score as number,
        incorrectTerms: Array.isArray((obj.terminologyAccuracy as Record<string, unknown>).incorrectTerms)
          ? (obj.terminologyAccuracy as Record<string, unknown>).incorrectTerms as string[]
          : [],
        suggestedCorrections: Array.isArray((obj.terminologyAccuracy as Record<string, unknown>).suggestedCorrections)
          ? (obj.terminologyAccuracy as Record<string, unknown>).suggestedCorrections as string[]
          : [],
        reasoning: String((obj.terminologyAccuracy as Record<string, unknown>).reasoning ?? ''),
      },
    };
  }

  /**
   * Fallback 到规则评估
   *
   * 任务 5.1.5: 实现 fallbackToRules() 方法
   */
  private fallbackToRules(query: string, answer: string, chunks: string[]): Layer3Response {
    // Simple rules-based evaluation

    // Evidence Traceability: Check if answer mentions content from chunks
    const chunkContent = chunks.join(' ').toLowerCase();
    const answerWords = answer.toLowerCase().split(/\s+/);
    const supportedWords = answerWords.filter(w => chunkContent.includes(w));
    const evidenceScore = Math.min(1, supportedWords.length / Math.max(1, answerWords.length * 0.3));

    // Completeness: Based on answer length relative to query complexity
    const queryComplexity = query.split(/\s+/).length;
    const expectedLength = queryComplexity * 10; // Heuristic
    const completenessScore = Math.min(1, answer.length / Math.max(1, expectedLength));

    // Terminology: Assume good if answer contains medical terms correctly
    const terminologyScore = 0.8; // Default score for rules

    return {
      evidenceTraceability: {
        score: evidenceScore,
        unsupportedClaims: [],
        hallucinationRisk: evidenceScore < 0.5,
        reasoning: 'Rules-based fallback: estimated from chunk coverage',
      },
      completeness: {
        score: completenessScore,
        missingElements: [],
        coveragePercentage: Math.round(completenessScore * 100),
        reasoning: 'Rules-based fallback: estimated from answer length',
      },
      terminologyAccuracy: {
        score: terminologyScore,
        incorrectTerms: [],
        suggestedCorrections: [],
        reasoning: 'Rules-based fallback: default score',
      },
    };
  }

  /**
   * 分析触发条件
   *
   * 任务 5.3.1: 实现 analyzeTriggers() 方法
   */
  private analyzeTriggers(metrics: {
    faithfulness?: number;
    entitiesCount?: number;
  }): TriggerAnalysis {
    const triggers = {
      faithfulness: false,
      multiEntity: false,
      terminology: false,
    };
    const reasons: string[] = [];

    // 任务 5.3.2: faithfulness 触发条件
    if (metrics.faithfulness !== undefined && metrics.faithfulness < 0.7) {
      triggers.faithfulness = true;
      reasons.push(`Faithfulness ${metrics.faithfulness} < 0.7, 需要详细证据溯源`);
    }

    // 任务 5.3.3: multi-entity 触发条件
    if (metrics.entitiesCount !== undefined && metrics.entitiesCount > 1) {
      triggers.multiEntity = true;
      reasons.push(`检测到 ${metrics.entitiesCount} 个实体，需要完整性检查`);
    }

    // 任务 5.3.4: terminology 触发条件
    // This would require term detection, simplified here
    // In production, would use medical term dictionary

    const shouldTriggerLLM = triggers.faithfulness || triggers.multiEntity;

    return {
      shouldTriggerLLM,
      triggers,
      reasons,
    };
  }
}

/**
 * 创建 Layer3Evaluator
 */
export function createLayer3Evaluator(
  llmCaller: LLMCaller,
  options?: { useConditionalTrigger?: boolean }
): Layer3Evaluator {
  return new Layer3Evaluator(llmCaller, options);
}