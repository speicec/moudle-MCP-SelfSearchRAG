# Design: image-pdf-processing

## Context

### 当前实现问题

纯图片PDF（扫描文档、无文本层的PDF）无法被当前系统处理。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     问题流程图                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  纯图片PDF输入                                                              │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  parse-stage.ts: processPdfDocument()                               │   │
│  │                                                                     │   │
│  │  // Step 1: 使用 pdf-parse 提取文本                                 │   │
│  │  const textResults = await this.textExtractor.extract(content);    │   │
│  │                                                                     │   │
│  │  // Step 2: 计算总文本量                                            │   │
│  │  const totalText = textResults.reduce((sum, r) =>                  │   │
│  │    sum + r.totalCharacters, 0);                                    │   │
│  │                                                                     │   │
│  │  // totalText === 0 (纯图片PDF无文本层)                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         │  totalText === 0                                                  │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  if (totalText === 0) {                                             │   │
│  │    ctx.addError({                                                   │   │
│  │      message: 'No text could be extracted from the PDF...'          │   │
│  │    });                                                              │   │
│  │    return ctx;  // ❌ 直接退出，不处理                               │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  结果: 纯图片PDF被拒绝，用户无法索引和检索此类文档                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 已有基础设施分析

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  已有组件                              │  状态        │  可复用程度           │
├────────────────────────────────────────┼─────────────┼──────────────────────┤
│  ContentPosition (pdf-parser.ts)       │ 已有        │ ✅ 直接复用           │
│  ├─ page, x, y, width, height          │             │                      │
│                                        │             │                      │
│  PageSegmenter                          │ 已有        │ ✅ 可增强             │
│  ├─ classifyTextBlock()                 │             │ 增加OCR置信度权重    │
│                                        │             │                      │
│  StructureBoundaryDetector              │ 已有        │ ✅ 直接复用           │
│  ├─ detect()                            │             │ 基于文本边界检测     │
│                                        │             │                      │
│  Small-to-Big Retriever                 │ 已有        │ ⚠️ 需增强             │
│  ├─ extractContextWindow()              │             │ 增加物理区域提取     │
│                                        │             │                      │
│  MultimodalEmbeddingService             │ 已有        │ ✅ 直接复用           │
│  ├─ CLIP模型嵌入                        │ 未激活      │ 用于图片索引         │
│                                        │             │                      │
│  LLMGenerationService                   │ 已有        │ ⚠️ 需扩展             │
│  ├─ DeepSeek API                        │             │ 增加多模态支持       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 缺失的关键环节

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐│
│  │ PDF         │ ──▶ │ PDF→图片    │ ──▶ │ 图片嵌入    │ ──▶ │ 索引        ││
│  │ (纯图片)    │     │ 转换        │     │ (CLIP)      │     │             ││
│  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘│
│        ✅                 ❌缺失              ✅已有              ✅已有      │
│                                                                             │
│  或者：                                                                     │
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐│
│  │ PDF         │ ──▶ │ OCR识别     │ ──▶ │ 文本嵌入    │ ──▶ │ 索引        ││
│  │ (纯图片)    │     │ (PaddleOCR) │     │             │     │             ││
│  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘│
│        ✅                 ❌缺失              ✅已有              ✅已有      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- 支持纯图片PDF的完整处理流程（索引 + 检索 + 答案生成）
- 保持OCR输出的布局信息（bbox），用于精确检索定位
- 利用已有CLIP嵌入服务，实现图文混合检索
- 整合VLM（qwen3-vl-flash）增强表格/图表/公式理解
- 低GPU要求方案：PaddleOCR CPU模式 + 云端轻量VLM

**Non-Goals:**
- 不修改现有的普通PDF（有文本层）处理流程
- 不修改WebSocket事件格式（保持前端兼容）
- 不实现实时OCR（仅离线处理）
- 不支持手写体、印章等特殊内容识别

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    纯图片PDF处理架构                                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              纯图片PDF输入
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │  parse-stage.ts              │
                    │  检测 totalText === 0        │
                    │  触发 ImagePdfProcessor      │
                    └──────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
          ┌────────────────────┐       ┌────────────────────┐
          │ 轨道A: PDF→图片→嵌入 │       │ 轨道B: PDF→OCR→文本 │
          │ (视觉检索)          │       │ (文本检索)          │
          └────────────────────┘       └────────────────────┐
                    │                             │        │
                    ▼                             ▼        │
          ┌────────────────────┐       ┌────────────────────┐
          │ PdfToImageConverter │       │ PdfToImageConverter │
          │ (pdfjs-dist)        │       │ (pdfjs-dist)        │
          │ scale=2 (144dpi)    │       │ scale=2 (144dpi)    │
          └────────────────────┘       └────────────────────┘
                    │                             │
                    ▼                             ▼
          ┌────────────────────┐       ┌────────────────────┐
          │ PageImage[]        │       │ PageImage[]        │
          │ (每页一个Buffer)    │       │ (每页一个Buffer)    │
          └────────────────────┘       └────────────────────┘
                    │                             │
                    ▼                             ▼
          ┌────────────────────┐       ┌────────────────────┐
          │ MultimodalEmbed    │       │ LayoutOcrService   │
          │ dingService        │       │ (HTTP API调用)      │
          │ (CLIP)             │       │ PaddleOCR服务       │
          └────────────────────┘       └────────────────────┘
                    │                             │
                    ▼                             ▼
          ┌────────────────────┐       ┌────────────────────┐
          │ visual_index       │       │ OcrPageResult[]    │
          │ (图片嵌入向量)      │       │ ├─ blocks[]        │
          │                    │       │ ├─ bbox [x1,y1,x2,y2]│
          │                    │       │ ├─ block_type       │
          │                    │       │ └─ confidence       │
          └────────────────────┘       └────────────────────┘
                    │                             │
                    │                             ▼
                    │                   ┌────────────────────┐
                    │                   │ OcrBlock → TextBlock│
                    │                   │ bbox → ContentPos   │
                    │                   │ type → LogicalBlock │
                    │                   └────────────────────┘
                    │                             │
                    │                             ▼
                    │                   ┌────────────────────┐
                    │                   │ SemanticChunker    │
                    │                   │ StructureBoundary  │
                    │                   │ Detector           │
                    │                   └────────────────────┘
                    │                             │
                    │                             ▼
                    │                   ┌────────────────────┐
                    │                   │ text_index         │
                    │                   │ (文本嵌入向量)      │
                    │                   └────────────────────┘
                    │                             │
                    └──────────────────┬──────────┘
                                       │
                                       ▼
                          ┌────────────────────────────┐
                          │  HybridSearchService       │
                          │  文本查询 → text_index     │
                          │  图片查询 → visual_index   │
                          │  融合 → 综合检索结果       │
                          └────────────────────────────┘
                                       │
                                       ▼
                          ┌────────────────────────────┐
                          │  检索结果                  │
                          │  ├─ 文本内容 (OCR)         │
                          │  ├─ 位置信息 (bbox)        │
                          │  └─ 图片快照 (区域截图)    │
                          └────────────────────────────┘
                                       │
                                       ▼
                          ┌────────────────────────────┐
                          │  VlmEnhancementService     │
                          │  (qwen3-vl-flash)          │
                          │  表格/图表/公式深度理解    │
                          └────────────────────────────┘
                                       │
                                       ▼
                          ┌────────────────────────────┐
                          │  LLMGenerationService      │
                          │  文本 + 图片理解 → 答案   │
                          └────────────────────────────┘
                                       │
                                       ▼
                              最终答案（含来源引用）
```

## Decisions

### Decision 1: PDF页面渲染方案 - pdfjs-dist

**选择**: 使用 `pdfjs-dist` + `canvas` polyfill

**理由**:
- pdf-lib 不支持页面渲染（只能创建/修改PDF）
- pdfjs-dist 是 Mozilla 官方的 PDF 渲染引擎
- 支持 Node.js 环境（需 canvas polyfill）
- 可控制渲染分辨率（scale参数）

**配置**:
```typescript
// Canvas Polyfill
globalThis.Canvas = createCanvas;
globalThis.Image = Image;

// Worker禁用（简化Node.js环境）
GlobalWorkerOptions.workerSrc = false;

// 渲染配置
{
  scale: 2,              // 144dpi - OCR最佳分辨率
  format: 'png',         // 无损格式
  backgroundColor: '#FFFFFF',
}
```

### Decision 2: OCR引擎方案 - PaddleOCR HTTP服务

**选择**: 部署独立的 PaddleOCR HTTP服务，Node.js通过HTTP调用

**理由**:
- PaddleOCR PP-StructureV2 支持版面分析（block_type + bbox）
- 中文识别效果优秀
- HTTP服务模式：模型预热、稳定延迟、支持并发
- CPU模式可用（无GPU也能工作）

**服务架构**:
```
┌─────────────────────────────────────────────────────────────────────┐
│  PaddleOCR HTTP服务                                                 │
│  ├─ FastAPI + uvicorn                                               │
│  ├─ PPStructure(table_engine)                                       │
│  ├─ POST /ocr/layout     → 单页处理                                 │
│  ├─ POST /ocr/batch      → 批量处理                                 │
│  └─ POST /ocr/base64     → Base64输入                               │
└─────────────────────────────────────────────────────────────────────┘

输出格式:
{
  "type": "table" | "text" | "title" | "figure" | "formula" | "header" | "footer",
  "bbox": [x1, y1, x2, y2],   // 像素坐标
  "text": "识别的文本内容",
  "confidence": 0.95,
  "cells": [...]              // 表格单元格（仅table类型）
}
```

### Decision 3: 布局信息映射策略

**选择**: OCR bbox → ContentPosition，保持像素坐标转换链

**理由**:
- OCR输出的是像素坐标（相对于渲染后的图片）
- 需转换回PDF点坐标（相对于原始PDF）
- 转换公式: `PDF坐标 = 像素坐标 / scale`

**映射关系**:
```typescript
// PaddleOCR bbox [x1, y1, x2, y2] (像素)
// → ContentPosition (PDF点)
const position: ContentPosition = {
  page: pageNumber,
  x: bbox[0] / scale,      // x1 / scale
  y: bbox[1] / scale,      // y1 / scale
  width: (bbox[2] - bbox[0]) / scale,
  height: (bbox[3] - bbox[1]) / scale,
};

// block_type → LogicalBlock.type
const typeMap = {
  'title': 'title',
  'text': 'paragraph',
  'header': 'header',
  'footer': 'footer',
  'table': 'table',
  'figure': 'figure',
  'formula': 'formula',
};
```

### Decision 4: VLM增强方案 - qwen3-vl-flash

**选择**: 使用阿里云 DashScope qwen3-vl-flash

**理由**:
- 轻量级模型，适合低GPU环境
- 支持表格/图表/公式理解
- 中文能力强
- OpenAI兼容API格式，易于集成

**调用配置**:
```typescript
{
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: 'qwen3-vl-flash',
  enableThinking: false,    // 默认关闭（更快）
  // 可选启用: enable_thinking: true, thinking_budget: 8192
}
```

**Prompt设计**:
```typescript
// 表格理解
const tablePrompt = `请分析这张表格图片：
1. 识别表格行列结构
2. 将内容转换为Markdown表格
3. 总结关键数据或结论`;

// 图表理解
const figurePrompt = `请分析这张图表：
1. 识别图表类型（柱状图/折线图/流程图等）
2. 描述数据趋势或流程步骤
3. 总结核心结论`;

// 公式理解
const formulaPrompt = `请识别数学公式：
1. 输出LaTeX格式
2. 解释符号含义
3. 如有数值尝试计算`;
```

### Decision 5: 检索策略 - 双轨索引 + 融合

**选择**: 文本索引 + 图片索引，检索时融合

**理由**:
- 文本索引：关键词匹配、精确检索
- 图片索引：语义匹配、图表理解
- 融合结果：互补增强

**融合策略**:
```typescript
interface HybridSearchResult {
  // 文本匹配
  textMatches: {
    chunkId: string;
    content: string;       // OCR文本
    similarity: number;
    position: ContentPosition;
  }[];

  // 图片匹配
  imageMatches: {
    pageId: string;
    imageBuffer: Buffer;   // 页面图片
    similarity: number;
    pageNumber: number;
  }[];

  // 融合结果
  merged: {
    pageNumber: number;
    textContent: string;
    imageSnapshot: Buffer; // 匹配区域截图
    sources: string[];     // 来源引用
  }[];
}
```

## Risks / Trade-offs

### Risk 1: OCR准确率影响检索质量

**风险**: OCR识别错误会导致文本检索不准确
**影响**: 用户查询可能无法匹配到正确内容
**缓解措施**:
- 使用OCR置信度过滤低质量块
- VLM增强理解作为补充验证
- 图片索引作为备选匹配路径

### Risk 2: VLM API延迟

**风险**: qwen3-vl-flash API调用可能延迟1-3秒
**影响**: 答案生成速度下降
**缓解措施**:
- 仅对表格/图表/公式调用VLM（普通文本不调用）
- 批量处理图片块
- 考虑缓存VLM结果

### Risk 3: 内存占用

**风险**: 大型PDF渲染和OCR处理占用大量内存
**影响**: 可能导致进程内存溢出
**缓解措施**:
- 分批处理页面（batchSize: 5）
- 渲染完成后及时释放Canvas资源
- 设置最大页面数限制（如100页）

### Trade-off 1: 渲染分辨率选择

**选择**: scale=2 (144dpi)
**代价**: 文件大小较大（每页约400KB PNG）
**收益**: OCR效果良好，大多数场景足够

**替代方案**: 
- scale=1 (72dpi): 文件小但OCR可能漏字
- scale=3 (216dpi): OCR最佳但文件很大

### Trade-off 2: VLM思考过程

**选择**: 默认关闭 `enable_thinking`
**代价**: 复杂图表理解可能不够深入
**收益**: 处理速度快，延迟约1秒

**替代方案**: 
- 启用思考过程：理解更深但延迟3-5秒

## Implementation Plan

### Phase 1: 基础设施搭建

**新增文件**:
```
src/parsers/
├─ pdf-to-image-converter.ts    # PDF页面渲染
├─ layout-ocr-service.ts        # OCR服务调用
├─ image-pdf-processor.ts       # 整合处理器

scripts/
├─ ocr_service.py               # PaddleOCR HTTP服务
```

**依赖安装**:
```bash
# Node.js
npm install pdfjs-dist canvas sharp

# Python
pip install paddlepaddle paddleocr fastapi uvicorn python-multipart pillow numpy
```

**环境变量**:
```bash
OCR_SERVICE_URL=http://localhost:8080
DASHSCOPE_API_KEY=your_api_key
```

### Phase 2: parse-stage.ts集成

**修改点**:
```typescript
// src/parsers/parse-stage.ts

// 1. 添加ImagePdfProcessor初始化
private imagePdfProcessor: ImagePdfProcessor | null = null;

// 2. 检测纯图片PDF时调用新流程
if (totalText === 0) {
  if (this.imagePdfProcessor) {
    const parsedContent = await this.imagePdfProcessor.process(content);
    ctx.set('parsedContent', parsedContent);
    return ctx;
  } else {
    ctx.addError({
      message: 'OCR service not configured. Set OCR_SERVICE_URL.',
    });
    return ctx;
  }
}
```

### Phase 3: VLM增强集成

**新增文件**:
```
src/server/services/
├─ VlmEnhancementService.ts     # VLM调用服务
```

**修改文件**:
```
src/server/services/
├─ LLMGenerationService.ts      # 扩展多模态支持
```

### Phase 4: 检索增强

**修改文件**:
```
src/retrieval/
├─ small-to-big-retriever.ts    # 增加物理区域提取
├─ context-assembler.ts         # 增加图片快照
```

## File Structure

```
新增文件:
├─ src/parsers/pdf-to-image-converter.ts
├─ src/parsers/layout-ocr-service.ts
├─ src/parsers/image-pdf-processor.ts
├─ src/server/services/VlmEnhancementService.ts
├─ scripts/ocr_service.py

修改文件:
├─ src/parsers/parse-stage.ts          (约30行修改)
├─ src/server/services/LLMGenerationService.ts  (约50行扩展)
├─ src/retrieval/small-to-big-retriever.ts      (约20行增强)
├─ package.json                         (新增依赖)
├─ .env.example                         (新增配置示例)
```

## API Changes

### OCR服务API

```yaml
POST /ocr/layout:
  request:
    file: image_file
    page_number: int
  response:
    page_number: int
    blocks: OcrBlock[]
    processing_time_ms: float

POST /ocr/batch:
  request:
    files: image_file[]
  response:
    results: OcrPageResult[]
```

### VLM增强API (内部调用)

```yaml
POST /chat/completions (DashScope):
  request:
    model: qwen3-vl-flash
    messages:
      - role: user
        content:
          - type: image_url
            image_url: { url: "data:image/png;base64,..."}
          - type: text
            text: "prompt"
  response:
    choices:
      - message:
          reasoning_content: string (可选)
          content: string
```

## Testing Strategy

### 单元测试

```typescript
// pdf-to-image-converter.test.ts
- convert() 返回正确数量的PageImage
- 图片尺寸与scale参数匹配
- dpi计算正确

// layout-ocr-service.test.ts
- healthCheck() 检测服务状态
- processPage() 返回结构化OcrBlock
- bbox转换到ContentPosition正确

// image-pdf-processor.test.ts
- process() 返回完整的ParsedContent
- textBlocks/blockIndex正确
- 表格cells映射正确
```

### 集成测试

```typescript
// 纯图片PDF端到端测试
- 上传纯图片PDF
- 检查parsedContent生成
- 检查索引建立
- 检查检索结果
- 检查答案生成
```

### 性能测试

```typescript
// 大型PDF处理
- 50页纯图片PDF处理时间 < 5分钟
- 内存占用 < 2GB
- 并发处理能力测试
```