/**
 * Medical Reasoner - 医学推理器
 *
 * 使用 LLM 进行临床推理和医学回答生成
 */

import type { LLMCaller } from '../../config/llm-config.js';
import type {
  MedicalEntities,
  MedicalAnswer,
  SourceCitation,
  GradeLevel,
} from '../types.js';
import {
  THINK_PROMPT,
  DECIDE_PROMPT,
  ANSWER_PROMPT,
  QUALITY_PROMPT,
} from './AgentPrompts.js';

/**
 * 推理状态
 */
export interface ReasoningState {
  iteration: number;
  entities: MedicalEntities;
  retrievalResults?: Array<{
    content: string;
    source: SourceCitation;
  }>;
  reasoningTrace: string[];
  satisfied: boolean;
}

/**
 * 推理决策
 */
export interface ReasoningDecision {
  action: 'retrieve' | 'expand_query' | 'answer' | 'need_more';
  reason: string;
  confidence: number;
}

/**
 * MedicalReasoner 配置
 */
export interface MedicalReasonerConfig {
  llmCaller: LLMCaller;
  maxIterations: number;
  confidenceThreshold: number;
}

/**
 * 默认配置
 */
export const DEFAULT_REASONER_CONFIG: Omit<MedicalReasonerConfig, 'llmCaller'> = {
  maxIterations: 5,
  confidenceThreshold: 0.8,
};

/**
 * MedicalReasoner - 医学推理器
 */
export class MedicalReasoner {
  private llmCaller: LLMCaller;
  private config: Omit<MedicalReasonerConfig, 'llmCaller'>;

  constructor(config: MedicalReasonerConfig) {
    this.llmCaller = config.llmCaller;
    this.config = {
      ...DEFAULT_REASONER_CONFIG,
      maxIterations: config.maxIterations ?? DEFAULT_REASONER_CONFIG.maxIterations,
      confidenceThreshold: config.confidenceThreshold ?? DEFAULT_REASONER_CONFIG.confidenceThreshold,
    };
  }

  /**
   * 临床推理 - 分析当前状态并决策下一步
   */
  async reasonClinical(state: ReasoningState): Promise<ReasoningDecision> {
    const promptArgs: {
      entities: MedicalEntities;
      iteration: number;
      reasoningTrace: string[];
    } = {
      entities: state.entities,
      iteration: state.iteration,
      reasoningTrace: state.reasoningTrace,
    };
    if (state.retrievalResults) {
      (promptArgs as { retrievalResults?: Array<{ content: string; source: SourceCitation }> }).retrievalResults = state.retrievalResults;
    }
    const prompt = THINK_PROMPT(promptArgs);

    const response = await this.llmCaller(prompt);

    // 解析 LLM 响应
    return this.parseDecision(response);
  }

  /**
   * 决策判断 - 判断是否满足回答条件
   */
  async decide(state: ReasoningState): Promise<boolean> {
    const promptArgs: {
      entities: MedicalEntities;
      iteration: number;
    } = {
      entities: state.entities,
      iteration: state.iteration,
    };
    if (state.retrievalResults) {
      (promptArgs as { retrievalResults?: Array<{ content: string; source: SourceCitation }> }).retrievalResults = state.retrievalResults;
    }
    const prompt = DECIDE_PROMPT(promptArgs);

    const response = await this.llmCaller(prompt);

    // 解析是否满足
    return response.toLowerCase().includes('satisfied') ||
           response.toLowerCase().includes('满足') ||
           response.toLowerCase().includes('yes');
  }

  /**
   * 回答生成 - 生成结构化医学回答
   */
  async generateMedicalAnswer(
    entities: MedicalEntities,
    retrievalResults?: Array<{
      content: string;
      source: SourceCitation;
    }>,
  ): Promise<MedicalAnswer> {
    const promptArgs: { entities: MedicalEntities } = { entities };
    if (retrievalResults) {
      (promptArgs as { retrievalResults?: Array<{ content: string; source: SourceCitation }> }).retrievalResults = retrievalResults;
    }
    const prompt = ANSWER_PROMPT(promptArgs);

    const response = await this.llmCaller(prompt);

    // 解析 LLM 响应为结构化回答
    return this.parseAnswer(response, entities, retrievalResults);
  }

  /**
   * 质量检查 - 检查回答质量
   */
  async checkAnswerQuality(answer: MedicalAnswer): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const prompt = QUALITY_PROMPT({ answer });

    const response = await this.llmCaller(prompt);

    // 解析质量检查结果
    return this.parseQualityCheck(response);
  }

  /**
   * 解析推理决策
   */
  private parseDecision(response: string): ReasoningDecision {
    // 简化的解析逻辑
    const lowerResponse = response.toLowerCase();

    let action: ReasoningDecision['action'] = 'answer';
    if (lowerResponse.includes('retrieve') || lowerResponse.includes('检索')) {
      action = 'retrieve';
    } else if (lowerResponse.includes('expand') || lowerResponse.includes('扩展')) {
      action = 'expand_query';
    } else if (lowerResponse.includes('need_more') || lowerResponse.includes('需要更多信息')) {
      action = 'need_more';
    }

    // 提取置信度（如果有）
    const confidenceMatch = response.match(/confidence[:\s]+(\d+\.?\d*)/i);
    const confidence = confidenceMatch && confidenceMatch[1] ? parseFloat(confidenceMatch[1]) : 0.7;

    return {
      action,
      reason: response.slice(0, 200),
      confidence,
    };
  }

  /**
   * 解析医学回答
   */
  private parseAnswer(
    response: string,
    entities: MedicalEntities,
    retrievalResults?: Array<{
      content: string;
      source: SourceCitation;
    }>,
  ): MedicalAnswer {
    // 从响应中提取结构化内容
    const sections = this.extractSections(response);

    // 构建回答
    return {
      conclusion: {
        text: sections.conclusion ?? '基于检索结果生成的医学回答',
        confidence: entities.confidence > 0.8 ? 'high' : 'medium',
      },
      details: {
        points: (sections.details ?? []).map(text => ({
          text,
          sources: retrievalResults?.slice(0, 2).map(r => r.source) ?? [],
        })),
      },
      evidenceGrade: {
        grade: this.extractGrade(response),
        sourceType: 'guideline',
      },
      sources: retrievalResults?.map(r => r.source) ?? [],
      warnings: [
        '本回答仅供参考，不构成医疗建议',
        '请咨询专业医生后再做决定',
      ],
    };
  }

  /**
   * 解析质量检查结果
   */
  private parseQualityCheck(response: string): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const lowerResponse = response.toLowerCase();
    const isValid = !lowerResponse.includes('invalid') &&
                    !lowerResponse.includes('问题') &&
                    !lowerResponse.includes('issue');

    // 提取问题和建议
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!isValid) {
      // 简化的提取逻辑
      const lines = response.split('\n');
      for (const line of lines) {
        if (line.includes('问题') || line.includes('issue')) {
          issues.push(line.trim());
        }
        if (line.includes('建议') || line.includes('suggestion')) {
          suggestions.push(line.trim());
        }
      }
    }

    return { isValid, issues, suggestions };
  }

  /**
   * 提取响应中的章节
   */
  private extractSections(response: string): {
    conclusion?: string;
    details?: string[];
    evidence?: string;
  } {
    const sections: {
      conclusion?: string;
      details?: string[];
      evidence?: string;
    } = {};

    // 提取结论
    const conclusionMatch = response.match(/## 结论\s*(.+?)(?=##|$)/s);
    if (conclusionMatch && conclusionMatch[1]) {
      sections.conclusion = conclusionMatch[1].trim();
    }

    // 提取详细说明
    const detailsMatch = response.match(/## 详细说明\s*(.+?)(?=##|$)/s);
    if (detailsMatch && detailsMatch[1]) {
      sections.details = detailsMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
        .map(line => line.replace(/^-|^•/, '').trim());
    }

    // 提取证据等级
    const evidenceMatch = response.match(/## 证据等级\s*(.+?)(?=##|$)/s);
    if (evidenceMatch && evidenceMatch[1]) {
      sections.evidence = evidenceMatch[1].trim();
    }

    return sections;
  }

  /**
   * 提取 GRADE 等级
   */
  private extractGrade(response: string): GradeLevel {
    const upperResponse = response.toUpperCase();
    if (upperResponse.includes('GRADE A') || upperResponse.includes('A级')) {
      return 'A';
    }
    if (upperResponse.includes('GRADE B') || upperResponse.includes('B级')) {
      return 'B';
    }
    if (upperResponse.includes('GRADE C') || upperResponse.includes('C级')) {
      return 'C';
    }
    return 'D';
  }
}

/**
 * 创建 MedicalReasoner
 */
export function createMedicalReasoner(llmCaller: LLMCaller, config?: Partial<Omit<MedicalReasonerConfig, 'llmCaller'>>): MedicalReasoner {
  const fullConfig: MedicalReasonerConfig = {
    llmCaller,
    maxIterations: config?.maxIterations ?? DEFAULT_REASONER_CONFIG.maxIterations,
    confidenceThreshold: config?.confidenceThreshold ?? DEFAULT_REASONER_CONFIG.confidenceThreshold,
  };
  return new MedicalReasoner(fullConfig);
}