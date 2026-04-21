/**
 * Agent Prompts - Agent 提示词模板
 *
 * 定义医学 Agent 各阶段的提示词
 */

import type {
  MedicalEntities,
  MedicalAnswer,
  SourceCitation,
} from '../types.js';

/**
 * Think 阶段提示词 - 分析当前状态
 */
export function THINK_PROMPT(context: {
  entities: MedicalEntities;
  iteration: number;
  retrievalResults?: Array<{
    content: string;
    source: SourceCitation;
  }>;
  reasoningTrace: string[];
}): string {
  const { entities, iteration, retrievalResults, reasoningTrace } = context;

  return `你是一个医学推理助手。请分析当前状态并决策下一步行动。

## 当前状态
- 迭代次数: ${iteration}
- 已识别实体:
  - 疾病: ${entities.diseases.map(d => d.canonicalName).join(', ') || '无'}
  - 药物: ${entities.drugs.map(d => d.canonicalName).join(', ') || '无'}
  - 指标: ${entities.indicators.map(i => i.canonicalName).join(', ') || '无'}
- 置信度: ${entities.confidence}

## 检索结果
${retrievalResults && retrievalResults.length > 0
  ? retrievalResults.map(r => `- ${r.content.slice(0, 100)}... (来源: ${r.source.documentName})`).join('\n')
  : '暂无检索结果'}

## 推理历史
${reasoningTrace.length > 0 ? reasoningTrace.map(t => `- ${t}`).join('\n') : '暂无历史'}

## 请分析并决策
1. 当前信息是否足够回答用户问题？
2. 如果不够，需要什么行动？
3. 给出你的决策和置信度（0-1）

请以以下格式回复：
ACTION: <retrieve|expand_query|answer|need_more>
REASON: <你的分析>
CONFIDENCE: <0-1的数字>`;
}

/**
 * Decide 阶段提示词 - 决策判断
 */
export function DECIDE_PROMPT(context: {
  entities: MedicalEntities;
  retrievalResults?: Array<{
    content: string;
    source: SourceCitation;
  }>;
  iteration: number;
}): string {
  const { entities, retrievalResults, iteration } = context;

  return `你是一个医学推理助手。请判断是否满足回答条件。

## 当前状态
- 迭代次数: ${iteration}
- 实体数量: ${entities.diseases.length + entities.drugs.length + entities.indicators.length} 个
- 检索结果数量: ${retrievalResults?.length ?? 0} 个

## 判断标准
满足条件需要：
1. 至少有 1 个相关检索结果
2. 检索结果包含实体相关信息
3. 能够回答用户的核心问题

## 请判断
当前状态是否满足回答条件？

回复 "SATISFIED" 或 "NOT SATISFIED"，并简要说明原因。`;
}

/**
 * Answer 阶段提示词 - 回答生成
 */
export function ANSWER_PROMPT(context: {
  entities: MedicalEntities;
  retrievalResults?: Array<{
    content: string;
    source: SourceCitation;
  }>;
}): string {
  const { entities, retrievalResults } = context;

  return `你是一个医学助手，需要生成结构化的医学回答。

## 用户查询
${entities.rawQuery}

## 已识别实体
- 疾病: ${entities.diseases.map(d => d.canonicalName).join(', ') || '无'}
- 药物: ${entities.drugs.map(d => d.canonicalName).join(', ') || '无'}
- 指标: ${entities.indicators.map(i => i.canonicalName).join(', ') || '无'}
- 关系关键词: ${entities.relations.map(r => r.matchedTerm).join(', ') || '无'}

## 检索结果
${retrievalResults && retrievalResults.length > 0
  ? retrievalResults.map((r, i) => `[${i + 1}] ${r.content}\n来源: ${r.source.documentName}${r.source.year ? ` (${r.source.year})` : ''}`).join('\n\n')
  : '暂无检索结果'}

## 请生成回答
请用以下格式生成医学回答：

## 结论
<简明扼要的结论，1-2句话>

## 详细说明
- <要点1>
- <要点2>
- <要点3>

## 证据等级
Grade <A/B/C/D> - <来源类型>

## 来源引用
1. <来源1>
2. <来源2>

## 注意事项
<重要提醒事项>`;
}

/**
 * Quality 阶段提示词 - 质量检查
 */
export function QUALITY_PROMPT(context: {
  answer: MedicalAnswer;
}): string {
  const { answer } = context;

  return `你是一个医学回答质量检查员。请检查以下回答的质量。

## 回答内容
### 结论
${answer.conclusion.text}
置信度: ${answer.conclusion.confidence}

### 详细说明
${answer.details.points.map(p => `- ${p.text}`).join('\n')}

### 证据等级
Grade ${answer.evidenceGrade.grade} - ${answer.evidenceGrade.sourceType}

### 来源引用
${answer.sources.map(s => `- ${s.documentName}${s.year ? ` (${s.year})` : ''}`).join('\n') || '无'}

### 注意事项
${answer.warnings.map(w => `- ${w}`).join('\n')}

## 检查标准
1. 结论是否明确、准确
2. 是否有足够的证据支持
3. 来源是否可追溯
4. 是否有适当的警告提示
5. 是否避免了过度推测

## 请检查
回答质量是否合格？如有问题请列出，并给出改进建议。

回复格式：
STATUS: <VALID|INVALID>
ISSUES:
- <问题1>
- <问题2>
SUGGESTIONS:
- <建议1>
- <建议2>`;
}

/**
 * Entity 提示词 - 实体识别辅助
 */
export function ENTITY_PROMPT(query: string): string {
  return `请从以下医学查询中识别关键实体：

查询: "${query}"

请识别：
1. 疾病名称（如糖尿病、高血压）
2. 药物名称（如二甲双胍、胰岛素）
3. 指标名称（如eGFR、血糖）
4. 关系关键词（如禁忌、慎用、相互作用）

以 JSON 格式回复：
{
  "diseases": ["疾病1", "疾病2"],
  "drugs": ["药物1", "药物2"],
  "indicators": ["指标1"],
  "relations": ["禁忌"]
}`;
}

/**
 * Query Expansion 提示词 - 查询扩展
 */
export function EXPAND_PROMPT(context: {
  entities: MedicalEntities;
  currentQuery: string;
}): string {
  const { entities, currentQuery } = context;

  return `请扩展以下医学查询词以提高检索覆盖率：

原始查询: "${currentQuery}"

已识别实体:
- 疾病: ${entities.diseases.map(d => d.canonicalName).join(', ') || '无'}
- 药物: ${entities.drugs.map(d => d.canonicalName).join(', ') || '无'}

请生成扩展查询词（包括别名、同义词、相关术语）：

以 JSON 数组格式回复：
["扩展词1", "扩展词2", "扩展词3"]`;
}