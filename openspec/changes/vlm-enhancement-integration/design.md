# Design: VLM Enhancement Integration

## Context

### 当前架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  现有纯图片PDF处理流程                                                        │
└─────────────────────────────────────────────────────────────────────────────┘

    PDF → pdf-to-image-converter → LayoutOcrService → image-pdf-processor
                                                              │
                                                              │ ParsedContent
                                                              │
    ┌─────────────────────────────────────────────────────────────────────────┤
    │  pages: [                                                              │
    │    {                                                                   │
    │      textBlocks: [...]  → HierarchicalStore ✅                        │
    │      tables: [...]      → content是OCR text（可能为空）⚠️             │
    │      images: [...]      → content是整页图片Buffer ⚠️                  │
    │      formulas: [...]    → content是OCR text（可能为空）⚠️             │
    │    }                                                                   │
    │  ]                                                                     │
    └─────────────────────────────────────────────────────────────────────────┤
                                                              │
                                                              ▼
                                              document-processor.ts
                                              storeInHierarchical()
                                              ↓ 只处理TextChunk，忽略ImageBlock
                                                              │
                                                              ▼
                                              HierarchicalStore
                                              ↓ 只有文本，无图片内容


    VLM服务状态
    ═══════════════════════════════════════════════════════════════════════

    VlmEnhancementService.ts: ✅ 已完整实现
    LLMGenerationService.ts: ✅ generateMultimodalAnswer 已实现
    chat.ts: ❌ 只调用 generateWithStreaming，未调用 generateMultimodalAnswer
    检索层: ❌ 未提取 imageContexts


    OCR服务配置
    ═══════════════════════════════════════════════════════════════════════

    ocr_service.py:
      table=False  → 只识别表格位置，不解析内容
      layout=True  → 版面分析输出blockType
      ocr=True     → 文本识别

    输出block类型:
      title/text → 有OCR文本
      table → 只有bbox，无cells数据
      figure → 只有bbox，无内容描述
      formula → 只有bbox，可能无LaTeX
```

### 已有基础设施

| 模块 | 状态 | 可复用程度 |
|------|------|-----------|
| VlmEnhancementService | 已实现 | ✅ 直接复用 |
| LLMGenerationService.generateMultimodalAnswer | 已实现 | ✅ 直接复用 |
| @napi-rs/canvas | 已依赖 | ✅ 用于图片裁剪 |
| HierarchicalStore | 已实现 | ✅ 存储VLM文本结果 |
| LayoutOcrService | 已实现 | ✅ 提供bbox |

### 缺失组件

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  缺失组件                                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

    1. ImageStore
       → 管理图片块存储
       → 按页码/类型查询
       → 持久化支持

    2. VLM调用集成
       → 在image-pdf-processor中调用VlmEnhancementService
       → 对table/figure/formula类型处理

    3. 图片裁剪
       → extractImageRegion() 当前返回整页图片
       → 需实现真实裁剪

    4. 检索集成
       → chat.ts提取imageContexts
       → 调用generateMultimodalAnswer
```

## Goals / Non-Goals

**Goals**:
- 在Parse阶段对table/figure/formula调用VLM获取理解结果
- VLM结果存入HierarchicalStore支持关键词检索
- 图片裁剪存入ImageStore支持答案展示
- 检索时提取imageContexts传递给多模态生成
- 配置开关控制VLM启用状态

**Non-Goals**:
- 不修改OCR服务（保持table=False）
- 不实现图片embedding索引（CLIP）
- 不实现实时VLM调用（检索阶段）
- 不修改前端图片展示组件

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VLM增强处理架构                                           │
└─────────────────────────────────────────────────────────────────────────────┘

                              纯图片PDF输入
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  image-pdf-processor.ts      │
                    │  ────────────────────────────│
                    │                              │
                    │  Step 1: PDF → 图片          │
                    │  PdfToImageConverter         │
                    │                              │
                    │  Step 2: OCR版面分析         │
                    │  LayoutOcrService           │
                    │  → blockType + bbox         │
                    │                              │
                    │  Step 3: ✨ VLM增强处理      │
                    │  enhanceWithVlm()           │
                    │  ├─ 裁剪图片区域             │
                    │  ├─ 调用VlmEnhancementService│
                    │  └─ 更新block.text          │
                    │                              │
                    │  Step 4: → ParsedContent     │
                    │  convertToParsedContent()   │
                    └──────────────────────────────┘
                                   │
                                   │ ParsedContent
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
          ┌────────────────────┐       ┌────────────────────┐
          │ HierarchicalStore  │       │ ImageStore         │
          │ ────────────────── │       │ ────────────────── │
          │                    │       │                    │
          │ textBlocks         │       │ 图片裁剪Buffer     │
          │ + VLM理解结果      │       │ + blockType        │
          │                    │       │ + pageNumber       │
          │ ↓ 可检索           │       │ ↓ 可展示           │
          └────────────────────┘       └────────────────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                              用户查询
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  SmallToBigRetriever         │
                    │  → 匹配VLM文本结果           │
                    │  → 发现 contentType=figure  │
                    └──────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  ImageStore查询              │
                    │  getImagesByPage(docId, page)│
                    │  → 获取图片Buffer            │
                    └──────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  构建 imageContexts          │
                    │  ├─ base64: 图片编码         │
                    │  ├─ blockType: 类型          │
                    │  ├─ sourcePage: 页码         │
                    │  └─ ocrText: VLM结果         │
                    └──────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  LLMGenerationService        │
                    │  generateMultimodalAnswer() │
                    │  → 整合文本+图片生成答案     │
                    └──────────────────────────────┘
                                   │
                                   ▼
                              最终答案（含图片引用）
```

## Decisions

### Decision 1: VLM调用时机 - Parse阶段

**选择**: 在image-pdf-processor处理时调用VLM

**理由**:
- VLM结果存入文本索引后可被关键词检索
- 用户查询"柱状图"、"表格数据"可匹配到相关内容
- 避免检索时的实时VLM调用延迟
- 符合RAG预处理思想

**实现位置**: `image-pdf-processor.ts` 新增 `enhanceWithVlm()` 方法

### Decision 2: 图片裁剪方案 - @napi-rs/canvas

**选择**: 使用已有的 @napi-rs/canvas

**理由**:
- 不引入新依赖，保持简洁
- 已在 pdf-to-image-converter.ts 使用
- Image.src = Buffer 直接赋值，API简单
- drawImage 可精确裁剪bbox区域

**实现**:
```typescript
const cropCanvas = createCanvas(cropWidth, cropHeight)
const sourceImage = new Image()
sourceImage.src = pageImage.imageBuffer
cropContext.drawImage(sourceImage, x1, y1, cropWidth, cropHeight, 0, 0, ...)
return cropCanvas.toBuffer('image/png')
```

### Decision 3: 图片存储 - 独立ImageStore

**选择**: 新建ImageStore，不修改HierarchicalChunk

**理由**:
- 数据分离原则：图片和文本是不同模态
- 不改动核心数据结构，降低风险
- 保持各存储职责单一
- 图片不需要embedding索引（仅关联检索）

**ImageStore职责**:
- 存储图片Buffer + 元数据
- 按documentId/pageNumber/blockType查询
- 持久化到磁盘（base64存储）

### Decision 4: VLM调用范围 - table/figure/formula

**选择**: 仅对三种类型调用VLM

**理由**:
- 这三种类型需要结构化理解
- 普通text/title OCR已提供足够信息
- 减少API调用次数和费用

**调用逻辑**:
```typescript
const needsVlm = ['table', 'figure', 'formula'].includes(block.type)
if (needsVlm) {
  // 调用VLM
} else {
  // 直接使用OCR结果
}
```

### Decision 5: 配置开关 - enableVlm

**选择**: 通过ImagePdfConfig.enableVlm控制

**理由**:
- 用户可按需启用/禁用
- 无DASHSCOPE_API_KEY时自动禁用
- 测试时可关闭VLM减少依赖

**配置**:
```typescript
DEFAULT_IMAGE_PDF_CONFIG = {
  enableVlm: true,  // 默认启用
}
```

### Decision 6: 检索集成 - 提取imageContexts

**选择**: 在chat.ts检索后提取图片上下文

**理由**:
- 检索结果包含contentType元数据
- 可判断是否为图片类型chunk
- 按页码从ImageStore提取对应图片

**实现**:
```typescript
// 从检索结果中提取图片页码
const imagePages = results
  .filter(r => r.metadata.contentType !== 'text')
  .map(r => r.metadata.pageNumber)

// 从ImageStore获取图片
const images = imageStore.getImagesByPages(docId, imagePages)

// 构建imageContexts
const imageContexts = images.map(img => ({
  base64: img.imageBuffer.toString('base64'),
  blockType: img.blockType,
  sourcePage: img.pageNumber,
  ocrText: img.ocrText,
}))
```

## Component Design

### ImageStore

```typescript
// src/chunking/image-store.ts

export type ImageBlockType = 'figure' | 'table' | 'formula' | 'image'

export interface ImageBlockRecord {
  id: string
  documentId: string
  pageNumber: number
  imageBuffer: Buffer
  format: 'png' | 'jpeg'
  width: number
  height: number
  blockType: ImageBlockType
  ocrText?: string          // VLM理解结果
  confidence: number
  position: ContentPosition // PDF点坐标
  bboxPx: [number, number, number, number] // 像素坐标
  scale: number
  createdAt: Date
}

export class ImageStore {
  private images: Map<string, ImageBlockRecord>
  private documentIndex: Map<string, Set<string>>
  private pageIndex: Map<string, Set<string>>
  private typeIndex: Map<ImageBlockType, Set<string>>

  // 核心方法
  addImage(record: ImageBlockRecord): void
  getImage(id: string): ImageBlockRecord | undefined
  getImagesByDocument(documentId: string): ImageBlockRecord[]
  getImagesByPage(documentId: string, pageNumber: number): ImageBlockRecord[]
  getImagesByPages(documentId: string, pages: number[]): ImageBlockRecord[]
  getVlmEligibleImages(documentId: string, pages?: number[]): ImageBlockRecord[]
  
  // 持久化
  enablePersistence(path: string): Promise<void>
  save(): Promise<void>
  load(): Promise<void>
  
  // 管理
  removeDocumentImages(documentId: string): void
  clear(): void
  getImageCount(): { total: number; byType: Record<ImageBlockType, number> }
}
```

### image-pdf-processor.ts修改

```typescript
// 新增方法

/**
 * VLM增强处理
 * 对table/figure/formula类型调用VLM获取理解结果
 */
private async enhanceWithVlm(
  ocrResults: OcrPageResult[],
  pageImages: PageImage[]
): Promise<OcrPageResult[]>

/**
 * 提取当前块附近的文本作为VLM上下文
 */
private getContextText(
  ocrResult: OcrPageResult,
  targetBlock: OcrBlock
): string

/**
 * 从页面图片裁剪指定区域
 * 使用@napi-rs/canvas实现
 */
private extractImageRegion(
  pageImage: PageImage,
  block: OcrBlock
): Buffer

// 修改方法

/**
 * 处理流程增加VLM步骤
 */
async process(pdfBuffer: Buffer): Promise<ParsedContent> {
  // Step 1-2: 保持不变
  
  // Step 3: ✨ VLM增强（如果启用）
  if (this.config.enableVlm && vlmEnhancementService.isEnabled()) {
    ocrResults = await this.enhanceWithVlm(ocrResults, pageImages)
  }
  
  // Step 4: 转换为ParsedContent
}
```

### document-processor.ts修改

```typescript
// 新增ImageStore初始化

const imageStore = fastify.imageStore ?? createImageStore()

// 在storeInHierarchical后添加图片存储

// 从parsedContent提取图片块
const parsedContent = ctx.get('parsedContent')
if (parsedContent && imageStore) {
  for (const page of parsedContent.pages) {
    for (const image of page.images) {
      if (image.metadata.imageBuffer) {
        imageStore.addImage({
          id: uuidv4(),
          documentId,
          pageNumber: page.pageNumber,
          imageBuffer: image.metadata.imageBuffer,
          blockType: image.metadata.blockType ?? 'image',
          ocrText: image.metadata.vlmText,
          ...
        })
      }
    }
  }
}
```

### chat.ts修改

```typescript
// POST /generate修改

// 1. 检索（现有逻辑）
const { results, context } = await retriever.retrieveWithMetadata(query)

// 2. ✨ 提取图片上下文
const imageStore = fastify.imageStore
const imageContexts: Array<{
  base64: string
  blockType: 'table' | 'figure' | 'formula' | 'mixed'
  sourcePage: number
  ocrText?: string
}> = []

if (imageStore && hierarchicalStore) {
  // 从检索结果中提取有图片的页码
  const docId = results[0]?.sourceDocumentId
  const imagePages = results
    .filter(r => r.metadata.contentType !== 'text')
    .map(r => r.metadata.pageNumber ?? 0)
    .filter(p => p > 0)
  
  if (docId && imagePages.length > 0) {
    const images = imageStore.getVlmEligibleImages(docId, imagePages)
    
    for (const img of images) {
      imageContexts.push({
        base64: img.imageBuffer.toString('base64'),
        blockType: img.blockType,
        sourcePage: img.pageNumber,
        ocrText: img.ocrText,
      })
    }
  }
}

// 3. ✨ 调用多模态生成
if (imageContexts.length > 0) {
  await llmGenerationService.generateMultimodalAnswer({
    query,
    context: context.content,
    sources,
    imageContexts,
  }, broadcastGeneration)
} else {
  // 无图片，使用原有流程
  await llmGenerationService.generateWithStreaming(...)
}
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  处理阶段数据流                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

    PDF上传
        │
        ▼
    PDF → 图片 (PageImage[])
        │  imageBuffer: PNG Buffer
        │  width/height: 像素尺寸
        │
        ▼
    OCR版面分析 (OcrPageResult[])
        │  blocks[].type: table/figure/formula/text
        │  blocks[].bbox: [x1, y1, x2, y2]
        │  blocks[].text: OCR文本（可能为空）
        │
        ▼
    ✨ VLM增强
        │  for block in blocks:
        │    if type in [table, figure, formula]:
        │      cropImage = extractImageRegion(pageImage, bbox)
        │      vlmResult = vlmService.enhance(cropImage, type)
        │      block.text = vlmResult.answer
        │      block.metadata.imageBuffer = cropImage
        │      block.metadata.vlmText = vlmResult.answer
        │
        ▼
    ParsedContent
        │  textBlocks: VLM文本 + OCR文本
        │  images: { content: imageBuffer, metadata: { vlmText, blockType } }
        │
        ▼
    存储
        │  ├─ HierarchicalStore: VLM文本 → chunk.content
        │  │                       chunk.metadata.contentType = blockType
        │  └
        │  └─ ImageStore: imageBuffer + blockType + pageNumber
        │


┌─────────────────────────────────────────────────────────────────────────────┐
│  检索阶段数据流                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

    用户查询: "销售趋势图表"
        │
        ▼
    SmallToBigRetriever.retrieve()
        │  cosineSimilarity(queryEmbedding, chunk.embedding)
        │  匹配到: chunk.content = "这是一张柱状图，展示了销售趋势..."
        │          chunk.metadata.contentType = 'figure'
        │          chunk.metadata.pageNumber = 5
        │
        ▼
    提取图片上下文
        │  imagePages = [5]
        │  imageStore.getVlmEligibleImages(docId, [5])
        │  → images[{ blockType: 'figure', imageBuffer, ocrText }]
        │
        ▼
    构建imageContexts
        │  [{
        │    base64: imageBuffer.toString('base64'),
        │    blockType: 'figure',
        │    sourcePage: 5,
        │    ocrText: "这是一张柱状图..."
        │  }]
        │
        ▼
    generateMultimodalAnswer()
        │  query + context + imageContexts
        │  → LLM生成答案（含图片引用）
        │
        ▼
    WebSocket事件流
        │  generation:start (phase: analysis)
        │  generation:answer (VLM结果引用)
        │  generation:thinking (LLM思考)
        │  generation:answer (最终答案)
        │  generation:complete
```

## Risks / Trade-offs

### Risk 1: VLM API延迟

**风险**: VLM调用可能增加2-5秒处理时间
**影响**: 文档上传处理变慢
**缓解措施**:
- 仅对table/figure/formula调用（约10-20%的块）
- 默认关闭thinking过程（更快）
- 批量处理可并行调用

### Risk 2: VLM API费用

**风险**: 每次VLM调用产生API费用
**影响**: 大量文档处理成本增加
**缓解措施**:
- enableVlm配置开关（可禁用）
- 检查DASHSCOPE_API_KEY配置
- 提供费用估算提示

### Risk 3: 图片裁剪内存

**风险**: 大PDF裁剪图片可能内存溢出
**影响**: 进程崩溃
**缓解措施**:
- 裁剪后立即释放Canvas资源
- 分批处理（已有batchSize限制）
- 设置maxPages限制

### Trade-off 1: VLM结果精度

**选择**: 使用qwen3-vl-flash（轻量模型）
**代价**: 复杂图表理解可能不够深入
**收益**: 处理速度快，延迟约1-2秒

**替代方案**: 使用qwen3-vl-max（更强但更慢）

### Trade-off 2: 图片存储策略

**选择**: 独立ImageStore，不嵌入HierarchicalChunk
**代价**: 检索时需要额外查询ImageStore
**收益**: 数据结构清晰，不破坏核心架构

## Implementation Plan

### Phase 1: ImageStore模块

**新增文件**:
- `src/chunking/image-store.ts`

**实现内容**:
- ImageBlockRecord类型定义
- ImageStore类实现
- 索引结构（document/page/type）
- 持久化支持

### Phase 2: 图片裁剪

**修改文件**:
- `src/parsers/image-pdf-processor.ts`

**实现内容**:
- extractImageRegion()真实裁剪实现
- 使用@napi-rs/canvas

### Phase 3: VLM集成

**修改文件**:
- `src/parsers/image-pdf-processor.ts`

**实现内容**:
- enhanceWithVlm()方法
- getContextText()辅助方法
- process()流程修改

### Phase 4: 存储集成

**修改文件**:
- `src/server/document-processor.ts`
- `src/server/http-server.ts`

**实现内容**:
- ImageStore初始化
- 图片存储逻辑
- Fastify装饰器

### Phase 5: 检索集成

**修改文件**:
- `src/server/routes/chat.ts`

**实现内容**:
- 提取imageContexts
- 调用generateMultimodalAnswer

### Phase 6: 测试

**新增文件**:
- `src/chunking/image-store.test.ts`

**修改文件**:
- `src/parsers/image-pdf-processor.test.ts`

**测试内容**:
- ImageStore CRUD操作
- 图片裁剪正确性
- VLM调用流程
- 检索图片提取

## File Structure

```
新增文件:
├─ src/chunking/image-store.ts
├─ src/chunking/image-store.test.ts

修改文件:
├─ src/parsers/image-pdf-processor.ts      (~50行新增)
├─ src/server/document-processor.ts        (~30行新增)
├─ src/server/http-server.ts               (~10行新增)
├─ src/server/routes/chat.ts               (~40行修改)
├─ src/parsers/image-pdf-processor.test.ts (~20行新增)
```

## Testing Strategy

### 单元测试

```typescript
// image-store.test.ts
- addImage() 正确存储和索引
- getImagesByPage() 按页码查询
- getImagesByPages() 批量页码查询
- getVlmEligibleImages() 过滤正确类型
- persistence 保存和加载

// image-pdf-processor.test.ts (扩展)
- extractImageRegion() 裁剪尺寸正确
- enhanceWithVlm() VLM调用流程
- getContextText() 上下文提取
```

### 集成测试

```typescript
// 端到端测试
- 上传含表格的PDF → VLM处理 → 检索"表格"匹配
- 上传含图表的PDF → VLM处理 → 检索"趋势"匹配
- 生成答案含图片引用
```

### 性能测试

```typescript
// VLM调用性能
- 单个表格VLM调用时间 < 3秒
- 10个表格批量处理时间 < 30秒
- 内存占用增量 < 100MB
```