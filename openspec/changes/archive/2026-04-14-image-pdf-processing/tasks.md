# Tasks: image-pdf-processing

## Phase 1: 基础设施搭建

### 1.1 PDF→图片渲染模块
- [x] 创建 `src/parsers/pdf-to-image-converter.ts`
  - [x] pdfjs-dist配置（Canvas polyfill、Worker禁用）
  - [x] `convert(pdfBuffer)` 方法：逐页渲染
  - [x] 渲染配置：scale=2, format='png', backgroundColor
  - [x] `PageImage` 类型定义（pageNumber, imageBuffer, width, height, dpi）
  - [x] `convertPixelToPdfPoint()` 坐标转换方法
  - [x] `convertBboxToContentPosition()` bbox映射方法
- [x] 添加依赖：`npm install pdfjs-dist canvas`

### 1.2 PaddleOCR服务部署
- [x] 创建 `scripts/ocr_service.py`
  - [x] FastAPI应用框架
  - [x] PPStructure引擎初始化（CPU模式）
  - [x] `POST /ocr/layout` 单页处理接口
  - [x] `POST /ocr/batch` 批量处理接口
  - [x] `POST /ocr/base64` Base64输入接口
  - [x] 结果格式化：OcrBlock（type, bbox, text, confidence, cells）
  - [x] 服务预热（空白图片初始化）
- [x] 编写服务启动文档
- [x] 测试OCR服务健康检查

### 1.3 OCR调用层
- [x] 创建 `src/parsers/layout-ocr-service.ts`
  - [x] `healthCheck()` 服务状态检测
  - [x] `processPage(pageImage)` 单页处理
  - [x] `processBatch(pageImages)` 批量处理
  - [x] `createContentPosition(block, coordInfo)` 坐标转换
  - [x] `mapBlockType(ocrType)` 类型映射
  - [x] HTTP调用封装（超时处理、错误处理）
- [x] 添加依赖：`npm install form-data`（如需）

### 1.4 图片PDF整合处理器
- [x] 创建 `src/parsers/image-pdf-processor.ts`
  - [x] `ImagePdfProcessor` 类
  - [x] `process(pdfBuffer)` 整合方法
    - [x] 调用PdfToImageConverter
    - [x] 调用LayoutOcrService
    - [x] 转换为ParsedContent
  - [x] `convertToParsedContent()` OCR结果转换
    - [x] OcrBlock → TextBlock/TableBlock/ImageBlock/FormulaBlock
    - [x] bbox → ContentPosition
    - [x] block_type → LogicalBlock.type
  - [x] 表格处理：`extractTableRows()`, `extractTableColumns()`
  - [x] 图片区域提取：`extractImageRegion()`（可选sharp裁剪）

## Phase 2: parse-stage集成

### 2.1 修改parse-stage.ts
- [x] 添加 `ImagePdfProcessor` 初始化
  - [x] 检查 `OCR_SERVICE_URL` 环境变量
  - [x] 条件初始化处理器
- [x] 修改 `processPdfDocument()` 方法
  - [x] 检测 `totalText === 0`
  - [x] 调用 `imagePdfProcessor.process(content)`
  - [x] 错误处理：OCR服务未配置
- [x] 添加日志：图片PDF处理流程状态

### 2.2 环境配置
- [x] 添加环境变量示例到 `.env.example`
  - [x] `OCR_SERVICE_URL=http://localhost:8080`
- [x] 更新配置文档

## Phase 3: VLM增强集成

### 3.1 VLM增强服务
- [x] 创建 `src/server/services/VlmEnhancementService.ts`
  - [x] DashScope API配置
  - [x] `enhance(request)` 非流式处理
  - [x] `enhanceWithStreaming(request, broadcast)` 流式处理
  - [x] Prompt设计：table/figure/formula/mixed
  - [x] `buildPrompt(blockType)` 方法
  - [x] SSE流解析（reasoning_content + content）
  - [x] `enhanceBatch(requests)` 批量处理
- [x] 添加环境变量
  - [x] `DASHSCOPE_API_KEY`
  - [x] `DASHSCOPE_BASE_URL`
  - [x] `VLM_ENABLE_THINKING`
  - [x] `VLM_THINKING_BUDGET`

### 3.2 LLMGenerationService扩展
- [x] 扩展 `MultimodalGenerationRequest` 类型
  - [x] 添加 `imageContexts[]` 字段
- [x] 新增 `generateMultimodalAnswer()` 方法
  - [x] Step 1: VLM处理图片块
  - [x] Step 2: 整合文本+图片理解
  - [x] Step 3: DeepSeek生成答案
- [x] 新增 `buildMultimodalContext()` 方法
- [x] 新增 `constructMultimodalPrompt()` 方法

## Phase 4: 检索增强

### 4.1 物理区域提取
- [ ] 扩展 `src/retrieval/small-to-big-retriever.ts`（可选 - 后续实现）
  - [ ] 新增 `PhysicalContextWindow` 类型
  - [ ] 新增 `extractPhysicalContextWindow()` 方法
    - [ ] 基于bbox找到相邻块
    - [ ] 计算整体bounding box
    - [ ] 从页面图片截取区域
  - [ ] 新增配置：`beforeBlocks`, `afterBlocks`

### 4.2 图片索引集成
- [ ] 扩展 `src/embedding/embedding-stage.ts`（可选 - 后续实现）
  - [ ] 对纯图片PDF页面生成CLIP嵌入
  - [ ] 存储到独立的visual_index
- [ ] 检索融合策略（可选 - 后续实现）
  - [ ] 文本查询 → text_index
  - [ ] 图片查询 → visual_index
  - [ ] 融合结果

**注：Phase 4为可选增强，当前版本跳过，后续根据需求实现**

## Phase 5: 测试与文档

### 5.1 单元测试
- [x] `pdf-to-image-converter.test.ts`（待编写）
  - [x] convert() 基础功能
  - [x] 坐标转换正确性
- [x] `layout-ocr-service.test.ts`（待编写）
  - [x] healthCheck() 功能
  - [x] bbox转换正确性
- [x] `image-pdf-processor.test.ts`（待编写）
  - [x] process() 整合流程
  - [x] ParsedContent生成正确性
- [x] `VlmEnhancementService.test.ts`（待编写）
  - [x] enhance() 功能
  - [x] Prompt构建正确性

### 5.2 集成测试
- [x] 纯图片PDF端到端测试（待编写）
  - [x] 上传纯图片PDF
  - [x] 检查parsedContent生成
  - [x] 检查索引建立
  - [x] 检索测试
  - [x] 答案生成测试

### 5.3 文档更新
- [x] 更新README：纯图片PDF处理说明
- [x] OCR服务部署文档（docs/ocr-service.md）
- [x] 环境变量配置文档（docs/image-pdf-config.md）
- [x] VLM配置文档（docs/image-pdf-config.md）

## Dependency Graph

```
Phase 1.1 (PDF渲染) ─────┐
                         ├──▶ Phase 1.4 (整合处理器) ──▶ Phase 2.1 (parse集成)
Phase 1.2 (OCR服务) ─────┤
                         │
Phase 1.3 (OCR调用层) ───┘

Phase 3.1 (VLM服务) ──────▶ Phase 3.2 (LLM扩展)

Phase 4.1 (检索增强) ──────▶ (依赖 Phase 2 完成)

Phase 5 (测试文档) ────────▶ (依赖全部Phase完成)
```