/**
 * Template Matcher - 模板匹配器
 *
 * 结构化查询模板匹配，零 LLM 调用
 */

import type { MedicalEntities } from '../types.js';
import type {
  TaskDAG,
  AgentTask,
  IntentAnalysis,
} from './ExecutionTypes.js';

/**
 * 结构化模板定义
 */
export interface StructuredTemplate {
  id: string;
  name: string;
  description: string;
  matchCriteria: (entities: MedicalEntities, intentAnalysis: IntentAnalysis) => boolean;
  generateDAG: (entities: MedicalEntities, query: string, intentAnalysis: IntentAnalysis) => TaskDAG;
}

/**
 * 基础结构化模板
 */
export const STRUCTURED_TEMPLATES: StructuredTemplate[] = [
  // 模板 1: 指南年份过滤
  {
    id: 'guideline_year_filter',
    name: '指南年份过滤',
    description: '用于需要年份过滤的指南查询',
    matchCriteria: (entities, intentAnalysis) => {
      return intentAnalysis.specialNeeds.requireYearFilter;
    },
    generateDAG: (entities, query, intentAnalysis) => {
      const year = intentAnalysis.specialNeeds.yearValue || 2024;
      return {
        tasks: [
          {
            id: 'retrieve_guideline',
            type: 'retrieve',
            params: { query: `${entities.diseases[0]?.canonicalName || ''}指南`, filters: { year } },
            dependencies: [],
            priority: 1,
          },
          {
            id: 'evaluate_evidence',
            type: 'evaluate',
            params: { results: [] },
            dependencies: ['retrieve_guideline'],
            priority: 4,
          },
          {
            id: 'generate_answer',
            type: 'generate_answer',
            params: {},
            dependencies: ['evaluate_evidence'],
            priority: 7,
          },
        ],
        parallelGroups: [],
        entryTasks: ['retrieve_guideline'],
        exitTasks: ['generate_answer'],
      };
    },
  },

  // 模板 2: 单药禁忌检查
  {
    id: 'drug_contraindication',
    name: '药物禁忌检查',
    description: '用于单药禁忌症查询',
    matchCriteria: (entities, intentAnalysis) => {
      return (
        intentAnalysis.specialNeeds.checkContraindication &&
        entities.drugs.length === 1 &&
        entities.indicators.length === 0
      );
    },
    generateDAG: (entities, query, intentAnalysis) => {
      const drug = entities.drugs[0];
      if (!drug) {
        throw new Error('Drug not found for contraindication template');
      }
      return {
        tasks: [
          {
            id: 'retrieve_contraindication',
            type: 'retrieve',
            params: { query: `${drug.canonicalName}禁忌症 contraindication` },
            dependencies: [],
            priority: 1,
          },
          {
            id: 'check_contraindication',
            type: 'check_contraindication',
            params: { drug: drug.id },
            dependencies: ['retrieve_contraindication'],
            priority: 5,
          },
          {
            id: 'generate_answer',
            type: 'generate_answer',
            params: {},
            dependencies: ['check_contraindication'],
            priority: 7,
          },
        ],
        parallelGroups: [],
        entryTasks: ['retrieve_contraindication'],
        exitTasks: ['generate_answer'],
      };
    },
  },

  // 模板 3: 药物对比
  {
    id: 'drug_comparison',
    name: '药物对比',
    description: '用于多药物对比查询',
    matchCriteria: (entities, intentAnalysis) => {
      return (
        intentAnalysis.queryTypes.includes('comparison') &&
        entities.drugs.length >= 2
      );
    },
    generateDAG: (entities, query, intentAnalysis) => {
      const drugs = entities.drugs;
      const groupId = 'parallel_retrieve';

      // 创建并行检索任务
      const retrieveTasks: AgentTask[] = drugs.map((drug) => ({
        id: `retrieve_${drug.id}`,
        type: 'retrieve',
        params: { query: drug.canonicalName },
        dependencies: [],
        priority: 1,
        parallelGroup: groupId,
      }));

      // 创建对比任务
      const comparisonTask: AgentTask = {
        id: 'compare_drugs',
        type: 'evaluate',
        params: { results: [], criteria: 'comparison' },
        dependencies: retrieveTasks.map(t => t.id),
        priority: 4,
      };

      // 创建答案任务
      const answerTask: AgentTask = {
        id: 'generate_answer',
        type: 'generate_answer',
        params: { format: 'comparison' },
        dependencies: ['compare_drugs'],
        priority: 7,
      };

      return {
        tasks: [...retrieveTasks, comparisonTask, answerTask],
        parallelGroups: [groupId],
        entryTasks: retrieveTasks.map(t => t.id),
        exitTasks: ['generate_answer'],
      };
    },
  },

  // 模板 4: 指标-药物查询
  {
    id: 'indicator_drug_query',
    name: '指标药物查询',
    description: '用于带指标值的禁忌检查',
    matchCriteria: (entities, intentAnalysis) => {
      return (
        intentAnalysis.specialNeeds.checkContraindication &&
        entities.drugs.length >= 1 &&
        entities.indicators.length >= 1 &&
        entities.indicators.some(i => i.value !== undefined)
      );
    },
    generateDAG: (entities, query, intentAnalysis) => {
      const drug = entities.drugs[0];
      const indicator = entities.indicators.find(i => i.value !== undefined) ?? entities.indicators[0];
      if (!drug || !indicator) {
        throw new Error('Drug or indicator not found for indicator_drug_query template');
      }
      const retrieveGroupId = 'parallel_retrieve';

      return {
        tasks: [
          // 并行检索药物和指标信息
          {
            id: `retrieve_${drug.id}`,
            type: 'retrieve',
            params: { query: `${drug.canonicalName}禁忌 contraindication` },
            dependencies: [],
            priority: 1,
            parallelGroup: retrieveGroupId,
          },
          {
            id: `retrieve_${indicator.id}`,
            type: 'retrieve',
            params: { query: `${indicator.canonicalName}阈值 threshold` },
            dependencies: [],
            priority: 1,
            parallelGroup: retrieveGroupId,
          },
          // 计算指标阈值
          {
            id: 'calculate_indicator',
            type: 'calculate_indicator',
            params: {
              indicator: indicator.id,
              value: indicator.value,
              unit: indicator.unit,
            },
            dependencies: [`retrieve_${indicator.id}`],
            priority: 3,
          },
          // 检查禁忌
          {
            id: 'check_contraindication',
            type: 'check_contraindication',
            params: {
              drug: drug.id,
              indicator: indicator.id,
              threshold: indicator.value,
            },
            dependencies: [`retrieve_${drug.id}`, 'calculate_indicator'],
            priority: 5,
          },
          // 生成答案
          {
            id: 'generate_answer',
            type: 'generate_answer',
            params: { format: 'recommendation' },
            dependencies: ['check_contraindication'],
            priority: 7,
          },
        ],
        parallelGroups: [retrieveGroupId],
        entryTasks: [`retrieve_${drug.id}`, `retrieve_${indicator.id}`],
        exitTasks: ['generate_answer'],
      };
    },
  },
];

/**
 * 模板匹配结果
 */
export interface TemplateMatchResult {
  matched: boolean;
  templateId?: string;
  templateName?: string;
  dag?: TaskDAG;
}

/**
 * 匹配模板
 */
export function matchTemplate(
  entities: MedicalEntities,
  intentAnalysis: IntentAnalysis,
  query: string
): TemplateMatchResult {
  for (const template of STRUCTURED_TEMPLATES) {
    if (template.matchCriteria(entities, intentAnalysis)) {
      const dag = template.generateDAG(entities, query, intentAnalysis);
      return {
        matched: true,
        templateId: template.id,
        templateName: template.name,
        dag,
      };
    }
  }

  return {
    matched: false,
  };
}

/**
 * 创建模板匹配器
 */
export function createTemplateMatcher(): {
  match: (entities: MedicalEntities, intentAnalysis: IntentAnalysis, query: string) => TemplateMatchResult;
  getTemplates: () => StructuredTemplate[];
} {
  return {
    match: matchTemplate,
    getTemplates: () => STRUCTURED_TEMPLATES,
  };
}