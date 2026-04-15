# QA-1: RAG系统切分、召回、重排全流程技术细节

> 问题：这个RAG中的切分，召回，重排等等全流程环节技术细节是怎么实现的？

---

## 一、系统全流程架构图

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                        MY-RAG-MCP-SERVER 完整RAG流程                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

                        ┌──────────────────────────────────────────────────┐
                        │              文档上传                            │
                        │         POST /api/documents/upload               │
                        └──────────────────────┬───────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              Stage 1: INGEST (摄入)                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  Validator Plugin                                                                            │
│  • 验证文件格式 (PDF/Image/Text)                                                              │
│  • 生成documentId (UUID)                                                                     │
│  • 初始化Context对象                                                                         │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              Stage 2: PARSE (解析)                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  PdfParser Plugin (普通PDF)                                                                  │
│  • pdf-parse提取文本层                                                                       │
│  • 输出: textBlocks, tables, images, formulas                                                │
│  • ContentPosition: 页码 + bbox坐标                                                          │
│                                                                                              │
│  if totalText === 0 (纯图片PDF):                                                             │
│                                                                                              │
│  ImagePdfProcessor (扫描PDF)                                                                 │
│  ┌───────────────┐    ┌──────────────────┐    ┌───────────────────────────────┐             │
│  │ PDF→图片渲染  │───▶│ OCR版面分析      │───▶│ VLM增强 (VlmEnhanceService)   │             │
│  │ pdfjs-dist    │    │ PaddleOCR        │    │ qwen3-vl-flash               │             │
│  │ scale=2       │    │ PP-Structure     │    │ table→Markdown               │             │
│  │ PNG Buffer    │    │ bbox+blockType   │    │ figure→描述                  │             │
│  └───────────────┘    └──────────────────┘    │ formula→LaTeX                 │             │
│                                               └───────────────────────────────┘             │
│                                                                                              │
│  输出: ParsedContent { pages: [{textBlocks, tables, images, formulas}] }                     │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              Stage 3: CHUNK (切分)                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  SemanticChunker → CliffDetector → QualityFilter → HierarchicalStore                        │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              Stage 4: EMBED (嵌入生成)                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  LocalTextEmbeddingService (本地) 或 TextEmbeddingService (API)                             │
│  MultimodalEmbeddingService (CLIP)                                                           │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              Stage 5: INDEX (索引存储)                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  HierarchicalStore (层级存储) + ImageStore (图片存储)                                        │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              检索阶段                                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  Phase 1: 向量化 → Phase 2: 小块检索 → Phase 3: 阈值过滤                                    │
│  Phase 4: 父块展开 → Phase 5: 去重截断 → Phase 6: 上下文组装                                │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              LLM生成阶段                                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  LLMGenerationService → DeepSeek API (SSE流式)                                              │
│  VLMEnhancementService → qwen3-vl-flash (多模态)                                             │
│                                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、切分阶段详细技术

### 2.1 语义分块器 (SemanticChunker)

**核心算法流程**：

```
输入: 文档文本 text

Step 1: splitIntoSentences(text) → sentences[]
  • 按 [.!?]+[\s]+ 正则分句
  • 保留结尾标点符号

Step 2: generateSentenceEmbeddings(sentences)
  • 批量调用embedding API (batchSize=32)
  • EmbeddingCache缓存 (maxSize=1000)
  • 优先使用缓存, 未命中则批量生成

Step 3: createWindowEmbeddings(sentenceEmbeddings, windowSize=3)
  • 滑动窗口聚合
  • aggregateEmbeddings(window) → 窗口内embedding平均
  • 输出: [{startIndex, endIndex, embedding}]

Step 4: CliffDetector.detect(windowEmbeddings)
  → 返回语义边界列表 (SemanticCliff[])

Step 5: createChunksAtBoundaries(sentences, cliffs)
  • 边界数组: [0, cliffPositions, sentences.length]
  • 边界间句子合并为chunk
  • 合并过小块 (< smallChunkMinTokens)
  • 拆分过大块 (> smallChunkMaxTokens)

Step 6: fallbackChunking() - 无断崖时
  • 固定长度切分 (fallbackChunkSize=512 tokens)
  • 置信度标记为0

输出: smallChunks[] (100-300 tokens each)
```

**关键配置参数**：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| windowSize | 3 | 滑动窗口大小 |
| smallChunkMinTokens | 100 | 最小块大小 |
| smallChunkMaxTokens | 300 | 最大块大小 |
| fallbackChunkSize | 512 | Fallback切分大小 |
| embeddingBatchSize | 32 | 嵌入批量大小 |

---

### 2.2 断崖检测器 (CliffDetector)

**算法详解**：

```
输入: Embedding序列 [e1, e2, ..., en]

Step 1: adjacentSimilarity(embeddings)
  sim_i = cosine(e_i, e_{i+1})
  输出: similaritySequence: [sim_1, sim_2, ...]

  cosineSimilarity计算:
  cosine(a, b) = dotProduct(a,b) / (normA * normB)
  
  实现:
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

Step 2: identifyCandidates(similarities)
  candidates = {i | sim_i < similarityThreshold (0.7)}
  → 相似度低于阈值认为有断崖

Step 3: validateWithGradient(candidates, similarities)
  gradient_i = |sim_i - sim_{i-1}|
  要求: gradient_i > gradientThreshold (0.15)
  → 相似度下降幅度够大才算真断崖

Step 4: filterNoise(validated)
  分组相邻候选点
  要求每组 minCliffWidth=2 个连续候选
  取每组梯度最大的作为断崖代表
  → 防止单点噪声

Step 5: selectBoundaries(filtered)
  相邻断崖间隔 < 3 时取梯度最大者
  → 避免边界过于密集

Step 6: computeConfidence(cliffs)
  confidence = 0.6 * normalizedGradient + 0.4 * normalizedWidth
  normalizedGradient = (gradient - threshold) / (1 - threshold)
  normalizedWidth = min(width / 5, 1)

输出: SemanticCliff[] {position, similarity, gradient, width, confidence}
```

**配置参数**：

| 参数 | 默认值 | 作用 |
|------|--------|------|
| similarityThreshold | 0.7 | 相似度低于此值为候选断崖 |
| gradientThreshold | 0.15 | 梯度大于此值才验证通过 |
| minCliffWidth | 2 | 最小断崖宽度（滤噪） |
| highConfidenceThreshold | 0.8 | 高置信度阈值 |

---

### 2.3 分块质量过滤器 (QualityFilter)

**四维度评估**：

```
evaluate(chunk): QualityScore

维度1: informationDensity (信息密度)
  uniqueTokens / totalTokens
  → 衡量内容丰富度
  实现: countUniqueTokens(content) = Set(tokens.toLowerCase()).size

维度2: repetitionRatio (重复率, 越低越好)
  1 - uniqueTokens / totalTokens
  → 衡量重复内容占比

维度3: semanticCompleteness (语义完整性)
  计算公式:
  score = completeSentenceRatio * 0.5
        + paragraphScore * 0.3
        + endsWithPunctuation * 0.2

  • completeSentenceRatio: 完整句子占比
    isCompleteSentence(s) = /[.!?]$/.test(s.trim())
  
  • paragraphScore: 合理段落长度 (100-500 chars)
    avgLength >= 100 && <= 500 → score = 1
    否则: 1 - abs(avgLength - 300) / 500
  
  • endsWithPunctuation: 结尾有标点 → 0.2分

维度4: documentRelevance (文档相关性)
  cosine(chunkEmbedding, documentEmbedding)
  → 与文档主题的相关性
  需要: setDocumentEmbedding(documentId, embedding)

compositeScore计算:
  weights = {informationDensity: 0.25, repetitionRatio: 0.25, 
             semanticCompleteness: 0.25, documentRelevance: 0.25}
  composite = Σ(dimensions[i] * weights[i])
```

**处理模式**：

| 模式 | 行为 |
|------|------|
| discard | 直接丢弃低质量分块 |
| merge | 合并到最近的高质量分块 |
| flag | 标记boundaryConfidence=0, 保留 |

---

### 2.4 层级存储构建 (HierarchicalStore)

**父子层级构建算法**：

```
buildHierarchy(smallChunks, sourceDocumentId)

Step 1: StructureBoundaryDetector.detect(combinedContent)
  检测结构边界:
  • 章节标题: /^第[一二三四五六七八九十百]+[章节篇部]/m (confidence=0.95)
  • 列表开头: /^[一二三四五六七八九十]+[、.．]\s*\S/m (confidence=0.8)
  • 数字列表: /^\d+[.．。]\s*\S/m (confidence=0.75)
  • Markdown标题: /^#{1,3}\s+\S/m (confidence=0.85)
  • 英文章节: /^(Chapter|Section|Part)\s+\d+/im (confidence=0.9)
  
  highConfidenceBoundaries = filter(b => b.confidence >= 0.8)

Step 2: groupForParents(smallChunks)
  currentGroup = [], currentTokens = 0, contentOffset = 0
  
  for each chunk:
    chunkTokens = estimateTokenCount(chunk.content)
    
    // 检查是否跨越结构边界
    crossesBoundary = boundaries.some(b => 
      b.position > contentOffset && b.position < contentOffset + chunk.content.length
    )
    
    if crossesBoundary && currentGroup.length > 0:
      groups.push(currentGroup)
      currentGroup = [], currentTokens = 0
    
    // 检查大小限制
    if currentTokens + chunkTokens > parentChunkMaxTokens (1500):
      if currentGroup.length > 0: groups.push(currentGroup)
      currentGroup = [chunk], currentTokens = chunkTokens
    else:
      currentGroup.push(chunk), currentTokens += chunkTokens
    
    // 达到最小parent大小后切分
    if currentTokens >= parentChunkMinTokens (500):
      groups.push(currentGroup)
      currentGroup = [], currentTokens = 0
    
    contentOffset += chunk.content.length + 1

Step 3: createParentChunk(group)
  content = group.map(c => c.content).join('\n\n')
  embedding = aggregateEmbeddings(group.filter(c => c.embedding.length > 0).map(c => c.embedding))
  minStart = min(group.position.start)
  maxEnd = max(group.position.end)
  avgQuality = average(group.qualityScore)
  childIds = group.map(c => c.id)

Step 4: 建立双向链接
  for each smallChunk in group:
    smallChunk.parentId = parent.id
  
  parent.childIds = childIds

输出:
  • smallChunks: Map<id, HierarchicalChunk>
  • parentChunks: Map<id, HierarchicalChunk>
```

**层级结构示意**：

```
        ┌─────────────────────────────────────────┐
        │          Parent Chunk (大块)             │
        │      1000-2000 tokens                    │
        │                                          │
        │  ┌─────────┐ ┌─────────┐ ┌─────────┐    │
        │  │ Child 1 │ │ Child 2 │ │ Child 3 │    │
        │  │ (小块)  │ │ (小块)  │ │ (小块)  │    │
        │  │200-400  │ │200-400  │ │200-400  │    │
        │  │ tokens  │ │ tokens  │ │ tokens  │    │
        │  └─────────┘ └─────────┘ └─────────┘    │
        │                                          │
        │  childIds: [id1, id2, id3]               │
        └─────────────────────────────────────────┘
        
双向链接:
  • Child.parentId → Parent.id
  • Parent.childIds → [Child.id, ...]
```

---

## 三、嵌入生成技术

### 3.1 本地嵌入服务 (LocalTextEmbeddingService)

```
技术栈:
  • transformers.js (@xenova/transformers)
  • pipeline('feature-extraction')
  • 模型: multilingual-e5-small

初始化流程:
  env.cacheDir = process.env.TRANSFORMERS_CACHE
  env.allowRemoteModels = false (if LOCAL_FILES_ONLY=true)
  
  extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
    quantized: true,
    progress_callback: (progress) => {
      if progress.status === 'downloading':
        console.log(`Downloading: ${progress.file} ${progress.progress}%`)
    }
  })

嵌入生成:
  output = await extractor(text, {
    pooling: 'mean',    // 平均池化
    normalize: true     // 归一化到单位向量
  })
  vector = Array.from(output.data as Float32Array)

缓存机制:
  EmbeddingCache: Map<string, number[]>
  maxSize: 1000
  查询前检查缓存, 命中直接返回

批量处理:
  BATCH_SIZE_LIMIT = 100
  内存监控: heapUsed > 500MB → clearCache()
  分chunk处理避免内存溢出
```

### 3.2 多模态嵌入服务 (MultimodalEmbeddingService)

```
技术栈:
  • CLIP模型: clip-vit-base-patch32
  • pipeline('zero-shot-image-classification')
  • dimension: 512

图片嵌入流程:
  1. 检测图片格式 (PNG/JPEG/WebP)
  2. 校验最小大小 (> 100 bytes)
  3. 创建dataUrl: `data:image/${format};base64,${base64}`
  4. 分类获取语义表示:
     result = await imageClassifier(dataUrl, ['image', 'photo', 'document'])
  5. 从分类scores生成embedding:
     vector = generateEmbeddingFromClassification(scores, seed)
```

---

## 四、检索阶段详细技术

### 4.1 Small-to-Big检索流程

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              Small-to-Big检索全流程                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

Phase 1: 向量化
───────────────────────────────────────────────────────────────────────────────────────────────

getQueryEmbedding(query)
  
  1. QueryCache检查 (TTL=5min, maxSize=100)
     cached = QueryCache.get(query)
     if cached: return cached
  
  2. 调用嵌入服务
     embedding = await embeddingGenerator(query)
     timeout: 10000ms
  
  3. 缓存结果
     QueryCache.set(query, embedding)
  
  返回: queryEmbedding (384维向量)


Phase 2: 小块向量检索
───────────────────────────────────────────────────────────────────────────────────────────────

searchSmallChunks(queryEmbedding)

  smallChunks = store.getAllSmallChunks()
  results = []
  
  for each chunk in smallChunks:
    if chunk.embedding.length === 0: continue  // 跳过无嵌入
    
    similarity = cosineSimilarity(queryEmbedding, chunk.embedding)
    
    results.push({
      smallChunkId: chunk.id,
      parentChunkId: chunk.parentId,
      smallChunkContent: chunk.content,
      similarityScore: similarity,
      sourceDocumentId: chunk.sourceDocumentId,
      expandedFromSmallChunk: true
    })
  
  return sortBySimilarity(results)  // 按相似度降序


Phase 3: 阈值过滤
───────────────────────────────────────────────────────────────────────────────────────────────

filteredResults = results.filter(r => r.similarityScore >= similarityThreshold)

默认 similarityThreshold = 0.75
可通过请求参数调整

Fallback机制 (主检索无结果):
  if filteredResults.length === 0 && enableFallback:
    return fallbackSearch(queryEmbedding)
    
    fallbackSearch实现:
      parentChunks = store.getAllParentChunks()
      for each parent:
        similarity = cosineSimilarity(queryEmbedding, parent.embedding)
      return sortBySimilarity(parentResults)
        .filter(r => r.similarityScore >= fallbackThreshold (0.6))
        .slice(0, topK)


Phase 4: 父块展开
───────────────────────────────────────────────────────────────────────────────────────────────

expandToParents(filteredResults)

  for each result:
    parent = store.getParentChunk(result.smallChunkId)
    
    // 上下文窗口提取
    contextWindow = extractContextWindow(
      parent.content,
      result.smallChunkContent,
      { beforeChars: 300, afterChars: 500, respectSentenceBoundary: true }
    )
    
    result.parentChunkId = parent.id
    result.parentChunkContent = parent.content
    result.contextWindow = contextWindow
    result.windowStart = ...
    result.windowEnd = ...

extractContextWindow实现:
  
  1. 定位小块在父块中的位置
     findSmallChunkPosition(parent, small):
       • 直接匹配: parent.indexOf(small)
       • trim匹配: parent.indexOf(small.trim())
       • firstLine匹配: parent.indexOf(small.split('\n')[0])
  
  2. 计算窗口边界
     windowStart = max(0, matchPosition - beforeChars)
     windowEnd = min(parent.length, matchPosition + smallLen + afterChars)
  
  3. 尊重句子边界
     windowStart = findSentenceBoundary(parent, windowStart, 'backward')
     windowEnd = findSentenceBoundary(parent, windowEnd, 'forward')
     
     findSentenceBoundary实现:
       sentenceEnders = ['.', '!', '?', '。', '！', '？', '\n\n']
       向前/向后查找最近的句子结束符


Phase 5: 去重与截断
───────────────────────────────────────────────────────────────────────────────────────────────

去重:
  seen = new Set<string>()
  deduplicated = expandedResults.filter(result => {
    if seen.has(result.parentChunkId): return false
    seen.add(result.parentChunkId)
    return true
  })
  // 同一个parent只返回一次

截断:
  limited = deduplicated.slice(0, topK)
  默认 topK = 5


Phase 6: 上下文组装
───────────────────────────────────────────────────────────────────────────────────────────────

assembleContext(results)

  totalTokens = 0, truncated = false
  chunks = []
  
  for each result:
    content = result.parentChunkContent || result.smallChunkContent
    tokens = estimateTokenCount(content) = content.length / 4
    
    if totalTokens + tokens <= maxContextTokens (4000):
      chunks.push(result)
      totalTokens += tokens
    else:
      truncated = true
      break
  
  assembledContent = chunks.map(c => c.parentChunkContent).join('\n\n---\n\n')
  
  return {
    content: assembledContent,
    tokenCount: totalTokens,
    chunks: chunks,
    truncated: truncated
  }
```

---

## 五、LLM生成阶段

### 5.1 DeepSeek集成

```
LLMGenerationService.generateWithStreaming(request, broadcast)

Step 1: 构建Prompt
  ──────────────────────────────────────────────────────────────────────────────────────────
  用户问题: ${query}
  
  参考资料:
  ---
  ${source1.content}
  ---
  ${source2.content}
  ---
  ...
  
  请基于参考资料回答用户问题。如果参考资料中没有相关信息，请说明无法回答。
  ──────────────────────────────────────────────────────────────────────────────────────────

Step 2: SSE流式调用
  POST https://api.deepseek.com/v1/chat/completions
  
  body: {
    model: "deepseek-reasoner",
    messages: [{ role: "user", content: prompt }],
    stream: true
  }

Step 3: SSE解析与事件推送
  buffer += decoder.decode(value)
  lines = buffer.split('\n')
  
  for each line starting with 'data:':
    if data === '[DONE]': continue
    
    chunk = JSON.parse(data)
    delta = chunk.choices[0].delta
    
    if delta.reasoning_content:
      thinkingContent += delta.reasoning_content
      broadcast({ type: 'generation:thinking', thinkingContent: delta.reasoning_content })
    
    if delta.content:
      answerContent += delta.content
      broadcast({ type: 'generation:answer', answerContent: delta.content })

Step 4: 完成事件
  broadcast({
    type: 'generation:complete',
    thinkingTokens: thinkingContent.length,
    answerTokens: answerContent.length,
    totalDuration: duration
  })

返回: { thinking: thinkingContent, answer: answerContent, duration: duration }
```

### 5.2 多模态生成 (VLM增强)

```
LLMGenerationService.generateMultimodalAnswer(request, broadcast)

Step 1: 图片VLM增强
  imageContexts = request.imageContexts
  enhancedImageContexts = []
  
  for each imgCtx in imageContexts:
    vlmRequest = {
      imageBase64: imgCtx.base64,
      blockType: imgCtx.blockType,  // table/figure/formula/mixed
      userQuery: request.query
    }
    
    vlmResult = VlmEnhancementService.enhanceWithStreaming(vlmRequest, (event) => {
      if event.type === 'vlm:thinking':
        broadcast({ type: 'generation:thinking', phase: 'analysis', ... })
      if event.type === 'vlm:answer':
        broadcast({ type: 'generation:answer', phase: 'analysis', ... })
    })
    
    enhancedImageContexts.push(`[第${imgCtx.sourcePage}页 ${imgCtx.blockType}]\n${vlmResult.answer}`)

Step 2: 整合文本+图片理解
  fullContext = textContext + '\n\n--- 图片内容理解 ---\n\n' + enhancedImageContexts.join('\n\n')

Step 3: DeepSeek生成最终答案
  return generateWithStreaming(enhancedRequest, broadcast)
```

---

## 六、关键发现：没有独立重排模块

**当前排序机制分析**：

```
排序发生在检索阶段, 没有独立的Reranker:

1. 初步排序 (searchSmallChunks):
   sortBySimilarity(results)
   → 按余弦相似度降序排列

2. 阈值过滤:
   filter(r => r.similarityScore >= threshold)

3. 去重 (父块展开后):
   按parentChunkId去重

4. 截断:
   slice(0, topK)

缺少的重排维度:
❌ 多轮精细化排序
❌ Cross-Encoder重排模型
❌ 多样性重排 (MMR)
❌ 业务权重调整
❌ 时效性/权威性权重
```

**如果需要增加重排模块，建议插入位置**：

```typescript
// 在 chat.ts 检索完成后，LLM生成前

const { results, context } = await retriever.retrieveWithMetadata(query);

// [插入点] 重排模块
const rerankedResults = await reranker.rerank(results, {
  query,
  diversityWeight: 0.2,     // 多样性权重
  freshnessWeight: 0.1,     // 时效性权重
  authorityWeight: 0.1,     // 来源权威性权重
  crossEncoderModel: 'cross-encoder/ms-marco-MiniLM-L-6-v2'
});

// 用 rerankedResults 进行上下文组装
```

---

## 七、技术配置参数汇总表

| 环节 | 核心模块 | 技术栈 | 关键参数 |
|------|----------|--------|----------|
| **解析** | PdfParser | pdf-parse | ContentPosition: 页码+bbox |
| **图片PDF** | ImagePdfProcessor | pdfjs-dist + PaddleOCR | scale=2, table=False |
| **VLM增强** | VlmEnhancementService | qwen3-vl-flash | enableThinking=false, timeout=60s |
| **语义分块** | SemanticChunker | 滑动窗口聚合 | windowSize=3, min=100, max=300 |
| **断崖检测** | CliffDetector | 余弦相似度序列分析 | simThreshold=0.7, gradientThreshold=0.15 |
| **质量过滤** | QualityFilter | 四维度评估 | qualityThreshold=0.5, weights=[0.25,0.25,0.25,0.25] |
| **层级构建** | HierarchicalStore | 结构边界检测 | parentMin=500, parentMax=1500 |
| **文本嵌入** | LocalTextEmbeddingService | transformers.js | dimension=384, batchSize=100 |
| **多模态嵌入** | MultimodalEmbeddingService | CLIP | dimension=512 |
| **向量检索** | SmallToBigRetriever | cosine全量扫描 | threshold=0.75, topK=5 |
| **父块展开** | SmallToBigRetriever | contextWindow提取 | before=300, after=500 |
| **上下文组装** | assembleContext | Token截断 | maxTokens=4000 |
| **LLM生成** | LLMGenerationService | DeepSeek API SSE | model=deepseek-reasoner |

---

## 八、核心代码文件索引

| 功能 | 文件路径 |
|------|----------|
| Pipeline编排 | `src/core/pipeline.ts` |
| Harness框架 | `src/core/harness.ts` |
| 语义分块 | `src/chunking/semantic-chunker.ts` |
| 断崖检测 | `src/chunking/cliff-detector.ts` |
| 质量过滤 | `src/chunking/quality-filter.ts` |
| 层级存储 | `src/chunking/hierarchical-store.ts` |
| Small-to-Big检索 | `src/chunking/small-to-big-retriever.ts` |
| 结构边界检测 | `src/chunking/structure-boundary-detector.ts` |
| 工具函数 | `src/chunking/utils.ts` |
| 本地嵌入 | `src/embedding/local-embedding-service.ts` |
| 多模态嵌入 | `src/embedding/multimodal-embedding-service.ts` |
| API嵌入 | `src/embedding/embedding-service.ts` |
| 混合检索 | `src/retrieval/search-engine.ts` |
| 上下文组装 | `src/retrieval/context-assembler.ts` |
| 图片PDF处理 | `src/parsers/image-pdf-processor.ts` |
| OCR服务调用 | `src/parsers/layout-ocr-service.ts` |
| VLM增强 | `src/server/services/VlmEnhancementService.ts` |
| LLM生成 | `src/server/services/LLMGenerationService.ts` |
| Chat路由 | `src/server/routes/chat.ts` |

---

## 九、面试回答要点

### 开场（10秒）
> "这个RAG系统有完整的Pipeline流程：解析→切分→嵌入→索引→检索→生成，核心亮点是语义分块+Small-to-Big检索策略。"

### 切分环节（30秒）
> "切分不是固定长度，而是用断崖检测算法：先给每个句子生成embedding，计算相邻句子相似度，相似度突然下降（断崖）就是语义边界。还加了质量过滤和层级构建，小块用于精准检索，大块提供完整上下文。"

### 检索环节（30秒）
> "Small-to-Big两阶段检索：Phase 1在小块中向量匹配（cosine相似度），Phase 2展开到父块返回完整上下文。还做了contextWindow提取，只返回匹配点前后300+500字符，减少噪音。"

### 重排问题（15秒）
> "当前系统没有独立重排模块，排序就是相似度排序。如果需要可以加Cross-Encoder精细化排序或MMR多样性重排。"

### 关键数据（10秒）
> "小块100-300 tokens，父块500-1500 tokens，检索阈值0.75，topK默认5，上下文限制4000 tokens。"