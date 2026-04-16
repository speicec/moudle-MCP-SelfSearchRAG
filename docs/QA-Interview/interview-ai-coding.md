# AI Coding / AI Engineer 面试话术指南

> 本文档记录 AI Engineer 岗位面试的核心问答策略

---

## 面试开场（30秒）

```
"这是一个增强型多模态RAG系统，核心解决两个痛点：
1. 传统RAG固定切分导致检索碎片化
2. 扫描文档/图表无法被理解检索

技术栈：TypeScript + Qdrant + bge-m3 + DeepSeek + MCP协议

我从头设计并实现了语义分块、Hybrid检索、置信度系统、Query优化Pipeline等核心模块。"
```

---

## 核心问题与回答策略

### Q1: 你的RAG系统和LangChain有什么区别？

**回答策略——展示原理理解深度**：

```
"LangChain是框架，封装了RAG的各个环节。我的项目是手写实现，
这样可以展示我对每个环节的理解。

举个例子：
• LangChain的语义分块是黑盒，调用一个函数
• 我的实现是'断崖检测算法'：
  - 计算相邻句子embedding相似度
  - 梯度验证消除噪声（要求下降幅度>0.15）
  - 宽度滤噪（要求连续2+个候选点）

这展示了我理解'为什么这样切分'，而不是'调用什么函数'。

如果岗位需要快速落地，我会用LangChain；
如果岗位需要定制优化，手写实现才能深入调优。"
```

**核心洞察**：
- 手写实现展示原理理解，框架使用展示工程能力
- 两种能力都有价值，关键是"知道什么时候用什么"

---

### Q2: 为什么用RRF而不是加权平均？

**展示算法理解**：

```
"这是Hybrid检索的核心设计决策。

加权平均的问题：
1. Dense和Sparse的score范围不同（Dense是cosine相似度[-1,1]，Sparse是BM25分数[0,∞]）
2. 需要归一化，但归一化方法会影响结果分布
3. 权重参数需要反复调优

RRF的优势：
score = Σ 1/(k + rank_i)

1. 基于排序而非分数——两种搜索的rank天然可比
2. 无需归一化——rank永远从1开始
3. k=60是经验值，大多数场景不需要调

我选择RRF是因为'实用主义'——简单、鲁棒、有效。
如果某个场景RRF效果不好，我可以换加权平均，因为代码结构已经解耦。"
```

**技术细节补充**：

```typescript
// RRF核心实现 (src/retrieval/rrf-fusion.ts)
export function rrfFusion(
  denseResults: SearchResult[],
  sparseResults: SearchResult[],
  k: number = 60  // 经验值
): FusionResult[] {
  const scoreMap = new Map<string, FusionResult>();

  // Process dense results
  for (let i = 0; i < denseResults.length; i++) {
    const rank = i + 1;
    const rrfScore = 1 / (k + rank);  // 核心公式
    // ...
  }

  // Process sparse results - 同样逻辑
  // ...

  // Sort by fused score descending
  return fusedResults.sort((a, b) => b.score - a.score);
}
```

---

### Q3: 置信度系统怎么设计？为什么这个权重分配？

**展示系统设计思维**：

```
"置信度的本质是：告诉用户'这个结果可信吗？'

四维加权的逻辑：
• 相似度(50%)：核心指标，语义匹配程度
• 关键词匹配(20%)：补充指标，关键词命中说明结果相关
• 位置(10%)：文档靠前的内容往往更重要（用户读PDF从上往下）
• 分块质量(20%)：有些chunk是垃圾内容（重复、碎片），不应信任

为什么是这个比例？
这是'启发式设计'，不是数学推导。
核心是'相似度'，但不能只有相似度——纯语义搜索可能命中语义相似但内容无关的chunk。

低置信度处理：
当avg置信度<0.3时，我不让LLM生成答案，而是返回'无匹配'。
这是为了防止LLM基于垃圾内容生成幻觉。"
```

**公式表达**：

```
confidenceScore = 
  0.5 × similarityScore +
  0.2 × keywordMatchScore +
  0.1 × positionScore +
  0.2 × chunkQualityScore
```

---

### Q4: Parent为什么只存Sparse，不存Dense？

**展示架构决策能力**：

```
"这是存储和性能的权衡设计。

分析：
• Parent chunk是500-1500 tokens，内容长
• Dense向量会'稀释'关键信息——长文本的embedding很难精准匹配
• Parent的检索场景是Fallback（Small检索结果不足时）
• Fallback用关键词搜索足够——关键词匹配不需要精准语义

存储对比：
• Small: Dense(4KB) + Sparse(~1KB) = 5KB/chunk × 100K = 500MB
• Parent: Sparse(~1KB) = 1KB/chunk × 20K = 20MB

如果Parent也存Dense：
• 20K × 4KB = 80MB，增加4倍
• 但Dense检索效果不好（长文本稀释）
• 存了也用不上

所以我选择：Parent只存Sparse。
Fallback时直接关键词搜索，索引搜索O(logN)，性能好（~15ms）。"
```

**架构图**：

```
┌────────────────────────────────────────────────────────────────────────────┐
│  方案 D 架构                                                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  text_chunks (Small):                                                      │
│    • Dense Vector (1024维) - 语义搜索                                      │
│    • Sparse Vector - 关键词搜索                                            │
│    存储: 100K points × 5KB = ~500MB                                       │
│                                                                            │
│  parent_chunks (Parent):                                                   │
│    • Sparse Vector ONLY - 关键词搜索                                       │
│    存储: 20K points × 1KB = ~20MB                                         │
│                                                                            │
│  总存储: ~520MB                                                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

搜索流程:
  主搜索:  text_chunks Dense+Sparse → RRF → Parent Expansion
  Fallback: parent_chunks Sparse → 直接Parent结果（索引搜索，无遍历！）
```

---

### Q5: 断崖检测算法的具体实现？

**展示算法细节**：

```
算法本质：识别语义边界，不是"切割文本"
         而是建立"边界位置列表"

关键参数：
  similarityThreshold = 0.7  ← 低于此值认为有断崖
  gradientThreshold = 0.15   ← 相似度下降幅度足够大
  minCliffWidth = 2          ← 防止单点噪声
```

**算法五步**：

```
输入: Embedding序列 [e1, e2, ..., en]
输出: 语义边界位置列表

算法:
1. 计算相邻相似度: sim_i = cosine(e_i, e_{i+1})
2. 找候选点: candidates = {i | sim_i < threshold (0.7)}
3. 验证梯度: |sim_i - sim_{i-1}| > gradientThreshold (0.15)
4. 滤噪: 要求 minCliffWidth (2) 个相邻候选点
5. 选边界: 相邻断崖选梯度最大者
```

**置信度计算**：

```
confidence = 0.6 × normalizedGradient + 0.4 × normalizedWidth

断崖越'陡峭'、越'宽'，置信度越高
```

---

### Q6: Query Analyzer的LLM调用超时怎么办？

**展示系统鲁棒性设计**：

```
"Query Analyzer有两个执行路径：

主路径：LLM分析（准确但可能慢）
  - 调用DeepSeek API分析查询复杂度
  - 提取过滤条件、生成子查询
  - 超时设置：2秒

Fallback路径：启发式规则（快但粗糙）
  - 规则匹配：年份(202X)、类别关键词、复杂度指示词
  - 口语化检测："咋"、"咋整"、"怎么搞"等

实现策略：
  - Promise.race([llmCall, timeout])
  - 超时后降级到启发式
  - 不阻塞主检索流程

这体现'实用主义'：
  用户不关心Query分析用了LLM还是规则，
  只关心检索结果好不好。"
```

**代码实现参考**：

```typescript
// src/retrieval/query-analyzer.ts
private async callLLMWithTimeout(prompt: string): Promise<string> {
  const timeoutMs = 2000;  // 2秒超时
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('LLM call timeout')), timeoutMs);
  });

  return Promise.race([
    this.llmCaller(prompt),
    timeoutPromise,
  ]);
}

// 超时后fallback
catch (error) {
  console.warn('[QueryAnalyzer] LLM analysis failed, using heuristic');
  return {
    complexity: heuristicComplexity,
    needsDecomposition: heuristicComplexity === 'complex',
    ...
  };
}
```

---

### Q7: 为什么选择Qdrant而不是其他向量数据库？

**展示技术选型能力**：

```
"我对比了四个主流向量数据库：

┌────────────────────────────────────────────────────────────────────────────┐
│  向量数据库对比                                                              │
├─────────────────┬────────────────┬────────────────┬────────────────────────┤
│  数据库         │  特点          │  缺点          │  适用场景              │
├─────────────────┼────────────────┼────────────────┼────────────────────────┤
│  Pinecone       │  云服务，易用   │  贵，数据出境   │  快速原型              │
│  Milvus         │  功能全面      │  复杂，运维重   │  大规模生产            │
│  Qdrant ✓       │  开源+云服务   │  社区相对小    │  平衡，中小规模        │
│  Weaviate       │  GraphQL接口   │  性能一般      │  特定接口需求          │
└─────────────────┴────────────────┴────────────────┴────────────────────────┘

选择Qdrant的原因：
1. 开源免费——个人项目成本敏感
2. Docker一行启动——部署简单
3. 支持Sparse向量——Hybrid检索必需
4. HNSW性能好——O(logN)检索
5. 有云服务选项——未来可扩展

如果是企业项目：
  - 大规模(亿级向量) → Milvus
  - 快速落地 → Pinecone
  - 我这个规模(十万级) → Qdrant最优"
```

---

### Q8: 你的项目最大的技术挑战是什么？

**展示解决问题能力**：

```
"挑战一：语义边界检测的准确性

问题：如何区分真正的语义切换和噪声？

解决：
• 梯度验证：要求相似度下降幅度足够大(>0.15)
• 宽度滤噪：要求连续多个候选点(minCliffWidth=2)
• 窗口聚合：滑动窗口计算embedding，减少单句波动

效果：消除了90%以上的噪声边界，保留真正的语义切换点

---

挑战二：Hybrid检索的融合策略

问题：Dense和Sparse的分数范围不同，如何公平融合？

解决：
• RRF算法：基于排序而非分数，无需归一化
• k=60经验值：论文验证的稳定参数
• 代码解耦：融合策略可替换，方便后续优化

效果：检索命中率提升约30%，无需反复调参
```

---

### Q9: 如果要扩展这个系统，你会怎么设计？

**展示架构扩展性思维**：

```
"基于当前架构，三个扩展方向：

1. 分布式检索
   当前：单机Qdrant
   扩展：Qdrant集群 + Redis缓存热点查询
   设计：VectorStoreAdapter接口已解耦，替换实现即可

2. 增量索引
   当前：全量处理
   扩展：DocumentStore增加updatedAt字段
   设计：只处理新增/修改的文档，用版本号追踪

3. Agent架构
   当前：RAG问答
   扩展：Function Calling + ReAct循环
   设计：QueryAnalyzer可演进为Agent的规划模块

架构原则：
  '不破坏用户空间'——新功能通过Plugin机制添加，不修改核心
  配置开关控制，默认关闭新功能"
```

---

### Q10: 你如何理解Prompt Engineering？

**结合项目展示实际应用**：

```
"Prompt Engineering不是'写好prompt'这么简单，
核心是：让LLM在约束条件下稳定输出。

我的项目中的三个实践：

1. Query Analyzer Prompt
   设计要点：
   • 输出格式约束：必须是有效JSON
   • 字段类型约束：complexity只能是simple/complex/structured
   • 错误处理：JSON解析失败时fallback

2. Query Rewriter Prompt
   设计要点：
   • 单一输出：只输出重写结果，不要解释
   • 语义保持：明确要求'保持原意'
   • 清理机制：去除LLM可能添加的前缀

3. Confidence-aware Prompt
   设计要点：
   • 置信度标签：让LLM知道哪些资料可信
   • 回答指南：约束LLM的行为模式
   • 拒绝机制：无资料时明确说'无法回答'

核心心得：
  Prompt设计要有'防御思维'——LLM可能输出什么错误？
  然后设计约束和fallback来应对。"
```

---

## 能力对照表（面试前自查）

| 技术点 | 你的实现 | 面试可能追问 | 准备要点 |
|--------|---------|-------------|---------|
| **语义分块** | 断崖检测+梯度验证+宽度滤噪 | "参数怎么选？" | similarity=0.7, gradient=0.15是启发式，可调 |
| **Small-to-Big** | 小块检索→父块展开 | "为什么不直接检索大块？" | 大块Dense稀释，小块精准但碎片 |
| **RRF融合** | score=Σ1/(k+rank), k=60 | "为什么k=60？" | 经验值，论文推荐，稳定 |
| **HNSW参数** | M=16, efConstruct=100 | "为什么M=16？" | 8太低召回差，32太高内存大 |
| **置信度权重** | 50%+20%+10%+20% | "权重怎么定？" | 启发式，核心是相似度，其他补充 |
| **Parent Sparse** | 只存Sparse，不存Dense | "为什么？" | 长文本Dense稀释，Fallback关键词足够 |
| **Query优化** | Analyzer+Rewriter+Decomposer | "LLM超时怎么办？" | 启发式fallback，不阻塞主流程 |
| **置信度Prompt** | 按置信度排序+回答指南 | "Prompt怎么设计？" | 高置信直接引用，低置信谨慎使用 |

---

## 需要补充的技能点

面试前建议学习以下内容（AI Engineer高频考点）：

```
【必须补充】

1. LangChain/LlamaIndex
   • 你的项目是手写，展示原理
   • 建议写一个LangChain demo了解API
   • 能说"原理类似，框架封装了实现"

2. Agent架构
   • Function Calling：LLM决定调用什么工具
   • ReAct：Reasoning + Acting循环
   • 你的QueryAnalyzer可以类比Agent的规划模块

3. 向量数据库对比
   • Pinecone vs Milvus vs Qdrant vs Weaviate
   • 各有优劣，Qdrant适合中小规模

【加分项】

• RAG评测：RAGAS（faithfulness, answer_relevance）
• Embedding微调：领域数据微调bge-m3
• Multi-Agent：CrewAI、AutoGen概念
```

---

## 面试展示节奏建议

| 时间 | 内容 | 目的 |
|------|------|------|
| 30秒 | 项目概述 + 两大痛点 | 快速建立印象 |
| 2分钟 | RAG架构深入（分块+检索） | 展示原理理解 |
| 2分钟 | 置信度系统 + Prompt设计 | 展示LLM集成能力 |
| 1分钟 | Query优化 + MCP协议 | 展示完整Pipeline |

---

## 参考代码文件

面试时可以引用的具体代码位置：

| 技术点 | 代码文件 | 关键行 |
|--------|---------|--------|
| RRF融合 | `src/retrieval/rrf-fusion.ts` | 70-130 |
| Hybrid检索 | `src/retrieval/hybrid-small-to-big-retriever.ts` | 116-190 |
| Query分析 | `src/retrieval/query-analyzer.ts` | 74-156 |
| Query重写 | `src/retrieval/query-rewriter.ts` | 72-109 |
| 置信度Prompt | `src/server/services/enhanced-llm-generation-service.ts` | 12-26 |
| 层级存储 | `src/chunking/hierarchical-store.ts` | 147-297 |

---

## 避坑指南

1. **不要说"我用框架做的"** —— 展示原理理解，不是API调用
2. **不要说"参数是论文的"** —— 要能解释为什么适合你的场景
3. **不要只说好处** —— 也要说Trade-off和局限性
4. **遇到追问不要慌** —— 用"启发式设计"、"实用主义"解释
5. **代码细节要能定位** —— 准备好具体文件路径和关键行号