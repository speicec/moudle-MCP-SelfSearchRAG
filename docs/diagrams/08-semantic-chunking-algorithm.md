# 语义分块算法 (Semantic Chunking — Cliff Detection)

```plantuml
@startuml
skinparam backgroundColor #f0f4f8
skinparam defaultFontSize 10
skinparam activityBackgroundColor #e0e7ff
skinparam activityBorderColor #6366f1

title 断崖检测算法 (Cliff Detection Algorithm)

start

:输入: 文本段落\n(经过 sentence split);

partition "Step 1: 句子嵌入 (Sentence Embedding)" {
  :将文本按句子切分\nsentences = [s1, s2, ..., sn];
  :对每个句子生成嵌入向量\nembeddings = [e1, e2, ..., en];
  note right
    嵌入模型:
    • API: text-embedding-3-small
    • Local: multilingual-e5-small (384d)
    • Hybrid: BGE-M3 (1024d Dense + Sparse)
  end note
}

partition "Step 2: 计算相邻相似度" {
  :遍历 i = 1 到 n-1\nsim_i = cosine(e_i, e_{i+1});
  :输出相似度序列\nsims = [sim_1, sim_2, ..., sim_{n-1}];
  note right
    例如: [0.85, 0.82, 0.78, 0.45, 0.72, 0.68]
                          ↑ 断崖点 (0.78→0.45)
  end note
}

partition "Step 3: 找候选断崖点" {
  :筛选相似度低于阈值的位置\ncandidates = {i | sim_i < similarityThreshold};
  note right
    similarityThreshold = 0.7 (可配置)
    candidates = [3, 6, 9]
  end note
}

partition "Step 4: 梯度验证" {
  :计算每个候选点的梯度\ngradient_i = |sim_i - sim_{i-1}|;

  if (gradient_i > gradientThreshold?) then (是)
    :保留为验证断崖点;
  else (否)
    :排除（平缓下降，非断崖）;
  endif

  note right
    gradientThreshold = 0.15 (可配置)

    例如:
    gradient_3 = |0.45 - 0.78| = 0.33 > 0.15 ✓
    gradient_6 = |0.55 - 0.68| = 0.13 < 0.15 ✗
    gradient_9 = |0.42 - 0.55| = 0.13 < 0.15 ✗

    validated = [3]
  end note
}

partition "Step 5: 噪点过滤" {
  :要求 minCliffWidth 个相邻候选点;

  if (连续候选点数量 >= minCliffWidth?) then (是)
    :保留为真实断崖;
  else (否)
    :过滤（孤立噪点）;
  endif

  note right
    minCliffWidth = 2 (可配置)
    validated = [3] 只有1个点 → 过滤
    若有 [3, 4] 连续2个点 → 保留
  end note
}

partition "Step 6: 选最终边界" {
  :相邻断崖取梯度最大者;
  :输出：语义边界位置列表\nboundaries = [b1, b2, ...];
}

partition "Step 7: 层级 Chunk 构建" {
  :按边界将文本切分为 Parent Chunks\n(每个 1000-2000 tokens);
  :每个 Parent Chunk 内部再切分\n为 Small Chunks (每个 200-500 tokens);
  :构建父子映射关系\nchild.parentId = parent.id;
}

partition "Step 8: Structure Boundary 检测" {
  :检测文档结构边界\n标题/段落/列表/表格/图片;
  :结合语义边界和结构边界\n避免在结构内部切分;
}

partition "Step 9: 质量过滤 (QualityFilter)" {
  :检查每个 Chunk 质量;

  if (Chunk 长度 < minChunkLength?) then (是)
    :合并到相邻 Chunk;
  elseif (Chunk 长度 > maxChunkLength?) then (是)
    :强制再切分;
  elseif (内容为空或仅含标点?) then (是)
    #pink:丢弃;
  else (否)
    :通过质量检查;
  endif
}

:输出: Parent Chunks + Small Chunks\n存入 HierarchicalStore;

stop

@enduml
```

## 算法参数配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `similarityThreshold` | 0.7 | 余弦相似度低于此值视为候选断崖 |
| `gradientThreshold` | 0.15 | 相邻相似度变化幅度阈值 |
| `minCliffWidth` | 2 | 最小连续断崖点数（过滤噪点） |
| `parentChunkTokens` | 1000-2000 | 父块大小范围 |
| `smallChunkTokens` | 200-500 | 子块大小范围 |
| `minChunkLength` | 50 chars | 最小分块长度（低于则合并） |
| `maxChunkLength` | 4000 chars | 最大分块长度（超过则强制再切） |

## 设计原理

1. **断崖检测** 基于语义相似度突变，而非固定长度 —— 保持上下文完整性
2. **梯度验证** 区分真正的主题切换和自然的话题漂移
3. **噪点过滤** 避免因个别句子异常导致的过度切分
4. **结构边界融合** 结合文档格式（标题/表格/列表）避免破坏文档结构
5. **Small-to-Big** 层级设计：小块精准检索 + 大块完整上下文
