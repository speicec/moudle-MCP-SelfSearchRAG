# 切分层规格 (Chunking Layer Spec)

## 概述

切分层负责将文档转化为可检索的分块单元。核心目标：动态语义切分、文本增强、提高召回准确率。

## 架构定位

```
文档输入
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Chunking Layer                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │ Doc Analyzer│ →  │ Chunk Strategy│ → │ Chunk Splitter│         │
│  │ (文档分析)   │    │ (策略选择)    │    │ (切分执行)    │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         ↓                 ↓                 ↓                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │ Text Enhance│    │ Overlap Calc│    │ Embedding Prep│         │
│  │ (文本增强)   │    │ (重叠计算)    │    │ (Embedding准备)│        │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         ↓                 ↓                 ↓                   │
│  ┌───────────────────────────────────────────────────┐          │
│  │              Chunk Validator (分块验证)            │          │
│  └───────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
    ↓
Chunk输出 → Embedding Layer → Storage Layer
```

## 核心问题：为什么切分重要？

**痛点**：
1. 固定大小切分破坏语义完整性
2. 切分粒度不当导致检索遗漏
3. 缺乏上下文导致理解偏差

**解决方案**：
1. 动态语义切分（按语义边界）
2. 文本增强（补充上下文）
3. 多粒度切分（适应不同查询）

---

## 模块详解

### 1. Document Analyzer (文档分析)

**职责**: 分析文档类型、结构、语言特征，选择最佳切分策略

```typescript
interface DocumentAnalyzer {
  analyze(document: Document): Promise<DocumentAnalysis>;
}

interface DocumentAnalysis {
  // 文档类型
  docType: 'text' | 'code' | 'markdown' | 'json' | 'html' | 'pdf';

  // 语言检测
  language: string;

  // 结构分析
  structure: {
    hasTitle: boolean;
    hasSections: boolean;
    sectionCount: number;
    hasList: boolean;
    hasTable: boolean;
    hasCodeBlock: boolean;
    paragraphCount: number;
  };

  // 语义密度
  semanticDensity: {
    level: 'low' | 'medium' | 'high';
    avgSentenceLength: number;
    avgParagraphLength: number;
    technicalTermRatio: number;  // 技术术语占比
  };

  // 推荐策略
  recommendedStrategy: ChunkStrategy;
}

type ChunkStrategy =
  | 'fixed-size'           // 固定大小
  | 'semantic-boundary'    // 语义边界
  | 'recursive'            // 递归切分
  | 'ast-based'            // AST切分（代码）
  | 'markdown-section'     // Markdown章节切分
  | 'sliding-window'       // 滑动窗口
  | 'multi-granularity';   // 多粒度
```

**分析算法**:

```typescript
async function analyzeDocument(document: Document): Promise<DocumentAnalysis> {
  const content = document.content;

  // 1. 类型检测
  const docType = detectDocType(document.extension, content);

  // 2. 语言检测
  const language = detectLanguage(content);

  // 3. 结构分析
  const structure = analyzeStructure(content, docType);

  // 4. 语义密度计算
  const density = calculateSemanticDensity(content);

  // 5. 策略推荐
  const strategy = recommendStrategy(docType, structure, density);

  return { docType, language, structure, semanticDensity: density, recommendedStrategy: strategy };
}

// 结构分析
function analyzeStructure(content: string, docType: DocType): Structure {
  switch (docType) {
    case 'markdown':
      return {
        hasTitle: /^#\s/.test(content),
        hasSections: /^#{2,3}\s/.test(content),
        sectionCount: countMatches(content, /^#{2,3}\s/g),
        hasList: /^\s*[-*]\s/.test(content),
        hasTable: /\|.*\|/.test(content),
        hasCodeBlock: /```/.test(content),
        paragraphCount: countParagraphs(content)
      };

    case 'code':
      return {
        hasTitle: false,
        hasSections: hasClassOrFunction(content),
        sectionCount: countFunctions(content) + countClasses(content),
        hasList: false,
        hasTable: false,
        hasCodeBlock: true,
        paragraphCount: 0
      };

    default:
      return analyzeTextStructure(content);
  }
}

// 语义密度计算
function calculateSemanticDensity(content: string): SemanticDensity {
  const sentences = splitSentences(content);
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

  const paragraphs = splitParagraphs(content);
  const avgParagraphLength = paragraphs.reduce((sum, p) => sum + p.length, 0) / paragraphs.length;

  const words = tokenize(content);
  const technicalTerms = countTechnicalTerms(words);
  const technicalTermRatio = technicalTerms / words.length;

  // 密度等级判定
  const level = avgSentenceLength > 100 && technicalTermRatio > 0.2
    ? 'high'
    : avgSentenceLength < 50
      ? 'low'
      : 'medium';

  return { level, avgSentenceLength, avgParagraphLength, technicalTermRatio };
}

// 策略推荐
function recommendStrategy(
  docType: DocType,
  structure: Structure,
  density: SemanticDensity
): ChunkStrategy {
  // 规则表
  const rules: StrategyRule[] = [
    // 代码文件 → AST切分
    { condition: () => docType === 'code', strategy: 'ast-based' },

    // Markdown有章节 → 章节切分
    { condition: () => docType === 'markdown' && structure.hasSections, strategy: 'markdown-section' },

    // 高语义密度 → 语义边界切分
    { condition: () => density.level === 'high', strategy: 'semantic-boundary' },

    // 多段落结构 → 递归切分
    { condition: () => structure.paragraphCount > 10, strategy: 'recursive' },

    // 默认 → 滑动窗口
    { condition: () => true, strategy: 'sliding-window' }
  ];

  for (const rule of rules) {
    if (rule.condition()) {
      return rule.strategy;
    }
  }

  return 'fixed-size';
}
```

---

### 2. Chunk Splitter (切分执行)

**职责**: 根据选定策略执行切分

#### 2.1 固定大小切分

```typescript
interface FixedSizeSplitter {
  split(content: string, config: FixedSizeConfig): Chunk[];
}

interface FixedSizeConfig {
  chunkSize: number;      // 分块大小（字符数）
  overlap: number;        // 重叠大小
  separator?: string;     // 分隔符（默认按段落）
}

function splitFixedSize(content: string, config: FixedSizeConfig): Chunk[] {
  const chunks: Chunk[] = [];
  const separator = config.separator || '\n\n';

  // 按分隔符初步切分
  const segments = content.split(separator);

  let currentChunk = '';
  let startOffset = 0;

  for (const segment of segments) {
    // 如果单个segment超过chunkSize，需要二次切分
    if (segment.length > config.chunkSize) {
      // 先保存当前chunk
      if (currentChunk.length > 0) {
        chunks.push(createChunk(currentChunk, startOffset));
      }

      // 大segment二次切分
      const subChunks = splitLargeSegment(segment, config.chunkSize, config.overlap);
      chunks.push(...subChunks);

      currentChunk = '';
      startOffset += segment.length + separator.length;
    } else {
      // 尝试合并到当前chunk
      if (currentChunk.length + segment.length + separator.length > config.chunkSize) {
        // 超过限制，保存当前chunk
        chunks.push(createChunk(currentChunk, startOffset));

        // 新chunk从overlap开始
        const overlapText = getOverlap(currentChunk, config.overlap);
        currentChunk = overlapText + separator + segment;
        startOffset = chunks[chunks.length - 1].position.end - overlapText.length;
      } else {
        // 合并
        currentChunk += (currentChunk ? separator : '') + segment;
      }
    }
  }

  // 最后一个chunk
  if (currentChunk.length > 0) {
    chunks.push(createChunk(currentChunk, startOffset));
  }

  return chunks;
}
```

#### 2.2 语义边界切分（核心）

```typescript
interface SemanticBoundarySplitter {
  split(content: string, config: SemanticConfig): Promise<Chunk[]>;
}

interface SemanticConfig {
  minChunkSize: number;    // 最小分块大小
  maxChunkSize: number;    // 最大分块大小
  targetChunkSize: number; // 目标分块大小
  semanticThreshold: number; // 语义边界阈值（0-1）
}

// 语义边界检测
async function detectSemanticBoundaries(content: string): Promise<Boundary[]> {
  const sentences = splitSentences(content);
  const boundaries: Boundary[] = [];

  // 方法1: Embedding相似度检测
  if (sentences.length > 1) {
    const embeddings = await embedder.embedBatch(sentences);

    for (let i = 1; i < embeddings.length; i++) {
      const similarity = cosineSimilarity(embeddings[i - 1], embeddings[i]);

      // 相似度低 = 语义边界
      if (similarity < SEMANTIC_THRESHOLD) {
        boundaries.push({
          position: getSentenceEndPosition(sentences[i - 1]),
          score: 1 - similarity,
          type: 'embedding-similarity'
        });
      }
    }
  }

  // 方法2: 规则检测（补充）
  const ruleBoundaries = detectRuleBoundaries(content);
  boundaries.push(...ruleBoundaries);

  // 合并和排序
  return mergeAndSortBoundaries(boundaries);
}

// 规则边界检测
function detectRuleBoundaries(content: string): Boundary[] {
  const boundaries: Boundary[] = [];

  // 标题边界
  const titleMatches = content.matchAll(/^#{1,3}\s.+/gm);
  for (const match of titleMatches) {
    boundaries.push({
      position: match.index,
      score: 0.9,
      type: 'markdown-heading'
    });
  }

  // 段落边界（空行）
  const paragraphMatches = content.matchAll(/\n\n+/g);
  for (const match of paragraphMatches) {
    boundaries.push({
      position: match.index,
      score: 0.7,
      type: 'paragraph-break'
    });
  }

  // 主题转换词
  const transitionWords = ['然而', '因此', '首先', '其次', '最后', '总之', '另外'];
  for (const word of transitionWords) {
    const matches = content.matchAll(new RegExp(`[${word}]`, 'g'));
    for (const match of matches) {
      boundaries.push({
        position: match.index,
        score: 0.5,
        type: 'transition-word'
      });
    }
  }

  return boundaries;
}

// 语义切分执行
async function splitSemanticBoundary(
  content: string,
  config: SemanticConfig
): Promise<Chunk[]> {
  // 1. 检测边界
  const boundaries = await detectSemanticBoundaries(content);

  // 2. 根据边界和大小约束切分
  const chunks: Chunk[] = [];
  let currentStart = 0;
  let currentEnd = 0;

  for (const boundary of boundaries) {
    const potentialChunkSize = boundary.position - currentStart;

    // 检查是否符合大小约束
    if (potentialChunkSize >= config.minChunkSize) {
      if (potentialChunkSize <= config.maxChunkSize) {
        // 在范围内，直接切分
        chunks.push(createChunk(
          content.slice(currentStart, boundary.position),
          currentStart
        ));
        currentStart = boundary.position;
      } else {
        // 超过最大值，需要强制切分
        const subChunks = splitToFit(
          content.slice(currentStart, boundary.position),
          config.maxChunkSize
        );
        chunks.push(...subChunks);
        currentStart = boundary.position;
      }
    } else {
      // 太小，继续累积
      currentEnd = boundary.position;
    }
  }

  // 最后剩余内容
  if (currentStart < content.length) {
    const remaining = content.slice(currentStart);
    if (remaining.length > config.minChunkSize) {
      chunks.push(createChunk(remaining, currentStart));
    } else if (chunks.length > 0) {
      // 合并到最后一个chunk（如果不会超过max）
      const lastChunk = chunks[chunks.length - 1];
      if (lastChunk.content.length + remaining.length <= config.maxChunkSize) {
        lastChunk.content += remaining;
        lastChunk.position.end = content.length;
      }
    }
  }

  return chunks;
}
```

#### 2.3 递归切分

```typescript
interface RecursiveSplitter {
  split(content: string, config: RecursiveConfig): Chunk[];
}

interface RecursiveConfig {
  separators: string[];    // 分隔符层级（从大到小）
  chunkSize: number;
  overlap: number;
}

// 递归切分：先用大分隔符，再用小分隔符
function splitRecursive(content: string, config: RecursiveConfig): Chunk[] {
  // 默认分隔符层级
  const separators = config.separators || [
    '\n\n',    // 段落
    '\n',      // 行
    '. ',      // 句子
    ' ',       // 词
    ''         // 字符
  ];

  return recursiveSplit(content, separators, config.chunkSize, config.overlap);
}

function recursiveSplit(
  content: string,
  separators: string[],
  chunkSize: number,
  overlap: number,
  level: number = 0
): Chunk[] {
  if (content.length <= chunkSize) {
    return [createChunk(content, 0)];
  }

  const separator = separators[level];
  if (!separator) {
    // 最后层级，强制按字符切分
    return splitByChars(content, chunkSize, overlap);
  }

  const segments = content.split(separator);
  const chunks: Chunk[] = [];
  let currentChunk = '';

  for (const segment of segments) {
    if (currentChunk.length + segment.length + separator.length > chunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(createChunk(currentChunk, 0));
        currentChunk = getOverlap(currentChunk, overlap) + separator + segment;
      } else {
        // 单个segment就超过，递归到下一层级
        const subChunks = recursiveSplit(segment, separators, chunkSize, overlap, level + 1);
        chunks.push(...subChunks);
      }
    } else {
      currentChunk += (currentChunk ? separator : '') + segment;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(createChunk(currentChunk, 0));
  }

  return chunks;
}
```

#### 2.4 AST切分（代码）

```typescript
interface ASTSplitter {
  split(code: string, language: string): Promise<Chunk[]>;
}

// AST解析切分
async function splitAST(code: string, language: string): Promise<Chunk[]> {
  const chunks: Chunk[] = [];

  // 使用tree-sitter解析
  const parser = getParser(language);
  const tree = parser.parse(code);

  // 提取代码单元
  const units = extractCodeUnits(tree, language);

  for (const unit of units) {
    const chunk = createCodeChunk(
      code.slice(unit.start, unit.end),
      unit.start,
      unit.type,      // function, class, method
      unit.name,
      language
    );

    // 添加AST元信息
    chunk.metadata = {
      type: unit.type,
      name: unit.name,
      parameters: unit.parameters,
      returnType: unit.returnType,
      dependencies: unit.dependencies
    };

    chunks.push(chunk);
  }

  return chunks;
}

// 提取代码单元
function extractCodeUnits(tree: Tree, language: string): CodeUnit[] {
  const units: CodeUnit[] = [];

  // 语言特定规则
  const rules: LanguageRule = {
    typescript: {
      extract: [
        { type: 'function_declaration', name: 'name', includes: ['body'] },
        { type: 'class_declaration', name: 'name', includes: ['body'] },
        { type: 'method_definition', name: 'name', includes: ['body'] },
        { type: 'interface_declaration', name: 'name', includes: ['body'] }
      ]
    },
    python: {
      extract: [
        { type: 'function_definition', name: 'name', includes: ['body'] },
        { type: 'class_definition', name: 'name', includes: ['body'] }
      ]
    }
  };

  const langRules = rules[language] || rules.typescript;

  for (const rule of langRules.extract) {
    const nodes = findNodes(tree.rootNode, rule.type);

    for (const node of nodes) {
      const nameNode = findChild(node, rule.name);
      const bodyNode = findChild(node, 'body');

      units.push({
        type: rule.type,
        name: nameNode?.text || 'anonymous',
        start: node.startIndex,
        end: node.endIndex,
        parameters: extractParameters(node, language),
        returnType: extractReturnType(node, language),
        dependencies: extractDependencies(bodyNode || node)
      });
    }
  }

  return units;
}
```

#### 2.5 多粒度切分

```typescript
interface MultiGranularitySplitter {
  split(content: string): Promise<MultiGranularityChunks>;
}

interface MultiGranularityChunks {
  // 不同粒度的分块
  granularities: {
    fine: Chunk[];      // 小粒度（句子级）
    medium: Chunk[];    // 中粒度（段落级）
    coarse: Chunk[];    // 大粒度（章节级）
  };

  // 粒度关联
  relations: GranularityRelation[];
}

interface GranularityRelation {
  coarseId: string;
  mediumIds: string[];  // coarse包含的medium chunks
  fineIds: string[];    // medium包含的fine chunks
}

// 多粒度切分执行
async function splitMultiGranularity(content: string): Promise<MultiGranularityChunks> {
  // 1. 大粒度切分（章节/大段落）
  const coarseChunks = await splitSemanticBoundary(content, {
    minChunkSize: 1000,
    maxChunkSize: 3000,
    targetChunkSize: 2000,
    semanticThreshold: 0.3
  });

  // 2. 中粒度切分（段落）
  const mediumChunks: Chunk[] = [];
  const relations: GranularityRelation[] = [];

  for (const coarse of coarseChunks) {
    const subMediums = await splitSemanticBoundary(coarse.content, {
      minChunkSize: 200,
      maxChunkSize: 500,
      targetChunkSize: 300,
      semanticThreshold: 0.4
    });

    // 记录关联
    relations.push({
      coarseId: coarse.id,
      mediumIds: subMediums.map(m => m.id),
      fineIds: []  // 后续填充
    });

    mediumChunks.push(...subMediums.map(m => ({
      ...m,
      parentId: coarse.id
    })));
  }

  // 3. 小粒度切分（句子）
  const fineChunks: Chunk[] = [];

  for (const medium of mediumChunks) {
    const subFines = splitBySentences(medium.content, {
      minChunkSize: 50,
      maxChunkSize: 150
    });

    // 更新关联
    const relation = relations.find(r => r.mediumIds.includes(medium.id));
    if (relation) {
      relation.fineIds.push(...subFines.map(f => f.id));
    }

    fineChunks.push(...subFines.map(f => ({
      ...f,
      parentId: medium.id,
      grandparentId: medium.parentId
    })));
  }

  return {
    granularities: { fine: fineChunks, medium: mediumChunks, coarse: coarseChunks },
    relations
  };
}
```

---

### 3. Text Enhancer (文本增强)

**职责**: 为分块补充上下文信息，提高检索理解能力

```typescript
interface TextEnhancer {
  enhance(chunk: Chunk, context: EnhancementContext): Promise<EnhancedChunk>;
}

interface EnhancementContext {
  // 文档级上下文
  document: {
    title?: string;
    summary?: string;
    keywords?: string[];
  };

  // 前后分块上下文
  prevChunk?: Chunk;
  nextChunk?: Chunk;

  // 全局上下文
  globalContext?: string;
}

interface EnhancedChunk extends Chunk {
  // 原始内容
  originalContent: string;

  // 增强后的内容
  enhancedContent: string;

  // 增强类型
  enhancementTypes: EnhancementType[];

  // 增强信息
  enhancement: {
    addedTitle?: string;
    addedContext?: string;
    addedKeywords?: string[];
    addedSummary?: string;
  };
}

type EnhancementType =
  | 'title-prefix'       // 添加标题前缀
  | 'context-window'     // 前后上下文窗口
  | 'keyword-injection'  // 关键词注入
  | 'summary-injection'  // 概要注入
  | 'metadata-expansion';// 元数据扩展
```

**增强策略**:

```typescript
// 标题前缀增强
function enhanceWithTitle(chunk: Chunk, title: string): EnhancedChunk {
  return {
    ...chunk,
    originalContent: chunk.content,
    enhancedContent: `【${title}】\n${chunk.content}`,
    enhancementTypes: ['title-prefix'],
    enhancement: { addedTitle: title }
  };
}

// 上下文窗口增强
function enhanceWithContextWindow(
  chunk: Chunk,
  prevChunk?: Chunk,
  nextChunk?: Chunk,
  windowSize: number = 100
): EnhancedChunk {
  const prevContext = prevChunk
    ? `...${prevChunk.content.slice(-windowSize)}`
    : '';
  const nextContext = nextChunk
    ? `${nextChunk.content.slice(0, windowSize)}...`
    : '';

  const enhancedContent = [
    prevContext && `[前文] ${prevContext}`,
    chunk.content,
    nextContext && `[后文] ${nextContext}`
  ].filter(Boolean).join('\n');

  return {
    ...chunk,
    originalContent: chunk.content,
    enhancedContent,
    enhancementTypes: ['context-window'],
    enhancement: { addedContext: `${prevContext}\n${nextContext}` }
  };
}

// 关键词注入增强
function enhanceWithKeywords(chunk: Chunk, keywords: string[]): EnhancedChunk {
  const keywordStr = keywords.join(', ');

  return {
    ...chunk,
    originalContent: chunk.content,
    enhancedContent: `[关键词: ${keywordStr}]\n${chunk.content}`,
    enhancementTypes: ['keyword-injection'],
    enhancement: { addedKeywords: keywords }
  };
}

// 综合增强
async function enhanceChunk(
  chunk: Chunk,
  context: EnhancementContext
): Promise<EnhancedChunk> {
  let enhanced = { ...chunk, originalContent: chunk.content, enhancedContent: chunk.content };

  // 1. 标题增强（如果有）
  if (context.document.title) {
    enhanced = enhanceWithTitle(enhanced, context.document.title);
  }

  // 2. 上下文窗口增强
  enhanced = enhanceWithContextWindow(
    enhanced,
    context.prevChunk,
    context.nextChunk
  );

  // 3. 关键词增强
  if (context.document.keywords?.length > 0) {
    enhanced = enhanceWithKeywords(enhanced, context.document.keywords);
  }

  // 4. 概要增强（LLM生成，可选）
  if (chunk.content.length > 500) {
    const summary = await generateChunkSummary(chunk.content);
    enhanced.enhancedContent = `[摘要] ${summary}\n${enhanced.enhancedContent}`;
    enhanced.enhancementTypes.push('summary-injection');
    enhanced.enhancement.addedSummary = summary;
  }

  return enhanced;
}
```

---

### 4. Overlap Calculator (重叠计算)

**职责**: 智能计算分块重叠，保证语义连贯

```typescript
interface OverlapCalculator {
  calculate(prevChunk: Chunk, nextChunk: Chunk): Promise<OverlapResult>;
}

interface OverlapResult {
  // 重叠文本
  overlapText: string;

  // 重叠大小
  overlapSize: number;

  // 重叠类型
  type: 'fixed' | 'semantic' | 'adaptive';

  // 重叠位置
  position: {
    prevEnd: number;
    nextStart: number;
  };
}

// 固定重叠
function calculateFixedOverlap(prevChunk: Chunk, overlapSize: number): string {
  return prevChunk.content.slice(-overlapSize);
}

// 语义重叠（在语义边界处重叠）
function calculateSemanticOverlap(prevChunk: Chunk): string {
  // 找到prevChunk最后的完整句子
  const lastSentenceEnd = findLastSentenceEnd(prevChunk.content);
  return prevChunk.content.slice(lastSentenceEnd);
}

// 自适应重叠（根据语义密度）
function calculateAdaptiveOverlap(prevChunk: Chunk, nextChunk: Chunk): string {
  const density = calculateSemanticDensity(prevChunk.content);

  // 高密度内容需要更多重叠
  const overlapRatio = density.level === 'high' ? 0.2 : density.level === 'low' ? 0.05 : 0.1;
  const overlapSize = Math.floor(prevChunk.content.length * overlapRatio);

  return calculateSemanticOverlap(prevChunk) || prevChunk.content.slice(-overlapSize);
}
```

---

### 5. Chunk Validator (分块验证)

**职责**: 验证分块质量，过滤不合格的分块

```typescript
interface ChunkValidator {
  validate(chunks: Chunk[]): Promise<ValidationResult>;
}

interface ValidationResult {
  // 有效分块
  validChunks: Chunk[];

  // 无效分块
  invalidChunks: InvalidChunk[];

  // 统计
  stats: {
    total: number;
    valid: number;
    invalid: number;
    avgChunkSize: number;
    sizeDistribution: SizeDistribution;
  };
}

interface InvalidChunk {
  chunk: Chunk;
  reason: InvalidReason;
  suggestion: string;
}

type InvalidReason =
  | 'too-small'      // 太小
  | 'too-large'      // 太大
  | 'incomplete'     // 不完整（如代码片段截断）
  | 'low-quality'    // 低质量（如全是符号）
  | 'duplicate';     // 重复

// 验证规则
function validateChunks(chunks: Chunk[], config: ValidationConfig): ValidationResult {
  const validChunks: Chunk[] = [];
  const invalidChunks: InvalidChunk[] = [];

  const rules: ValidationRule[] = [
    {
      check: (c) => c.content.length < config.minChunkSize,
      reason: 'too-small',
      suggestion: '合并到相邻分块'
    },
    {
      check: (c) => c.content.length > config.maxChunkSize,
      reason: 'too-large',
      suggestion: '进一步切分'
    },
    {
      check: (c) => isCodeIncomplete(c),
      reason: 'incomplete',
      suggestion: '调整边界确保代码完整'
    },
    {
      check: (c) => isLowQuality(c),
      reason: 'low-quality',
      suggestion: '过滤低质量内容'
    },
    {
      check: (c, all) => isDuplicate(c, all),
      reason: 'duplicate',
      suggestion: '去重'
    }
  ];

  for (const chunk of chunks) {
    let isValid = true;

    for (const rule of rules) {
      if (rule.check(chunk, chunks)) {
        invalidChunks.push({
          chunk,
          reason: rule.reason,
          suggestion: rule.suggestion
        });
        isValid = false;
        break;
      }
    }

    if (isValid) {
      validChunks.push(chunk);
    }
  }

  return {
    validChunks,
    invalidChunks,
    stats: calculateStats(validChunks)
  };
}

// 代码完整性检查
function isCodeIncomplete(chunk: Chunk): boolean {
  if (chunk.metadata?.type !== 'code') return false;

  const content = chunk.content;

  // 检查括号匹配
  const braces = countBraces(content);
  if (braces.open !== braces.close) return true;

  // 检查引号匹配
  const quotes = countQuotes(content);
  if (quotes.open !== quotes.close) return true;

  return false;
}

// 低质量检查
function isLowQuality(chunk: Chunk): boolean {
  const content = chunk.content;

  // 全是空白/符号
  const meaningfulChars = content.replace(/[\s\p{P}]/gu, '');
  if (meaningfulChars.length < content.length * 0.3) return true;

  // 太短且无实质内容
  if (content.length < 20 && !hasKeywords(content)) return true;

  return false;
}
```

---

## Chunking Pipeline 完整流程

```typescript
async function chunkingPipeline(document: Document): Promise<Chunk[]> {
  // Phase 1: 文档分析
  const analysis = await analyzer.analyze(document);

  // Phase 2: 选择切分策略
  const splitter = selectSplitter(analysis.recommendedStrategy);
  const baseChunks = await splitter.split(document.content, getSplitterConfig(analysis));

  // Phase 3: 文本增强
  const enhancedChunks = await Promise.all(
    baseChunks.map((chunk, i) => enhanceChunk(chunk, {
      document: { title: document.metadata.filename, keywords: analysis.keywords },
      prevChunk: baseChunks[i - 1],
      nextChunk: baseChunks[i + 1]
    }))
  );

  // Phase 4: 重叠优化
  const chunksWithOverlap = calculateOverlaps(enhancedChunks);

  // Phase 5: 验证过滤
  const validation = await validator.validate(chunksWithOverlap);

  // Phase 6: 处理无效分块
  const finalChunks = await handleInvalidChunks(validation);

  return finalChunks;
}

// 处理无效分块
async function handleInvalidChunks(validation: ValidationResult): Promise<Chunk[]> {
  const chunks = [...validation.validChunks];

  for (const invalid of validation.invalidChunks) {
    switch (invalid.reason) {
      case 'too-small':
        // 合并到相邻分块
        const neighbor = findNeighborChunk(chunks, invalid.chunk);
        if (neighbor) {
          mergeChunks(neighbor, invalid.chunk);
        }
        break;

      case 'too-large':
        // 进一步切分
        const subChunks = await recursiveSplit(invalid.chunk.content, ['\n', '. ', ' '], 500, 50);
        chunks.push(...subChunks);
        break;

      case 'incomplete':
        // 调整边界（重新切分）
        // 标记需要人工处理或使用其他策略
        break;

      case 'low-quality':
        // 直接丢弃
        break;

      case 'duplicate':
        // 去重，不添加
        break;
    }
  }

  return chunks;
}
```

---

## 提高召回准确率的策略

### 1. 动态语义切分 vs 固定切分对比

| 维度 | 固定切分 | 语义切分 |
|------|----------|----------|
| 语义完整性 | ❌ 可能截断 | ✅ 保持完整 |
| 大小可控性 | ✅ 精确控制 | ⚠️ 范围控制 |
| 处理效率 | ✅ 高 | ⚠️ 中（需计算） |
| 召回准确率 | ⚠️ 70-80% | ✅ 85-95% |

### 2. 文本增强效果

| 增强类型 | 效果 | 适用场景 |
|----------|------|----------|
| 标题前缀 | +10% 相关性 | 所有文档 |
| 上下文窗口 | +15% 理解准确率 | 长文档 |
| 关键词注入 | +8% 关键词匹配 | 技术文档 |
| 概要注入 | +12% 语义理解 | 大分块 |

### 3. 多粒度切分优势

```
查询粒度适配：
- 精确查询 → fine chunks (句子级)
- 概念查询 → medium chunks (段落级)
- 概览查询 → coarse chunks (章节级)

自适应检索：
根据查询复杂度选择不同粒度分块
```

---

## Harness 可追踪

```typescript
interface ChunkingTrace {
  traceId: string;
  documentId: string;
  timestamp: Date;

  stages: {
    analyze: {
      duration: number;
      docType: string;
      strategy: string;
    };
    split: {
      duration: number;
      strategy: string;
      baseChunks: number;
    };
    enhance: {
      duration: number;
      types: string[];
      avgEnhancementRatio: number;
    };
    validate: {
      duration: number;
      valid: number;
      invalid: number;
      invalidReasons: string[];
    };
  };

  output: {
    totalChunks: number;
    avgChunkSize: number;
    sizeDistribution: SizeDistribution;
    granularityLevels: number;
  };
}
```

---

## 验收标准

- [ ] 文档类型正确识别（准确率 > 95%）
- [ ] 切分策略选择正确（符合规则）
- [ ] 语义边界检测有效（边界准确率 > 80%）
- [ ] 分块大小符合约束（min-max范围）
- [ ] 文本增强质量高（增强内容有意义）
- [ ] 代码完整性检查有效（截断检测 > 90%）
- [ ] 低质量分块过滤有效
- [ ] 多粒度切分关联正确
- [ ] 全流程可追踪（Trace完整）
- [ ] 召回准确率提升（对比基准 +10%）