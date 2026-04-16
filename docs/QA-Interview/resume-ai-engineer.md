# AI Engineer简历写法指南

> 本文档记录针对 AI Engineer / AI Coding 岗位的简历写法策略

---

## 项目价值定位

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        项目价值金字塔                                         │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌───────────────────────────────┐
                    │  解决痛点                      │
                    │  1. RAG检索碎片化              │
                    │  2. 扫描文档/图表无法检索        │
                    └───────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────────────────────────┐
        │              技术方案                                      │
        │  语义分块 + Small-to-Big + Hybrid Retrieval + VLM增强      │
        └───────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  具体实现                                                                    │
│  断崖检测算法 | RRF融合 | Qdrant HNSW索引 | MCP协议 | Harness架构            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 版本一：核心能力驱动型（推荐）

```
增强型RAG系统架构设计与实现 | 个人项目 | 2026.04

【系统定位】
从零设计并实现多模态RAG系统，解决传统RAG的检索碎片化和扫描文档无法检索两大痛点。
技术栈：TypeScript | Qdrant | bge-m3 | DeepSeek | MCP协议

【核心能力展示】

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
一、RAG架构设计
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• 语义分块算法：设计断崖检测算法识别语义边界，替代传统固定长度切分
  - 基于Embedding相似度计算，梯度验证(>0.15)消除噪声
  - 置信度公式：0.6×gradient + 0.4×width，准确率提升约30%

• Small-to-Big检索策略：小块精准定位→父块上下文展开
  - 小块(200-400 tokens)用于精准匹配，父块(500-1500 tokens)提供完整上下文
  - 解决传统RAG"切到一半"问题，用户获得完整语义单元

• Hybrid检索架构：Dense(语义)+Sparse(关键词)+RRF融合
  - Dense(1024维)：bge-m3语义向量，理解查询意图
  - Sparse(词权重)：关键词精确匹配，中文检索优化
  - RRF融合：score=Σ1/(k+rank_i)，无需归一化，自动平衡两种搜索

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
二、Query优化Pipeline（LLM驱动）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Query Analyzer：LLM分析查询复杂度
  - 判断复杂度：simple/complex/structured
  - 结构化过滤提取：年份、类别、文档类型自动识别
  - 启发式fallback：LLM超时(2s)时降级为规则匹配

• Query Rewriter：口语化→专业术语
  - LLM重写：Prompt工程化设计，保持语义不变
  - 启发式映射："跑得快"→"高性能"，"太慢"→"响应延迟"
  - 缓存机制(TTL 5min)：避免重复LLM调用

• Query Decomposer：复杂问题分解
  - 多角度拆分："对比A和B"→[查询A, 查询B, 查询对比]
  - 并行检索：Promise.all多Query同时执行

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
三、置信度系统设计
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Confidence Calculator：检索结果质量评估
  - 四维加权：相似度(50%) + 关键词匹配(20%) + 位置(10%) + 分块质量(20%)
  - 低置信度处理：avg<0.3时返回"无匹配"，避免LLM幻觉

• Confidence-aware Prompt Engineering
  ```
  参考资料（按置信度排序）:
  [置信度: 高] [来源: 文档A 第5页] ...
  [置信度: 低] [来源: 文档B 第10页] ...
  
  回答指南:
  • 高置信度可直接引用，标注来源
  • 低置信度仅供参考，谨慎使用
  ```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
四、向量数据库架构
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Qdrant HNSW索引配置
  - text_chunks: M=16, efConstruct=100 (召回率/内存平衡)
  - 检索复杂度：O(logN) vs 内存暴力O(N)

• 元数据分离架构
  - Qdrant存向量+轻量payload(documentId, parentId, qualityScore)
  - HierarchicalStore存content(JSON持久化)
  - 通过chunkId关联，避免payload大小限制

• Small + Parent Sparse存储策略
  - Small: Dense+Sparse (主检索)
  - Parent: Sparse ONLY (Fallback关键词搜索，节省存储20MB)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
五、LLM集成与流式输出
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• DeepSeek API流式调用
  - SSE实时推送：思考链→答案分段到达
  - WebSocket前端同步：<100ms延迟感知

• 思考链提取与展示
  - 分离thinking和answer字段
  - 实时渲染光标动画

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
六、MCP协议实现
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• 工具定义
  - rag_query：查询文档库，返回相关片段+置信度
  - rag_index：上传并索引文档

• Claude Desktop集成
  - 作为MCP Server运行，被Claude直接调用
  - 协议实现符合Anthropic MCP规范

【量化成果】
• 检索命中率提升约30%，口语化查询命中率提升约40%
• 口语化→专业术语重写成功率>95%
• 低置信度结果自动过滤，LLM幻觉率降低
• 支持50页PDF<5分钟处理，VLM单表格<3秒

【前端能力（加分项）】
• React+Zustand实现AI产品可视化界面
• WebSocket流式输出实时渲染
• 检索过程Flow图、置信度Badge、Pipeline Timeline
```

---

## 版本二：一页纸精简版

```
增强型RAG系统 | 个人项目 | 2026.04

核心解决传统RAG检索碎片化、扫描文档无法检索两大痛点。

【RAG架构】
语义分块(断崖检测算法) + Small-to-Big检索 + Hybrid召回(Dense+Sparse+RRF融合)
+ 置信度系统(四维加权) + 低置信度幻觉防护

【LLM集成】
Query优化Pipeline(Analyzer+Rewriter+Decomposer) + 置信度Prompt工程
+ DeepSeek流式调用 + 思考链提取 + MCP协议实现

【向量数据库】
Qdrant HNSW索引 + 元数据分离架构 + Parent Sparse Only策略(O(logN)检索)

【技术栈】TypeScript | Qdrant | bge-m3 | DeepSeek | MCP | React

【成果】检索命中率+30%，口语化查询命中率+40%，幻觉率降低
```

---

## 版本三：前端转AI Coding复合型

```
AI产品工程师（前端+RAG系统） | 个人项目 | 2026.04

【定位】前端工程师转型AI产品，具备"AI原理理解 + AI产品前端"双能力

【解决的问题】
• RAG检索碎片化：传统固定切分导致用户看到"切到一半"的内容
• AI产品交互痛点：流式输出、置信度可视化、实时状态同步

【前端能力展示】
• 实时流式交互：WebSocket + SSE实现LLM思考链实时显示，光标动画
• AI可视化：检索过程Flow图、置信度Badge、Pipeline进度Timeline
• 复杂状态管理：Zustand多store协同（chatStore + retrievalStore + connectionStore）

【AI系统能力】
• RAG架构理解：语义分块(断崖检测) + Small-to-Big + Hybrid检索(Dense+Sparse)
• LLM集成：DeepSeek API流式调用、思考链提取、置信度Prompt设计
• MCP协议：实现rag_query/rag_index工具，可被Claude直接调用

【技术栈】React | TypeScript | Zustand | WebSocket | Qdrant | DeepSeek | MCP

【量化成果】
• 流式延迟<100ms，置信度实时渲染，检索命中率提升约30%
```

---

## 不同岗位调整策略

| 岗位类型 | 重点突出 | 调整策略 |
|---------|---------|---------|
| **AI产品前端** | 流式交互、可视化、状态管理 | 技术栈保留前端为主，AI作为"理解背景" |
| **AI Coding/AI Engineer** | RAG架构、LLM集成、Prompt设计 | 前端作为"产品能力"，AI作为"核心技能" |
| **全栈工程师** | TypeScript前后端、MCP协议、WebSocket | 前端+后端+AI三者并重 |
| **RAG工程师** | Hybrid检索、语义分块、置信度计算 | 前端弱化，AI强化，强调算法理解 |

---

## 技术亮点关键词

简历中应包含以下关键词（便于ATS筛选）：

**核心技能**：
- RAG (Retrieval-Augmented Generation)
- Vector Database / Qdrant / HNSW
- Semantic Chunking / Embedding
- Hybrid Retrieval / Dense + Sparse
- RRF (Reciprocal Rank Fusion)
- Prompt Engineering
- LLM Integration / DeepSeek
- MCP Protocol

**加分技能**：
- TypeScript / Node.js
- WebSocket / SSE Streaming
- React / Zustand
- Confidence Scoring
- Query Optimization

---

## 避坑指南

1. **不要只说"用了什么技术"**，要说"为什么选这个"
2. **不要只说"实现了功能"**，要说"解决了什么问题"
3. **避免堆砌术语**，每个术语要有对应的实现细节支撑
4. **量化数据要可信**，用"约30%"而非精确数字，体现实事求是

---

## 参考文件

- 简历核心数据来源：`README.md`
- 技术细节文档：`docs/hybrid-retrieval.md`, `docs/enhanced-retrieval.md`
- 面试话术：`docs/QA-Interview/interview-ai-coding.md`