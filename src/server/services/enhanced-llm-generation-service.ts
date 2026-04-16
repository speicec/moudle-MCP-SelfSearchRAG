/**
 * Enhanced LLM Generation Service
 *
 * Generates answers with confidence-aware prompts.
 */

import type { ContextWithConfidence } from '../../retrieval/types.js';

/**
 * Confidence prompt template
 */
const CONFIDENCE_PROMPT_TEMPLATE = `
用户问题: {{query}}

参考资料（按置信度排序）:

{{contextSections}}

回答指南:
• 高置信度资料（标注为"高置信度"）：可直接引用，标注来源页码
• 中置信度资料（标注为"中置信度"）：谨慎总结，说明"根据相关资料..."
• 低置信度资料（标注为"低置信度"）：仅供参考，谨慎使用
• 如果参考资料无法回答问题，请直接说明"根据现有资料无法回答此问题"
• 不要编造或推测信息
• 回答应当准确、简洁、有条理
`;

/**
 * Context section template
 */
const CONTEXT_SECTION_TEMPLATE = `
[置信度: {{confidenceLabel}}] [来源: {{source}}{{pageInfo}}]
{{content}}
`;

/**
 * Enhanced LLM Generation Service class
 */
export class EnhancedLLMGenerationService {
  /**
   * Construct prompt with confidence metadata
   */
  constructPromptWithConfidence(
    query: string,
    context: ContextWithConfidence[]
  ): string {
    const contextSections = this.buildContextSections(context);

    const prompt = CONFIDENCE_PROMPT_TEMPLATE
      .replace('{{query}}', query)
      .replace('{{contextSections}}', contextSections);

    return prompt;
  }

  /**
   * Build context sections from chunks
   */
  private buildContextSections(context: ContextWithConfidence[]): string {
    if (context.length === 0) {
      return '无相关参考资料';
    }

    const sections = context.map(chunk => {
      const confidenceLabel = this.getConfidenceLabel(chunk.confidenceLevel);
      const pageInfo = chunk.page ? ` 第${chunk.page}页` : '';
      const source = chunk.source || '未知来源';

      return CONTEXT_SECTION_TEMPLATE
        .replace('{{confidenceLabel}}', confidenceLabel)
        .replace('{{source}}', source)
        .replace('{{pageInfo}}', pageInfo)
        .replace('{{content}}', chunk.content);
    });

    return sections.join('\n\n---\n\n');
  }

  /**
   * Get confidence label in Chinese
   */
  private getConfidenceLabel(level: 'high' | 'medium' | 'low'): string {
    switch (level) {
      case 'high': return '高置信度';
      case 'medium': return '中置信度';
      case 'low': return '低置信度';
    }
  }

  /**
   * Build simplified prompt (without confidence metadata)
   */
  buildSimplePrompt(query: string, contextText: string): string {
    return `用户问题: ${query}

参考资料:
${contextText}

请基于参考资料回答用户问题。如果参考资料中没有相关信息，请说明无法回答。`;
  }

  /**
   * Get prompt statistics
   */
  getPromptStats(prompt: string): {
    length: number;
    estimatedTokens: number;
    queryLength: number;
    contextLength: number;
  } {
    // Extract query and context sections
    const queryMatch = prompt.match(/用户问题: ([^\n]+)/);
    const queryText = queryMatch?.[1] ?? '';

    // Approximate context section length
    const contextStart = prompt.indexOf('参考资料');
    const contextText = contextStart > -1 ? prompt.slice(contextStart) : '';

    return {
      length: prompt.length,
      estimatedTokens: Math.ceil(prompt.length / 4),
      queryLength: queryText.length,
      contextLength: contextText.length,
    };
  }

  /**
   * Create summary of context sources
   */
  createSourceSummary(context: ContextWithConfidence[]): string {
    const sources = context.map(c => {
      const level = this.getConfidenceLabel(c.confidenceLevel);
      const page = c.page ? `第${c.page}页` : '';
      return `${c.source} (${level}) ${page}`;
    });

    return sources.join(', ');
  }

  /**
   * Validate prompt for LLM generation
   */
  validatePrompt(prompt: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!prompt.includes('用户问题:')) {
      errors.push('Prompt missing user question');
    }

    if (!prompt.includes('参考资料')) {
      errors.push('Prompt missing reference material section');
    }

    if (!prompt.includes('回答指南')) {
      errors.push('Prompt missing answer guidelines');
    }

    // Check prompt length
    const estimatedTokens = Math.ceil(prompt.length / 4);
    if (estimatedTokens > 32000) {
      errors.push(`Prompt too long: ~${estimatedTokens} tokens`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create no-match prompt (when no relevant context found)
   */
  createNoMatchPrompt(query: string, message: string): string {
    return `用户问题: ${query}

检索结果: ${message}

由于没有找到相关参考资料，请直接告知用户无法回答此问题，并建议用户：
1. 尝试使用其他关键词
2. 检查文档是否已正确索引
3. 简化查询问题后重试`;
  }
}

/**
 * Create enhanced LLM generation service instance
 */
export function createEnhancedLLMGenerationService(): EnhancedLLMGenerationService {
  return new EnhancedLLMGenerationService();
}