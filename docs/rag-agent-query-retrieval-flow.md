# RAG 和 Agent 查询召回流程分析

> 探索时间：2026-04-22
> 探索目的：深入理解当前系统的查询处理、召回检索和 Agent 推理逻辑

---

## 1. 系统架构概览

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        用户查询入口                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
        ┌───────────────────────┐               ┌───────────────────────┐
        │    MCP Tool 入口      │               │   Medical Agent 入口   │
        │  (mcp-tool.ts)        │               │  (MedicalAgent.ts)     │
        └───────────────────────┘               └───────────────────────┘
                    │                                       │
                    │                                       ▼
                    │                           ┌───────────────────────┐
                    │                           │    实体识别            │
                    │                           │  (entity-recognizer)   │
                    │                           │                        │
                    │                           │  • 疾病词典匹配         │
                    │                           │  • 药物词典匹配         │
                    │                           │  • 指标词典匹配         │
                    │                           │  • 关系关键词匹配       │
                    │                           └───────────┬───────────┘
                    │                                       │
                    ▼                                       ▼
        ┌───────────────────────┐               ┌───────────────────────┐
        │  Enhanced Pipeline    │               │    查询规划            │
        │ (独立检索路径)         │               │  (query-planner)       │
        └───────────────────────┘               │                        │
                    │                           │  • 构建主查询           │
                    │                           │  • 扩展术语             │
                    │                           │  • 构建过滤条件         │
                    │                           │  • 构建子查询           │
                    │                           └───────────┬───────────┘
                    │                                       │
                    ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            查询处理流程                                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Enhanced Retrieval Pipeline (通用):           Medical Agent (医学):               │
│                                                                                     │
│  Stage 1: Query Analysis                       AgentExecutor.run()                  │
│  ├── LLM 分析复杂度                            ├── 初始化状态                        │
│  ├── 判断是否需要分解                          ├── 提取阈值                          │
│  └── 判断是否需要重写                          └── 安全预检查                        │
│                                                                                     │
│  Stage 2: Query Optimization                   主循环:                   │
│  ├── Rewrite (可选)                            ├── Think: MedicalReasoner.decide()   │
│  ├── Decompose (可选)                          ├── Act: 执行动作                      │
│  └── Expand                                    ├── Observe: 记录结果                  │
│                                                └── Decide: 判断是否满足              │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │    多路召回检索        │
                            └───────────────────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │    Agent 推理生成     │
                            │    三层综合回答       │
                            └───────────────────────┘
```

---

## 2. 查询分析的具体算法

### 2.1 复杂度判断流程

`QueryAnalyzer` (`src/retrieval/query-analyzer.ts`) 实现了分层的复杂度判断：

#### Step 1: 缓存检查
- TTL 缓存命中 → 直接返回缓存结果
- 缓存过期 TTL: `analysisCacheTTL` (默认配置)

#### Step 2: 快速路径 - 启发式判断（无 LLM）

```typescript
// 过滤条件检测 detectFilters(query)
/\b(20[0-2][0-9])\b/ → filters.year
/(\d+)月|month\s*(\d+)/ → filters.month
关键词映射 → filters.category ('技术'→'技术文档')

// 复杂度启发式 heuristicComplexity(query)
// Structured 检测
/\d{4}年|\d+月|第\d+章|第\d+节/.test(query) → 'structured'

// Complex 检测 (任一匹配)
复杂度指标词:
  - 对比类: '对比', '比较', '区别', '优缺点', '异同'
  - 组合类: '同时', '并且', '以及', '和', '还有'
  - 探究类: '怎么', '如何', '为什么', '原因'
  - 多目标类: '多个', '各种', '不同', '所有'

多问号检测: (query.match(/[?？]/g) || []).length > 1
长查询检测: query.length > 50

// 快速返回条件
if (complexity === 'simple' && filters.length === 0) {
  return 快速结果 (无 LLM 调用)
}
```

#### Step 3: LLM 深度分析（可选）

```typescript
// ANALYSIS_PROMPT_TEMPLATE
分析以下用户查询，返回JSON格式结果：
用户查询: "{{query}}"

请判断:
1. 复杂度: simple/complex/structured
2. 是否需要分解为子查询
3. 是否需要重写为专业术语
4. 检测到的过滤条件
5. 建议的子查询(最多5个)
6. 重写后的查询

// 超时保护: queryAnalysisTimeoutMs (默认 5000ms)
// 失败降级: 返回启发式结果
```

### 2.2 分解触发条件

`QueryDecomposer` (`src/retrieval/query-decomposer.ts`) 判断是否需要分解：

```typescript
// needsDecomposition(query) 判断规则
// ❌ 不分解条件:
query.length < 20  // 太短
无复杂度指标

// ✓ 触发分解条件:
复杂度 = 'complex'
有分解模式匹配
有多目标指标词 ('多个', '各种', '不同', '所有')

// DECOMPOSITION_PATTERNS 定义
comparison: /对比|比较|区别|异同|优缺点/
  strategy: 'parallel'
  extract: 分割 → ["二甲双胍", "利拉鲁肽"]

multiple_questions: /[?？].*[?？]/
  strategy: 'parallel'
  extract: 分割问题

and_clause: /同时|并且|以及|还|和/
  strategy: 'parallel'
  extract: 分割句子
```

### 2.3 查询重写

`QueryRewriter` (`src/retrieval/query-rewriter.ts`) 口语→专业转换：

```typescript
// needsRewriteHeuristic(query) 判断
colloquialPatterns = [
  '怎么让', '怎么搞', '咋', '咋整',
  '跑得快', '跑不动', '太慢', '太卡',
  '搞不定', '弄不了', '搞不懂',
  '更牛', '更强', '更好', '更厉害',
  '啥', '什么鬼', '怎么回事'
]

// PROFESSIONAL_TERMS 映射表
'跑得快'    → '高性能'
'跑不动'    → '性能问题'
'太慢'      → '响应延迟'
'怎么让'    → '如何实现'
'搞不定'    → '问题解决'
'更牛'      → '更优'
'啥'        → '什么'
```

### 2.4 查询扩展

`QueryExpander` (`src/retrieval/query-expander.ts`) 同义词扩展：

```typescript
// 加载 config/synonyms.json
{
  "二甲双胍": ["格华止", "美迪康"],
  "糖尿病": ["消渴症", "糖代谢病"],
  "eGFR": ["肾小球滤过率", "GFR"]
}

// 双向匹配逻辑
for (term, synonymList in synonyms):
  if (query.includes(term)):
    添加 synonymList 中未被包含的同义词
  
  if (query.includes(synonym) && !query.includes(term)):
    添加主词 term

// 例: query = "格华止禁忌"
// → 包含 "格华止" (别名)
// → 添加主词 "二甲双胍"
// → expandedTerms = ["二甲双胍"]
```

---

## 3. 召回检索的混合策略

### 3.1 三引擎架构

`search-engine.ts` 实现了三种搜索引擎：

```typescript
// SemanticSearchEngine - 纯向量相似度
async search(query, options): Promise<SearchResult[]> {
  const vector = await this.embedder(query);
  return this.vectorStore.search(vector, options);
}

// KeywordSearchEngine - BM25-inspired 词频匹配
private calculateKeywordScore(terms, content): number {
  for (term in terms):
    matches = content.match(/term/gi)
    tf = matches.length
    docLength = content.split(/\s+/).length
    // BM25-inspired formula
    score += (tf × 2.5) / (tf + 1.2 × (docLength / 100))
  return score / terms.length
}

// HybridSearchEngine - 混合检索
DEFAULT_HYBRID_WEIGHTS = { semantic: 0.7, keyword: 0.3 }

async search(query, options): Promise<SearchResult[]> {
  const [semanticResults, keywordResults] = await Promise.all([
    this.semanticEngine.search(query, options),
    this.keywordEngine.search(query, options)
  ]);
  return this.mergeResults(semanticResults, keywordResults);
}
```

### 3.2 HybridSearchEngine 权重融合

```typescript
mergeResults(semantic, keyword): SearchResult[] {
  const merged = new Map<string, SearchResult>();
  
  // Step 1: 语义结果加权
  for (result in semanticResults):
    merged.set(result.id, {
      ...result,
      score: result.score × 0.7  // 语义权重
    })
  
  // Step 2: 关键词结果加权 + 合并
  for (result in keywordResults):
    existing = merged.get(result.id)
    if (existing):
      // 双路命中，叠加分数
      existing.score += result.score × 0.3
    else:
      // 只在关键词路命中
      merged.set(result.id, {
        ...result,
        score: result.score × 0.3
      })
  
  // Step 3: 排序输出
  return Array.from(merged.values()).sort((a, b) => b.score - a.score)
}
```

**特性：双路命中的文档优先级更高**

### 3.3 RRF Fusion 算法

`rrf-fusion.ts` 实现 Reciprocal Rank Fusion：

```typescript
// 核心公式: score = Σ 1/(k + rank_i)
DEFAULT_RRF_CONFIG = { k: 60 }

rrfFusion(denseResults, sparseResults, k=60): FusionResult[] {
  const scoreMap = new Map<string, FusionResult>();
  
  // Dense 结果处理
  for (i = 0; i < denseResults.length; i++):
    rank = i + 1  // 排名从1开始
    rrfScore = 1 / (k + rank)
    scoreMap.set(result.id, { score: rrfScore, denseRank: rank })
  
  // Sparse 结果处理 + 累加
  for (i = 0; i < sparseResults.length; i++):
    rank = i + 1
    rrfScore = 1 / (k + rank)
    existing = scoreMap.get(result.id)
    if (existing):
      existing.score += rrfScore  // 双路命中叠加
      existing.sparseRank = rank
    else:
      scoreMap.set(result.id, { score: rrfScore, sparseRank: rank })
  
  return fusedResults.sort((a, b) => b.score - a.score)
}

// 例: dense #1 + sparse #3
//     score = 1/61 + 1/63 = 0.0322 (双路命中，分数叠加)
```

**优点：无需分数归一化，对不同评分尺度鲁棒**

### 3.4 HybridReranker 双模式路由

```typescript
DEFAULT_THRESHOLD = 20  // 样本数量阈值

determineMethod(resultCount): 'local-reranker' | 'internal-confidence' {
  if (resultCount <= 20 && localReranker.isReady()):
    return 'local-reranker'  // 使用本地重排模型
  
  return 'internal-confidence'  // 使用内部置信度计算
}

// 策略解释:
// - 小样本 (≤20): LocalReranker 精度高但计算慢
// - 大样本 (>20): Internal Confidence 快速且无需模型
// - 动态路由: 根据实际结果数量自动选择
```

### 3.5 ConfidenceCalculator 四因子加权评分

```typescript
DEFAULT_CONFIDENCE_WEIGHTS = {
  similarity: 0.35,      // 向量相似度权重
  keywordMatch: 0.25,    // 关键词匹配权重
  position: 0.20,        // 原始位置权重
  chunkQuality: 0.20     // 分块质量权重
}

calculateSingle(query, queryKeywords, result, position, totalResults): number {
  // 1. similarityScore = result.similarityScore (直接使用)
  
  // 2. keywordMatchScore = JaccardSimilarity(query, content)
  queryKeywords = extractKeywords(query)
  contentKeywords = extractKeywords(result.content)
  Jaccard = |intersection| / |union|
  
  // 3. positionScore = 1 - normalizedPosition × 0.5
  normalizedPosition = position / (totalResults - 1)
  // position=0 → 1.0 (最高), position=last → 0.5 (最低)
  
  // 4. chunkQualityScore = result.chunkQualityScore 或 0.5
  
  // 加权组合
  confidence = 
    0.35 × similarityScore +
    0.25 × keywordMatchScore +
    0.20 × positionScore +
    0.20 × chunkQualityScore
  
  return Math.max(0, Math.min(1, confidence))
}

// Level 阈值:
// high: confidenceScore >= 0.7
// medium: confidenceScore >= 0.4
// low: confidenceScore < 0.4
```

---

## 4. Medical Agent 三层综合回答

### 4.1 三层优先级架构

```
                    三层优先级判断
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Layer 1        │    │  Layer 2        │    │  Layer 3        │
│  Safety Layer   │    │  Retrieval      │    │  Evidence       │
│  安全层         │    │  检索层         │    │  证据层         │
│  (最高优先)     │    │  (次优先)       │    │  (标注)         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                      │                      │
        ▼                      ▼                      ▼
  禁忌/相互作用        检索结果综合           GRADE 等级
```

### 4.2 Layer 1: Safety Layer 安全层

`src/medical/safety-layer.ts` 实现安全预检查：

```typescript
performSafetyCheck(entities, thresholds): SafetyAssessment {
  // Step 1: 禁忌阈值匹配
  checkContraindications(drugs, thresholds):
    for (drug in drugs):
      contraindications = getContraindicationsByDrug(drug.id)
      for (contra in contraindications):
        if (matchesThreshold(patientValue, contraThreshold)):
          matches.push({ contra, extracted, severity })
  
  // 例: 二甲双胍 + eGFR=35
  // contra: eGFR < 30 → absolute 禁忌
  // patientValue=35 不满足 <30
  // 但 eGFR < 45 → relative 慎用
  // matches: [{ severity: 'relative', ... }]
  
  // Step 2: 药物相互作用检测
  checkInteractions(drugs):
    for (drugId in drugIds):
      interactions = getInteractionsByDrug(drugId)
      if (drugIds.includes(interaction.partner)):
        interactions.push(interaction)
  
  // Step 3: 严重程度判定 (优先级)
  if (有 absolute 禁忌):      severity = 'absolute'
  elif (有 relative 禁忌):    severity = 'relative'
  elif (有相互作用):          severity = 'interaction'
  else:                       severity = 'safe'
  
  return { severity, contraindicationMatches, interactions, recommendation, sourceGlossary }
}
```

### 4.3 Layer 2: Evidence Evaluation 证据质量评估

`src/medical/evidence-evaluator.ts` 实现：

```typescript
// 文献类型识别关键词映射
LITERATURE_TYPE_KEYWORDS = {
  rct: ['RCT', 'Randomized Controlled Trial', '随机对照试验', '双盲'],
  meta_analysis: ['Meta', 'Meta分析', '荟萃分析', '系统评价'],
  guideline: ['指南', 'Guideline', '标准', '共识', '建议'],
  observational: ['观察', '队列研究', '回顾性', '前瞻性'],
  case_report: ['病例报告', 'Case Report', '个案'],
  expert_opinion: ['专家', '意见', '观点', '综述']
}

// GRADE 等级映射
mapEvidenceGrade(literatureType): GradeLevel {
  rct / meta_analysis  →  Grade A (高质量证据)
  guideline           →  Grade B (中等质量证据)
  observational       →  Grade C (低质量证据)
  case_report / expert_opinion → Grade D (极低质量证据)
}

// 整体 GRADE 计算: 取最高等级
calculateOverallGrade(evaluations): GradeLevel {
  for grade in ['A', 'B', 'C', 'D']:
    if (grades.includes(grade)) return grade
}

// 时效性检查
checkTimeliness(year, guidelineId):
  year > guidelineExpirationYears (默认5年):
    isCurrent = false, warning = "可能已过期"
  year > 3年:
    isCurrent = true, warning = "建议确认是否有更新版"
```

### 4.4 三层综合回答生成

`MedicalReasoner.parseAnswer()` 实现三层决策：

```typescript
parseAnswer(response, entities, retrievalResults, safetyAssessment, evidenceEvaluation): MedicalAnswer {
  // Conclusion 三层优先级判断
  if (safetyAssessment?.severity === 'absolute'):
    // Layer 1 最高优先
    conclusionText = safetyAssessment.recommendation
    conclusionConfidence = 'high'
  
  elif (safetyAssessment?.severity === 'relative'):
    // Layer 1 + Layer 2 混合
    conclusionText = "慎用：" + recommendation
    conclusionConfidence = 'high'
  
  elif (safetyAssessment?.severity === 'interaction'):
    // Layer 1 相互作用
    conclusionText = "药物相互作用：" + recommendation
    conclusionConfidence = 'high'
  
  else:
    // Layer 2 主导
    conclusionText = sections.conclusion
    conclusionConfidence = entities.confidence > 0.8 ? 'high' : 'medium'
  
  // Details 详细说明构建
  buildDetailPoints():
    // 优先添加安全层信息
    if (safetyAssessment.contraindicationMatches.length > 0):
      添加禁忌描述
  
    // 添加相互作用信息
    if (safetyAssessment.interactions.length > 0):
      添加相互作用 + 建议
  
    // 添加检索结果详细说明
    添加 sections.details (带来源引用)
  
  // Evidence Grade 构建
  buildEvidenceGrade(evidenceEvaluation):
    if (evidenceEvaluation.length > 0):
      grade = calculateOverallGrade(evidenceEvaluation)
      sourceType = evidenceEvaluation[0]?.literatureType
    else:
      grade = extractGrade(response)  // 降级从 LLM 响应提取
  
  // Sources 收集
  collectSources():
    检索结果来源 + 安全评估指南来源
  
  return {
    conclusion: { text, confidence },
    details: { points },
    evidenceGrade: { grade, sourceType },
    sources: [...],
    warnings: ["本回答仅供参考，不构成医疗建议"]
  }
}
```

### 4.5 Agent Prompts 四阶段

`src/medical/agent/AgentPrompts.ts` 定义：

```typescript
// THINK_PROMPT - Think 阶段
输入: { entities, iteration, retrievalResults, reasoningTrace }
输出格式:
ACTION: <retrieve|expand_query|answer|need_more>
REASON: <分析>
CONFIDENCE: <0-1>

// DECIDE_PROMPT - Decide 阶段
判断标准:
1. 至少有 1 个相关检索结果
2. 检索结果包含实体相关信息
3. 能够回答用户的核心问题
输出: "SATISFIED" 或 "NOT SATISFIED"

// ANSWER_PROMPT - 回答生成
输出格式要求:
## 结论
## 详细说明
## 证据等级
## 来源引用
## 注意事项

// QUALITY_PROMPT - 质量检查
检查标准:
1. 结论是否明确、准确
2. 是否有足够的证据支持
3. 来源是否可追溯
4. 是否有适当的警告提示
输出格式:
STATUS: <VALID|INVALID>
ISSUES: [问题列表]
SUGGESTIONS: [建议列表]
```

---

## 5. 当前架构的问题总结

| 问题 | 影响 | 根因 |
|------|------|------|
| 无任务分解 | 复杂查询无法处理 | 每轮只做单一决策 |
| 线性执行 | 检索效率低 | 无并行调度机制 |
| 无上下文管理 | Token 超限风险 | 无 Token 计数 |
| 无自我修正 | 答案质量不稳定 | 无 Re-planning 机制 |

---

## 6. 相关文件索引

| 模块 | 文件路径 | 主要功能 |
|------|----------|----------|
| 查询分析 | `src/retrieval/query-analyzer.ts` | 复杂度判断、过滤条件检测 |
| 查询分解 | `src/retrieval/query-decomposer.ts` | 复杂查询分解为子查询 |
| 查询重写 | `src/retrieval/query-rewriter.ts` | 口语→专业术语转换 |
| 查询扩展 | `src/retrieval/query-expander.ts` | 同义词扩展 |
| 搜索引擎 | `src/retrieval/search-engine.ts` | 语义/关键词/混合三引擎 |
| RRF融合 | `src/retrieval/rrf-fusion.ts` | Reciprocal Rank Fusion |
| 重排器 | `src/retrieval/hybrid-reranker.ts` | 双模式路由重排 |
| 置信度计算 | `src/retrieval/confidence-calculator.ts` | 四因子加权评分 |
| 实体识别 | `src/medical/entity-recognizer.ts` | 医学实体词典匹配 |
| 查询规划 | `src/medical/query-planner.ts` | 检索策略构建 |
| 安全层 | `src/medical/safety-layer.ts` | 禁忌阈值匹配、相互作用检测 |
| 证据评估 | `src/medical/evidence-evaluator.ts` | GRADE 等级计算 |
| Agent执行器 | `src/medical/agent/AgentExecutor.ts` | ReAct 循环执行 |
| Agent推理器 | `src/medical/agent/MedicalReasoner.ts` | LLM 推理决策 |
| Agent提示词 | `src/medical/agent/AgentPrompts.ts` | 四阶段 Prompt 模板 |

---

## 下一步探索

参见 [`rag-agent-planandexecute-improvements.md`](./rag-agent-planandexecute-improvements.md) 了解 PlanAndExecute 模式如何改进现有架构。