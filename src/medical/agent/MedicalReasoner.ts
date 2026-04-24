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
  EvidenceEvaluation,
} from '../types.js';
import type { SafetyAssessment } from '../safety-layer.js';
import {
  THINK_PROMPT,
  DECIDE_PROMPT,
  ANSWER_PROMPT,
  QUALITY_PROMPT,
} from './AgentPrompts.js';
import { calculateOverallGrade } from '../evidence-evaluator.js';

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
    safetyAssessment?: SafetyAssessment,
    evidenceEvaluation?: EvidenceEvaluation[],
  ): Promise<MedicalAnswer> {
    // 传递基本参数给 LLM（保持提示词模板不变）
    const promptArgs: {
      entities: MedicalEntities;
      retrievalResults?: Array<{
        content: string;
        source: SourceCitation;
      }>;
    } = { entities };
    if (retrievalResults !== undefined) {
      promptArgs.retrievalResults = retrievalResults;
    }
    const prompt = ANSWER_PROMPT(promptArgs);

    const response = await this.llmCaller(prompt);

    // 解析 LLM 响应为结构化回答（三层综合）
    return this.parseAnswer(response, entities, retrievalResults, safetyAssessment, evidenceEvaluation);
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
    // 精确提取 ACTION (使用正则而非includes)
    const actionMatch = response.match(/ACTION:\s+(\w+)/i);
    let action: ReasoningDecision['action'] = 'answer';

    if (actionMatch && actionMatch[1]) {
      const extractedAction = actionMatch[1].toLowerCase();
      // 验证action是否合法
      const validActions = ['retrieve', 'expand_query', 'answer', 'need_more'];
      if (validActions.includes(extractedAction)) {
        action = extractedAction as ReasoningDecision['action'];
      }
    }

    // 精确提取 CONFIDENCE
    const confMatch = response.match(/CONFIDENCE:\s+([\d.]+)/i);
    const confidence = confMatch && confMatch[1] ? parseFloat(confMatch[1]) : 0.5;

    // 精确提取 REASON
    const reasonMatch = response.match(/REASON:\s+(.+?)(?=CONFIDENCE|$)/is);
    const reason = reasonMatch && reasonMatch[1] ? reasonMatch[1].trim() : response.slice(0, 200);

    return {
      action,
      reason,
      confidence,
    };
  }

  /**
   * 解析医学回答（三层综合）
   */
  private parseAnswer(
    response: string,
    entities: MedicalEntities,
    retrievalResults?: Array<{
      content: string;
      source: SourceCitation;
    }>,
    safetyAssessment?: SafetyAssessment,
    evidenceEvaluation?: EvidenceEvaluation[],
  ): MedicalAnswer {
    // 从响应中提取结构化内容
    const sections = this.extractSections(response);

    // 三层综合：优先级 absolute > relative > interaction > safe
    let conclusionText: string;
    let conclusionConfidence: 'high' | 'medium' | 'low';

    if (safetyAssessment?.severity === 'absolute') {
      // Layer 1 优先：绝对禁忌
      conclusionText = safetyAssessment.recommendation;
      conclusionConfidence = 'high';
    } else if (safetyAssessment?.severity === 'relative') {
      // Layer 1 + Layer 2：相对禁忌 + 检索补充
      conclusionText = `慎用：${safetyAssessment.recommendation}`;
      conclusionConfidence = 'high';
    } else if (safetyAssessment?.severity === 'interaction') {
      // Layer 1：相互作用
      conclusionText = `药物相互作用：${safetyAssessment.recommendation}`;
      conclusionConfidence = 'high';
    } else {
      // Layer 2：检索结果综合
      conclusionText = sections.conclusion ?? '基于检索结果生成的医学回答';
      conclusionConfidence = entities.confidence > 0.8 ? 'high' : 'medium';
    }

    // 构建详细说明点
    const detailsPoints = this.buildDetailPoints(
      sections,
      retrievalResults,
      safetyAssessment,
    );

    // GRADE 等级：从 EvidenceEvaluation 计算（而非 LLM 提取）
    const evidenceGrade = this.buildEvidenceGrade(evidenceEvaluation, response);

    // 收集来源
    const sources = this.collectSources(retrievalResults, safetyAssessment);

    // 构建回答
    return {
      conclusion: {
        text: conclusionText,
        confidence: conclusionConfidence,
      },
      details: {
        points: detailsPoints,
      },
      evidenceGrade,
      sources,
      warnings: [
        '本回答仅供参考，不构成医疗建议',
        '请咨询专业医生后再做决定',
        ...this.getLowQualityWarnings(evidenceEvaluation),
      ],
    };
  }

  /**
   * 获取低质量证据警告
   */
  private getLowQualityWarnings(evidenceEvaluation?: EvidenceEvaluation[]): string[] {
    if (!evidenceEvaluation || evidenceEvaluation.length === 0) {
      return [];
    }

    // 检查最低综合评分
    const minCompositeScore = Math.min(
      ...evidenceEvaluation.map(e => e.compositeScore ?? 0.5)
    );

    if (minCompositeScore < 0.5) {
      return ['证据质量较低，建议查阅权威指南确认'];
    }

    // 检查一致性冲突
    const minConsistency = Math.min(
      ...evidenceEvaluation.map(e => e.consistencyScore ?? 1.0)
    );

    if (minConsistency < 0.5) {
      return ['不同来源存在证据分歧，请综合判断'];
    }

    return [];
  }

  /**
   * 构建详细说明点
   */
  private buildDetailPoints(
    sections: { conclusion?: string; details?: string[]; evidence?: string },
    retrievalResults?: Array<{
      content: string;
      source: SourceCitation;
    }>,
    safetyAssessment?: SafetyAssessment,
  ): Array<{ text: string; sources: SourceCitation[] }> {
    const points: Array<{ text: string; sources: SourceCitation[] }> = [];

    // 添加安全评估相关信息
    if (safetyAssessment !== undefined && safetyAssessment.contraindicationMatches.length > 0) {
      for (const match of safetyAssessment.contraindicationMatches) {
        points.push({
          text: match.contraindication.description,
          sources: [],
        });
      }
    }

    // 添加相互作用信息
    if (safetyAssessment !== undefined && safetyAssessment.interactions.length > 0) {
      for (const interaction of safetyAssessment.interactions) {
        points.push({
          text: `${interaction.description}。建议：${interaction.recommendation}`,
          sources: [],
        });
      }
    }

    // 添加检索结果的详细说明
    if (sections.details !== undefined) {
      for (const text of sections.details) {
        points.push({
          text,
          sources: retrievalResults?.slice(0, 2).map(r => r.source) ?? [],
        });
      }
    }

    return points;
  }

  /**
   * 构建证据等级（从计算而非提取）
   */
  private buildEvidenceGrade(
    evidenceEvaluation?: EvidenceEvaluation[],
    response?: string,
  ): { grade: GradeLevel; sourceType: string } {
    if (evidenceEvaluation && evidenceEvaluation.length > 0) {
      // 从 EvidenceEvaluation 计算 GRADE
      const grade = calculateOverallGrade(evidenceEvaluation);
      const sourceType = evidenceEvaluation[0]?.literatureType ?? 'unknown';
      return { grade, sourceType };
    }

    // 降级：从 LLM 响应提取（兼容无证据评估的情况）
    return {
      grade: this.extractGrade(response ?? ''),
      sourceType: 'guideline',
    };
  }

  /**
   * 收集来源引用
   */
  private collectSources(
    retrievalResults?: Array<{
      content: string;
      source: SourceCitation;
    }>,
    safetyAssessment?: SafetyAssessment,
  ): SourceCitation[] {
    const sources: SourceCitation[] = [];

    // 添加检索结果来源
    if (retrievalResults !== undefined) {
      sources.push(...retrievalResults.map(r => r.source));
    }

    // 添加安全评估的指南来源
    if (safetyAssessment !== undefined && safetyAssessment.sourceGlossary.length > 0) {
      for (const glossary of safetyAssessment.sourceGlossary) {
        sources.push({
          documentName: glossary,
        });
      }
    }

    return sources;
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