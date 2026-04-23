/**
 * Retrieval Visualization - 检索可视化
 *
 * 定义检索结果可视化数据结构和收集器
 */

import type { MedicalEntities } from '../types.js';
import type { IntentAnalysis, QueryStrategy, TaskDAG, ExecutorState } from './ExecutionTypes.js';

/**
 * 关键词匹配信息
 */
export interface KeywordMatch {
  keyword: string;
  type: 'contraindication' | 'precaution' | 'interaction' | 'indication';
  position: [number, number]; // [start, end]
}

/**
 * 实体匹配信息
 */
export interface EntityMatch {
  matchedTerm: string;
  canonicalName: string;
  entityType: 'disease' | 'drug' | 'indicator';
  confidence: number;
  value?: number | undefined;
  unit?: string | undefined;
}

/**
 * 查询重写信息
 */
export interface QueryRewriting {
  primaryQuery: string;
  expandedTerms: string[];
  filters?: {
    yearRange?: [number, number];
    sources?: string[];
  };
}

/**
 * 执行路径信息
 */
export interface ExecutionPath {
  mode: 'react' | 'planning' | 'direct_retrieval';
  reason: string;
  matchedTemplate?: string;
  stages: string[]; // e.g., ['Planning', 'Template', 'DAG Execution']
}

/**
 * 模板匹配尝试记录
 */
export interface TemplateAttempt {
  templateId: string;
  templateName: string;
  matched: boolean;
  rejectionReason?: string | undefined;
}

/**
 * 检索可视化数据
 */
export interface RetrievalVisualization {
  originalQuery: string;
  keywordMatches: KeywordMatch[];
  entityMatches: EntityMatch[];
  queryRewriting: QueryRewriting;
  executionPath: ExecutionPath;
  retrievalResultCount: number;
  templateAttempts?: TemplateAttempt[];
}

/**
 * 可视化收集器
 */
export class VisualizationCollector {
  private originalQuery: string = '';
  private keywordMatches: KeywordMatch[] = [];
  private entityMatches: EntityMatch[] = [];
  private queryRewriting: QueryRewriting = { primaryQuery: '', expandedTerms: [] };
  private executionPath: ExecutionPath = { mode: 'react', reason: '', stages: [] };
  private retrievalResultCount: number = 0;
  private templateAttempts: TemplateAttempt[] = [];

  /**
   * 收集输入阶段数据
   */
  collectInputPhase(query: string, timestamp?: number): void {
    this.originalQuery = query;
  }

  /**
   * 收集关键词匹配数据
   */
  collectKeywordMatches(matches: KeywordMatch[]): void {
    this.keywordMatches = matches;
  }

  /**
   * 收集实体匹配数据
   */
  collectEntityMatches(entities: MedicalEntities): void {
    this.entityMatches = [];

    // 转换疾病实体
    for (const disease of entities.diseases) {
      this.entityMatches.push({
        matchedTerm: disease.matchedTerm,
        canonicalName: disease.canonicalName,
        entityType: 'disease',
        confidence: entities.confidence, // 使用整体置信度
      });
    }

    // 转换药物实体
    for (const drug of entities.drugs) {
      this.entityMatches.push({
        matchedTerm: drug.matchedTerm,
        canonicalName: drug.canonicalName,
        entityType: 'drug',
        confidence: entities.confidence,
      });
    }

    // 转换指标实体（包含值）
    for (const indicator of entities.indicators) {
      this.entityMatches.push({
        matchedTerm: indicator.matchedTerm,
        canonicalName: indicator.canonicalName,
        entityType: 'indicator',
        confidence: entities.confidence,
        value: indicator.value,
        unit: indicator.unit,
      });
    }
  }

  /**
   * 收集查询重写数据
   */
  collectQueryRewriting(strategy: QueryStrategy): void {
    this.queryRewriting = {
      primaryQuery: strategy.primaryQuery,
      expandedTerms: strategy.expandedTerms,
    };
  }

  /**
   * 收集复杂度评估数据
   */
  collectComplexityPhase(complexity: { level: string; needsPlanning: boolean; reason: string }): void {
    // 复杂度信息用于后续 executionPath.reason
  }

  /**
   * 收集模式选择数据
   */
  collectModeSelectionPhase(mode: 'react' | 'planning' | 'direct_retrieval', reason: string): void {
    this.executionPath.mode = mode;
    this.executionPath.reason = reason;
    this.executionPath.stages = [mode === 'planning' ? 'Planning' : mode === 'direct_retrieval' ? 'Direct Retrieval' : 'ReAct'];
  }

  /**
   * 收集模板匹配数据
   */
  collectTemplatePhase(templateAttempts: TemplateAttempt[], matchedTemplate?: string): void {
    this.templateAttempts = templateAttempts;
    if (matchedTemplate) {
      this.executionPath.matchedTemplate = matchedTemplate;
      this.executionPath.stages.push('Template Match');
    }
  }

  /**
   * 收集 DAG 数据
   */
  collectDAGPhase(dag: TaskDAG): void {
    this.executionPath.stages.push('DAG Execution');
  }

  /**
   * 收集执行阶段数据
   */
  collectExecutionPhase(executorState: ExecutorState): void {
    // 统计检索结果数量
    let totalCount = 0;
    for (const task of executorState.dag.tasks) {
      if (task.type === 'retrieve') {
        const result = executorState.completed.get(task.id);
        if (result?.success && result.data) {
          const data = result.data as { results?: Array<{ content: string }> };
          if (data.results) {
            totalCount += data.results.length;
          }
        }
      }
    }
    this.retrievalResultCount = totalCount;
  }

  /**
   * 收集答案生成数据
   */
  collectAnswerPhase(answer: unknown): void {
    this.executionPath.stages.push('Answer Generation');
  }

  /**
   * 设置检索结果数量
   */
  setRetrievalResultCount(count: number): void {
    this.retrievalResultCount = count;
  }

  /**
   * 构建可视化数据
   */
  buildVisualization(): RetrievalVisualization {
    return {
      originalQuery: this.originalQuery,
      keywordMatches: this.keywordMatches,
      entityMatches: this.entityMatches,
      queryRewriting: this.queryRewriting,
      executionPath: this.executionPath,
      retrievalResultCount: this.retrievalResultCount,
      templateAttempts: this.templateAttempts,
    };
  }

  /**
   * 格式化简要可视化（用于 MCP Tool 输出）
   */
  formatBrief(): string {
    const lines: string[] = [];

    // 原始查询
    lines.push(`**原始查询**: "${this.originalQuery}"`);
    lines.push('');

    // 识别结果
    if (this.entityMatches.length > 0) {
      lines.push('**识别结果**:');
      for (const match of this.entityMatches) {
        const valueStr = match.value !== undefined ? `=${match.value}${match.unit ?? ''}` : '';
        lines.push(`- ${match.entityType}: ${match.matchedTerm}${valueStr} → ${match.canonicalName}`);
      }
      lines.push('');
    }

    // 优化查询
    if (this.queryRewriting.primaryQuery && this.queryRewriting.primaryQuery !== this.originalQuery) {
      lines.push(`**优化查询**: "${this.queryRewriting.primaryQuery}"`);
      if (this.queryRewriting.expandedTerms.length > 0) {
        lines.push(`  扩展词: ${this.queryRewriting.expandedTerms.join(', ')}`);
      }
      lines.push('');
    }

    // 执行路径
    lines.push(`**执行路径**: ${this.executionPath.stages.join(' → ')}`);
    if (this.executionPath.matchedTemplate) {
      lines.push(`  匹配模板: ${this.executionPath.matchedTemplate}`);
    }
    lines.push('');

    // 检索结果
    lines.push(`**检索结果**: ${this.retrievalResultCount}条相关文献`);

    return lines.join('\n');
  }

  /**
   * 格式化完整可视化（用于 Logger 报告）
   */
  formatFull(): string {
    const lines: string[] = [];

    lines.push('## 检索可视化详细报告');
    lines.push('');

    // 原始查询
    lines.push('### 输入解析');
    lines.push(`**原始查询**: "${this.originalQuery}"`);
    lines.push('');

    // 关键词匹配
    if (this.keywordMatches.length > 0) {
      lines.push('### 关键词匹配');
      for (const match of this.keywordMatches) {
        lines.push(`- "${match.keyword}" (${match.type}) at [${match.position[0]}, ${match.position[1]}]`);
      }
      lines.push('');
    }

    // 实体匹配
    lines.push('### 实体识别');
    lines.push('```json');
    lines.push(JSON.stringify(this.entityMatches, null, 2));
    lines.push('```');
    lines.push('');

    // 查询重写
    lines.push('### 查询优化');
    lines.push(`**优化查询**: "${this.queryRewriting.primaryQuery}"`);
    if (this.queryRewriting.expandedTerms.length > 0) {
      lines.push(`**扩展词**: ${this.queryRewriting.expandedTerms.join(', ')}`);
    }
    if (this.queryRewriting.filters) {
      lines.push('**过滤器**:');
      if (this.queryRewriting.filters.yearRange) {
        lines.push(`  - 年份: ${this.queryRewriting.filters.yearRange[0]}-${this.queryRewriting.filters.yearRange[1]}`);
      }
      if (this.queryRewriting.filters.sources) {
        lines.push(`  - 来源: ${this.queryRewriting.filters.sources.join(', ')}`);
      }
    }
    lines.push('');

    // 执行路径
    lines.push('### 执行路径');
    lines.push(`**模式**: ${this.executionPath.mode}`);
    lines.push(`**原因**: ${this.executionPath.reason}`);
    lines.push(`**阶段**: ${this.executionPath.stages.join(' → ')}`);
    if (this.executionPath.matchedTemplate) {
      lines.push(`**匹配模板**: ${this.executionPath.matchedTemplate}`);
    }
    lines.push('');

    // 模板匹配尝试
    if (this.templateAttempts.length > 0) {
      lines.push('### 模板匹配尝试');
      for (const attempt of this.templateAttempts) {
        const status = attempt.matched ? '✓' : '✗';
        const reason = attempt.rejectionReason ? ` (${attempt.rejectionReason})` : '';
        lines.push(`- ${attempt.templateName}: ${status}${reason}`);
      }
      lines.push('');
    }

    // 检索结果
    lines.push('### 检索结果');
    lines.push(`**总数**: ${this.retrievalResultCount} 条相关文献`);

    return lines.join('\n');
  }
}

/**
 * 创建可视化收集器
 */
export function createVisualizationCollector(): VisualizationCollector {
  return new VisualizationCollector();
}