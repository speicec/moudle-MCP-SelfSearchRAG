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
  QueryStrategy,
} from './ExecutionTypes.js';

/**
 * 结构化模板定义
 */
export interface StructuredTemplate {
  id: string;
  name: string;
  description: string;
  matchCriteria: (entities: MedicalEntities, intentAnalysis: IntentAnalysis) => boolean;
  generateDAG: (entities: MedicalEntities, query: string, intentAnalysis: IntentAnalysis, queryStrategy?: QueryStrategy) => TaskDAG;
}

/**
 * 基础结构化模板
 */
export const STRUCTURED_TEMPLATES: StructuredTemplate[] = [
  // 模板 0: 疾病用药建议（新增，优先级最高）
  {
    id: 'disease_drug_recommendation',
    name: '疾病用药建议',
    description: '用于疾病用药建议查询（如"糖尿病用什么药"）',
    matchCriteria: (entities, intentAnalysis) => {
      return (
        intentAnalysis.queryTypes.includes('decision_support') &&
        entities.diseases.length >= 1 &&
        entities.drugs.length === 0 &&
        // 允许有指标但无指标值的情况（如"高血压"中的"血压"）
        !entities.indicators.some(i => i.value !== undefined)
      );
    },
    generateDAG: (entities, query, intentAnalysis, queryStrategy) => {
      const disease = entities.diseases[0];
      if (!disease) {
        throw new Error('Disease not found for drug recommendation template');
      }
      // 使用优化查询（优先）或实体特定查询
      const retrieveQuery = queryStrategy?.primaryQuery ?? `${disease.canonicalName}治疗方案 用药 药物选择`;

      return {
        tasks: [
          {
            id: 'retrieve_treatment',
            type: 'retrieve',
            params: { query: retrieveQuery },
            dependencies: [],
            priority: 1,
          },
          {
            id: 'retrieve_guidelines',
            type: 'retrieve',
            params: { query: `${disease.canonicalName}指南 用药推荐` },
            dependencies: [],
            priority: 1,
            parallelGroup: 'parallel_retrieve',
          },
          {
            id: 'evaluate_options',
            type: 'evaluate',
            params: { criteria: 'drug_recommendation' },
            dependencies: ['retrieve_treatment', 'retrieve_guidelines'],
            priority: 4,
          },
          {
            id: 'generate_answer',
            type: 'generate_answer',
            params: { format: 'recommendation' },
            dependencies: ['evaluate_options'],
            priority: 7,
          },
        ],
        parallelGroups: ['parallel_retrieve'],
        entryTasks: ['retrieve_treatment', 'retrieve_guidelines'],
        exitTasks: ['generate_answer'],
      };
    },
  },

  // 模板 1: 指南年份过滤
  {
    id: 'guideline_year_filter',
    name: '指南年份过滤',
    description: '用于需要年份过滤的指南查询',
    matchCriteria: (entities, intentAnalysis) => {
      return intentAnalysis.specialNeeds.requireYearFilter;
    },
    generateDAG: (entities, query, intentAnalysis, queryStrategy) => {
      const year = intentAnalysis.specialNeeds.yearValue || 2024;
      // 使用优化查询（优先）或实体特定查询
      const baseQuery = queryStrategy?.primaryQuery ?? `${entities.diseases[0]?.canonicalName || ''}指南`;
      return {
        tasks: [
          {
            id: 'retrieve_guideline',
            type: 'retrieve',
            params: { query: baseQuery, filters: { year } },
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
    generateDAG: (entities, query, intentAnalysis, queryStrategy) => {
      const drug = entities.drugs[0];
      if (!drug) {
        throw new Error('Drug not found for contraindication template');
      }
      // 使用优化查询（优先）或实体特定查询
      const retrieveQuery = queryStrategy?.primaryQuery ?? `${drug.canonicalName}禁忌症 contraindication`;
      return {
        tasks: [
          {
            id: 'retrieve_contraindication',
            type: 'retrieve',
            params: { query: retrieveQuery },
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
    generateDAG: (entities, query, intentAnalysis, queryStrategy) => {
      const drugs = entities.drugs;
      const groupId = 'parallel_retrieve';

      // 创建并行检索任务
      // 使用优化查询（优先）或实体特定查询
      const retrieveTasks: AgentTask[] = drugs.map((drug) => ({
        id: `retrieve_${drug.id}`,
        type: 'retrieve',
        params: { query: queryStrategy?.primaryQuery ?? drug.canonicalName },
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

  // 模板 4: 指标决策支持（新增）
  // 优先级高于 indicator_drug_query，覆盖决策支持 + 指标值场景
  {
    id: 'decision_support_with_indicator',
    name: '指标决策支持',
    description: '用于决策支持查询带指标值（如"eGFR=35能否使用二甲双胍"）',
    matchCriteria: (entities, intentAnalysis) => {
      return (
        intentAnalysis.queryTypes.includes('decision_support') &&
        entities.drugs.length >= 1 &&
        entities.indicators.length >= 1 &&
        entities.indicators.some(i => i.value !== undefined)
      );
    },
    generateDAG: (entities, query, intentAnalysis, queryStrategy) => {
      const drug = entities.drugs[0];
      const indicator = entities.indicators.find(i => i.value !== undefined) ?? entities.indicators[0];
      if (!drug || !indicator) {
        throw new Error('Drug or indicator not found for decision_support_with_indicator template');
      }
      const retrieveGroupId = 'parallel_retrieve';

      // 使用优化查询（优先）或实体特定查询
      const drugQuery = queryStrategy?.primaryQuery ?? `${drug.canonicalName}禁忌 contraindication`;
      const indicatorQuery = `${indicator.canonicalName}阈值 threshold ${indicator.value ?? ''}`;

      return {
        tasks: [
          // 并行检索药物和指标信息
          {
            id: `retrieve_${drug.id}`,
            type: 'retrieve',
            params: { query: drugQuery },
            dependencies: [],
            priority: 1,
            parallelGroup: retrieveGroupId,
          },
          {
            id: `retrieve_${indicator.id}`,
            type: 'retrieve',
            params: { query: indicatorQuery },
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
          // 生成答案（推荐格式）
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

  // 模板 5: 指标-药物查询
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
    generateDAG: (entities, query, intentAnalysis, queryStrategy) => {
      const drug = entities.drugs[0];
      const indicator = entities.indicators.find(i => i.value !== undefined) ?? entities.indicators[0];
      if (!drug || !indicator) {
        throw new Error('Drug or indicator not found for indicator_drug_query template');
      }
      const retrieveGroupId = 'parallel_retrieve';

      // 使用优化查询（优先）或实体特定查询
      const drugQuery = queryStrategy?.primaryQuery ?? `${drug.canonicalName}禁忌 contraindication`;
      const indicatorQuery = `${indicator.canonicalName}阈值 threshold ${indicator.value ?? ''}`;

      return {
        tasks: [
          // 并行检索药物和指标信息
          {
            id: `retrieve_${drug.id}`,
            type: 'retrieve',
            params: { query: drugQuery },
            dependencies: [],
            priority: 1,
            parallelGroup: retrieveGroupId,
          },
          {
            id: `retrieve_${indicator.id}`,
            type: 'retrieve',
            params: { query: indicatorQuery },
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
 * 模板匹配尝试记录（用于日志）
 */
export interface TemplateAttemptRecord {
  templateId: string;
  templateName: string;
  matched: boolean;
  rejectionReason?: string | undefined;
}

/**
 * 模板匹配结果
 */
export interface TemplateMatchResult {
  matched: boolean;
  templateId?: string;
  templateName?: string;
  dag?: TaskDAG;
  attempts?: TemplateAttemptRecord[]; // 所有模板尝试记录
}

/**
 * 匹配模板（记录所有尝试）
 * 关键修改：新增 attempts 数组记录每个模板的匹配尝试过程
 * 目的：让用户看到为什么某个模板被选择或拒绝，提升透明度
 */
export function matchTemplate(
  entities: MedicalEntities,
  intentAnalysis: IntentAnalysis,
  query: string,
  queryStrategy?: QueryStrategy // 新增：传递优化查询策略，确保模板DAG使用优化查询
): TemplateMatchResult {
  const attempts: TemplateAttemptRecord[] = []; // 记录所有模板匹配尝试

  for (const template of STRUCTURED_TEMPLATES) {
    const matched = template.matchCriteria(entities, intentAnalysis);

    // 新增：记录每个模板的尝试结果，包括拒绝原因
    // 用户可通过可视化看到完整的模板匹配过程
    attempts.push({
      templateId: template.id,
      templateName: template.name,
      matched,
      rejectionReason: matched ? undefined : getRejectionReason(template.id, entities, intentAnalysis),
    });

    if (matched) {
      // 关键修改：传递 queryStrategy 给模板 DAG 生成器
      // 确保模板生成的 retrieve 任务使用优化后的查询词
      const dag = template.generateDAG(entities, query, intentAnalysis, queryStrategy);
      return {
        matched: true,
        templateId: template.id,
        templateName: template.name,
        dag,
        attempts, // 返回所有尝试记录，用于可视化
      };
    }
  }

  return {
    matched: false,
    attempts,
  };
}

/**
 * 获取模板匹配失败原因
 */
function getRejectionReason(
  templateId: string,
  entities: MedicalEntities,
  intentAnalysis: IntentAnalysis
): string {
  switch (templateId) {
    case 'disease_drug_recommendation':
      if (!intentAnalysis.queryTypes.includes('decision_support')) return 'no decision_support query type';
      if (entities.diseases.length < 1) return 'no diseases';
      if (entities.drugs.length > 0) return `drugs.length=${entities.drugs.length} (need 0)`;
      if (entities.indicators.some(i => i.value !== undefined)) return 'has indicator value (need no value)';
      return 'unknown';
    case 'guideline_year_filter':
      return !intentAnalysis.specialNeeds.requireYearFilter ? 'no year filter required' : 'matched';
    case 'drug_contraindication':
      if (!intentAnalysis.specialNeeds.checkContraindication) return 'no contraindication check needed';
      if (entities.drugs.length !== 1) return `drugs.length=${entities.drugs.length} (need 1)`;
      if (entities.indicators.length !== 0) return `indicators.length=${entities.indicators.length} (need 0)`;
      return 'unknown';
    case 'drug_comparison':
      if (!intentAnalysis.queryTypes.includes('comparison')) return 'no comparison query type';
      if (entities.drugs.length < 2) return `drugs.length=${entities.drugs.length} (need ≥2)`;
      return 'unknown';
    case 'decision_support_with_indicator':
      if (!intentAnalysis.queryTypes.includes('decision_support')) return 'no decision_support query type';
      if (entities.drugs.length < 1) return 'no drugs';
      if (entities.indicators.length < 1) return 'no indicators';
      if (!entities.indicators.some(i => i.value !== undefined)) return 'no indicator value';
      return 'unknown';
    case 'indicator_drug_query':
      if (!intentAnalysis.specialNeeds.checkContraindication) return 'no contraindication check needed';
      if (entities.drugs.length < 1) return 'no drugs';
      if (entities.indicators.length < 1) return 'no indicators';
      if (!entities.indicators.some(i => i.value !== undefined)) return 'no indicator value';
      return 'unknown';
    default:
      return 'criteria not met';
  }
}

/**
 * 创建模板匹配器
 */
export function createTemplateMatcher(): {
  match: (entities: MedicalEntities, intentAnalysis: IntentAnalysis, query: string, queryStrategy?: QueryStrategy) => TemplateMatchResult;
  getTemplates: () => StructuredTemplate[];
} {
  return {
    match: matchTemplate,
    getTemplates: () => STRUCTURED_TEMPLATES,
  };
}