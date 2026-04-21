---
change: smart-pdf-mixed-mode
created: 2026-04-21
---

# Tasks

## Phase 1: Bug修复 (P0)

- [x] 1.1 修复`text-extractor.ts`分页逻辑
  - 使用`pdf-parse`的`numpages`属性
  - 实现自定义`pagerender`回调
  - 返回结构化`PageTextResult[]`

- [x] 1.2 添加每页诊断方法`diagnose()`
  - 返回`PageTextDiagnostic`结构
  - 包含`pageNumber`, `text`, `charCount`, `isEmpty`

## Phase 2: 混合处理逻辑 (P1)

- [x] 2.1 实现`parse-stage.ts`混合处理方法
  - 新增`processMixedPdfDocument()`
  - 调用诊断方法分类页面
  - 文本页直接处理，图片页走OCR

- [x] 2.2 扩展`image-pdf-processor.ts`
  - 新增`processPages(pdfBuffer, pageNumbers[])`
  - 选择性渲染指定页面

- [x] 2.3 实现页面合并逻辑
  - 按页码顺序合并文本和OCR结果
  - 构建完整的`ParsedContent`

## Phase 3: 配置与测试 (P2)

- [x] 3.1 扩展`pdf-parser.ts`配置
  - 新增`mixedModeThreshold`
  - 新增`forceOcrAll`
  - 新增`skipEmptyPages`

- [x] 3.2 添加环境变量支持
  - `PDF_MIXED_MODE_THRESHOLD`
  - `PDF_FORCE_OCR_ALL`

- [x] 3.3 编写测试用例
  - 纯文字PDF测试
  - 纯扫描PDF测试
  - 混合PDF测试
  - 边界情况测试

## Phase 4: 性能优化 (P3)

- [x] 4.1 实现并行处理优化
  - 文本页批量处理
  - OCR页批量处理（已有batchSize）

- [x] 4.2 添加进度日志
  - 诊断阶段日志
  - 分类结果日志
  - 处理进度日志