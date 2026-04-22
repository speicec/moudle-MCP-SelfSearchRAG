/**
 * Task Planner - 任务规划器
 *
 * 协调 ComplexityJudge → IntentAnalyzer → TemplateMatcher → LLM Planning 流程
 */

import type { MedicalEntities } from '../types.js';
import type {
  TaskDAG,
  AgentTask,
  ComplexityLevel,
  IntentAnalysis,
  ComplexityAssessment,
} from './ExecutionTypes.js';
import {
  assessComplexity,
  detectStructuredPattern,
  generateQueryHash,
} from './ComplexityJudge.js';
import { analyzeIntent } from './IntentAnalyzer.js';
import { matchTemplate } from './TemplateMatcher.js';
import { validateDAG, autoCorrectDAG } from './DAGValidator.js';

/**
 * Task Planner Prompt 模板
 */
export const TASK_PLANNER_PROMPT = `你是一个医学任务规划专家。

根据以下信息规划任务 DAG：

## 实体信息
- 疾病: {diseases}
- 药物: {drugs}
- 指标: {indicators}
- 原始查询: {query}

## 意图分析
- 查询类型: {queryTypes}
- 主要焦点: {primaryFocus}
- 特殊需求: {specialNeeds}

## 可用工具
1. **retrieve** - 检索医学文献
   - 必需参数: query (检索关键词)
   - 可选参数: topK, threshold, filters

2. **evaluate** - 评估证据质量
   - 必需参数: results (检索结果)
   - 可选参数: criteria

3. **calculate_indicator** - 计算指标阈值判断
   - 必需参数: indicator, value
   - 可选参数: unit

4. **check_contraindication** - 检查禁忌
   - 必需参数: drug
   - 可选参数: condition, indicator, threshold

5. **check_interaction** - 检查药物相互作用
   - 必需参数: drug1, drug2
   - 可选参数: source

6. **generate_answer** - 生成最终答案
   - 必需参数: context
   - 可选参数: format, maxTokens

## 规划规则

### 任务分解规则
- 每个实体至少一个 retrieve 任务
- 对比查询需要 compare 任务
- 禁忌检查需要 check_contraindication 任务
- 带指标值需要 calculate_indicator 任务

### 依赖规则
- evaluate 必须在 retrieve 之后
- generate_answer 必须在所有检索和评估之后
- calculate_indicator 必须在对应 retrieve 之后
- check_contraindication 必须在相关数据检索之后

### 并行规则
- 无依赖的 retrieve 任务可并行
- 同类型并行限制: retrieve≤3, check_contraindication≤2
- 并行组标识: parallelGroup

### 优先级规则
- 优先级 1-7，数字越小越先执行
- retrieve: 1-2
- calculate_indicator: 3
- evaluate: 4
- check_contraindication: 5
- generate_answer: 7

## 输出格式
{
  "tasks": [
    {
      "id": "unique_task_id",
      "type": "tool_type",
      "params": { ... },
      "dependencies": ["dep_task_id"],
      "priority": 1-7,
      "parallelGroup": "group_id" // 可选
    }
  ],
  "parallelGroups": ["group_id1", "group_id2"],
  "entryTasks": ["task_with_no_dependencies"],
  "exitTasks": ["final_task"]
}

## 示例输出

### 对比查询示例
{
  "tasks": [
    {"id": "retrieve_metformin", "type": "retrieve", "params": {"query": "二甲双胍"}, "dependencies": [], "priority": 1, "parallelGroup": "compare_group"},
    {"id": "retrieve_liraglutide", "type": "retrieve", "params": {"query": "利拉鲁肽"}, "dependencies": [], "priority": 1, "parallelGroup": "compare_group"},
    {"id": "compare_drugs", "type": "evaluate", "params": {"criteria": "comparison"}, "dependencies": ["retrieve_metformin", "retrieve_liraglutide"], "priority": 4},
    {"id": "generate_answer", "type": "generate_answer", "params": {"format": "comparison"}, "dependencies": ["compare_drugs"], "priority": 7}
  ],
  "parallelGroups": ["compare_group"],
  "entryTasks": ["retrieve_metformin", "retrieve_liraglutide"],
  "exitTasks": ["generate_answer"]
}

请根据上述信息输出任务 DAG。`;

/**
 * 规划结果
 */
export interface PlanningResult {
  success: boolean;
  dag?: TaskDAG;
  complexityLevel: ComplexityLevel;
  matchedTemplate?: string;
  intentAnalysis: IntentAnalysis;
  validationErrors?: string[];
  usedLLM: boolean;
}

/**
 * 规划流程
 */
export async function plan(
  entities: MedicalEntities,
  query: string,
  options?: {
    llmCall?: (prompt: string) => Promise<string>;
    enableLLMFallback?: boolean;
  }
): Promise<PlanningResult> {
  // 1. 复杂度判断
  const complexity = assessComplexity(entities, query);

  // 如果简单查询，跳过 Planning
  if (!complexity.needsPlanning) {
    return {
      success: false,
      complexityLevel: complexity.level,
      intentAnalysis: analyzeIntent(entities, query),
      usedLLM: false,
    };
  }

  // 2. 意图分析
  const intentAnalysis = analyzeIntent(entities, query);

  // 3. 模板匹配
  const templateMatch = matchTemplate(entities, intentAnalysis, query);

  if (templateMatch.matched && templateMatch.dag) {
    // 使用模板 DAG，验证后返回
    const validation = validateDAG(templateMatch.dag);
    let finalDag = templateMatch.dag;

    if (!validation.valid) {
      const correction = autoCorrectDAG(templateMatch.dag);
      if (correction.remainingErrors.length === 0) {
        finalDag = correction.correctedDag;
      }
    }

    const result: PlanningResult = {
      success: true,
      dag: finalDag,
      complexityLevel: complexity.level,
      intentAnalysis,
      usedLLM: false,
    };
    if (templateMatch.templateName) {
      result.matchedTemplate = templateMatch.templateName;
    }
    if (!validation.valid) {
      result.validationErrors = validation.errors.map(e => e.message);
    }
    return result;
  }

  // 4. LLM Planning（需要 LLM 调用）
  if (options?.enableLLMFallback && options?.llmCall) {
    const prompt = buildPlanningPrompt(entities, query, intentAnalysis);
    try {
      const response = await options.llmCall(prompt);
      const parsedDag = parsePlanningResponse(response);

      if (parsedDag) {
        // 验证并修正
        const validation = validateDAG(parsedDag);
        let finalDag = parsedDag;

        if (!validation.valid) {
          const correction = autoCorrectDAG(parsedDag);
          if (correction.remainingErrors.length === 0) {
            finalDag = correction.correctedDag;
          } else {
            // 无法修正，返回失败
            return {
              success: false,
              complexityLevel: complexity.level,
              intentAnalysis,
              validationErrors: correction.remainingErrors.map(e => e.message),
              usedLLM: true,
            };
          }
        }

        return {
          success: true,
          dag: finalDag,
          complexityLevel: complexity.level,
          intentAnalysis,
          usedLLM: true,
        };
      }
    } catch (error) {
      // LLM 调用失败
      return {
        success: false,
        complexityLevel: complexity.level,
        intentAnalysis,
        validationErrors: [`LLM planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        usedLLM: true,
      };
    }
  }

  // 无 LLM 且无模板匹配
  return {
    success: false,
    complexityLevel: complexity.level,
    intentAnalysis,
    validationErrors: ['No template matched and LLM planning not available'],
    usedLLM: false,
  };
}

/**
 * 构建规划 Prompt
 */
function buildPlanningPrompt(
  entities: MedicalEntities,
  query: string,
  intentAnalysis: IntentAnalysis
): string {
  return TASK_PLANNER_PROMPT
    .replace('{diseases}', entities.diseases.map(d => d.canonicalName).join(', ') || '无')
    .replace('{drugs}', entities.drugs.map(d => d.canonicalName).join(', ') || '无')
    .replace('{indicators}', entities.indicators.map(i => i.canonicalName).join(', ') || '无')
    .replace('{query}', query)
    .replace('{queryTypes}', intentAnalysis.queryTypes.join(', '))
    .replace('{primaryFocus}', intentAnalysis.primaryFocusEntity)
    .replace('{specialNeeds}', JSON.stringify(intentAnalysis.specialNeeds));
}

/**
 * 解析 LLM 规划响应
 */
export function parsePlanningResponse(response: string): TaskDAG | null {
  try {
    // 提取 JSON 内容
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // 验证基本结构
    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
      return null;
    }

    // 构建完整的 DAG
    const dag: TaskDAG = {
      tasks: parsed.tasks.map((t: Partial<AgentTask>) => ({
        id: t.id || `task_${Math.random().toString(36).slice(2)}`,
        type: t.type || 'retrieve',
        params: t.params || {},
        dependencies: t.dependencies || [],
        priority: t.priority || 1,
        parallelGroup: t.parallelGroup,
        fallbackStrategy: t.fallbackStrategy,
      })),
      parallelGroups: parsed.parallelGroups || [],
      entryTasks: parsed.entryTasks || parsed.tasks.filter((t: AgentTask) => t.dependencies.length === 0).map((t: AgentTask) => t.id),
      exitTasks: parsed.exitTasks || parsed.tasks.filter((t: AgentTask) => !parsed.tasks.some((other: AgentTask) => other.dependencies.includes(t.id))).map((t: AgentTask) => t.id),
    };

    return dag;
  } catch {
    return null;
  }
}

/**
 * 识别并行组
 */
export function identifyParallelGroups(tasks: AgentTask[]): string[] {
  const groups = new Set<string>();
  for (const task of tasks) {
    if (task.parallelGroup) {
      groups.add(task.parallelGroup);
    }
  }
  return Array.from(groups);
}

/**
 * 构建任务 DAG（从规划结果）
 */
export function buildTaskDAG(tasks: AgentTask[]): TaskDAG {
  const taskIds = new Set(tasks.map(t => t.id));

  // 入口任务：无依赖
  const entryTasks = tasks
    .filter(t => t.dependencies.length === 0)
    .map(t => t.id);

  // 出口任务：无下游
  const exitTasks = tasks
    .filter(t => !tasks.some(other => other.dependencies.includes(t.id)))
    .map(t => t.id);

  return {
    tasks,
    parallelGroups: identifyParallelGroups(tasks),
    entryTasks,
    exitTasks,
  };
}

/**
 * 创建任务规划器
 */
export function createTaskPlanner(): {
  plan: typeof plan;
  parseResponse: typeof parsePlanningResponse;
  buildDAG: typeof buildTaskDAG;
} {
  return {
    plan,
    parseResponse: parsePlanningResponse,
    buildDAG: buildTaskDAG,
  };
}