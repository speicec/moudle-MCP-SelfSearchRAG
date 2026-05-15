# 图片 PDF 处理流程 (Image PDF Processing Pipeline)

```plantuml
@startuml
left to right direction

skinparam backgroundColor #f0f4f8
skinparam defaultFontSize 11
skinparam defaultFontName Arial
skinparam rectangleBackgroundColor #e0f2fe

mxgraph.bpmn.event.start "纯图片 PDF 上传\n(扫描文档/无文本层)" as start

rectangle "Step 1: PDF → 图片渲染\n(PdfToImageConverter)\n\npdfjs-dist Canvas 渲染\nscale=2 (144dpi)\n输出: PageImage[]" as step1 #dbeafe

mxgraph.bpmn.data2.dataObject "PageImage[]\n{pageNumber,\nimageBuffer,\nwidth, height}" as page_images

rectangle "Step 2: OCR 版面分析\n(LayoutOcrService)\n\nPaddleOCR PP-Structure\n输入: PageImage (PNG)\n配置: table=False" as step2 #bfdbfe

mxgraph.bpmn.data2.dataObject "OcrPageResult[]\nblocks:\n{type, bbox, text,\nconfidence}" as ocr_result

mxgraph.bpmn.gateway2.exclusive "blockType?" as block_type_gw

rectangle "Text/Title Block\n直接保留 OCR 文本" as text_block #d1fae5
rectangle "Table Block\n\n1. 按 bbox 裁剪图片\n2. Base64 编码\n3. VLM API 调用\n4. 输出: Markdown 表格" as table_block #fef3c7
rectangle "Figure Block\n\n1. 按 bbox 裁剪图片\n2. Base64 编码\n3. VLM API 调用\n4. 输出: 图表类型+趋势描述" as figure_block #fce7f3
rectangle "Formula Block\n\n1. 按 bbox 裁剪图片\n2. Base64 编码\n3. VLM API 调用\n4. 输出: LaTeX+符号解释" as formula_block #ede9fe

rectangle "Step 3: VLM 增强\n(VlmEnhancementService)\n\nDashScope qwen3-vl-flash\nPOST /chat/completions\n图片 Base64 + 定制 Prompt" as vlm_service #e0e7ff

mxgraph.bpmn.data2.dataObject "VLM 输出:\n• table → Markdown 表格\n• figure → 类型+趋势+结论\n• formula → LaTeX+符号解释" as vlm_output

mxgraph.bpmn.gateway2.parallel "合并结果" as merge_gw

rectangle "Step 4: 转换为 ParsedContent\n\npages: [{\n  pageNumber, textBlocks,\n  tables: [{content(VLM), rows, cells}],\n  images: [{content, position, vlmText}],\n  formulas: [{content(VLM), latex}]\n}]\ntotalPages: N" as step4 #e2e8f0

mxgraph.bpmn.data2.dataObject "ParsedContent\n(WLM理解结果存入content\n→ 可被关键词检索)" as parsed_content_final

mxgraph.bpmn.event.end "进入语义分块阶段" as end_ok

mxgraph.bpmn.event.errorBound "渲染失败" as err_render

mxgraph.bpmn.event.errorBound "OCR 失败\n(跳过OCR继续)" as err_ocr

mxgraph.bpmn.event.errorBound "VLM 失败\n(保留原始OCR文本)" as err_vlm

start --> step1
step1 --> page_images
page_images --> step2
step2 --> ocr_result
ocr_result --> block_type_gw

block_type_gw --> text_block : "text / title"
block_type_gw --> table_block : "table"
block_type_gw --> figure_block : "figure"
block_type_gw --> formula_block : "formula"

table_block --> vlm_service
figure_block --> vlm_service
formula_block --> vlm_service

text_block --> merge_gw
vlm_service --> vlm_output
vlm_output --> merge_gw

merge_gw --> step4
step4 --> parsed_content_final
parsed_content_final --> end_ok

@enduml
```

## VLM Prompt 定制策略

| Block 类型 | VLM Prompt 要点 | 输出格式 |
|-----------|----------------|---------|
| **table** | "请分析表格，转换为 Markdown 格式，总结关键数据趋势和异常值" | Markdown 表格 + 摘要 |
| **figure** | "请分析图表类型(柱状图/折线图/饼图等)，描述数据趋势，总结核心结论" | 图表类型 + 趋势描述 + 结论 |
| **formula** | "请识别公式，输出 LaTeX 格式，解释每个符号的含义" | LaTeX 表达式 + 符号说明 |

## 关键设计决策

1. **VLM 结果存入 content 字段** → 可被关键词检索命中，提升召回率
2. **图片 Buffer 存入 metadata.imageBuffer** → 答案生成时可在前端展示原始图表
3. **ContentPosition 保留 bbox** → 检索结果可精确定位到原页面位置
4. **VLM 失败时保留 OCR 原文** → 不阻塞流程，降级可用
