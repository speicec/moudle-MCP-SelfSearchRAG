# 文档处理主流水线 (Document Processing Pipeline)

```plantuml
@startuml
left to right direction

skinparam backgroundColor #f0f4f8
skinparam defaultFontSize 11
skinparam defaultFontName Arial

rectangle "INGEST 阶段" as ingest_stage #dbeafe {
  mxgraph.bpmn.event.start "文档上传" as start
  rectangle "格式验证\n(Validate Document)" as validate
  rectangle "元数据提取\n(Extract Metadata)" as metadata
  mxgraph.bpmn.data2.dataObject "Document\nMetadata" as doc_meta
  rectangle "队列注册\n(Queue Register)" as queue_reg
  validate --> metadata
  metadata --> queue_reg
  metadata -up-> doc_meta
}

mxgraph.bpmn.gateway2.exclusive "文档类型?" as doc_type_gw

rectangle "PARSE 阶段 — 文本 PDF" as parse_text #e0f2fe {
  rectangle "pdfjs-dist\n提取文本层\n(Extract Text)" as extract_text
  mxgraph.bpmn.data2.dataObject "Raw Text\nContent" as raw_text
  extract_text --> raw_text
}

rectangle "PARSE 阶段 — 图片 PDF" as parse_image #e0f2fe {
  rectangle "pdfjs-dist\n渲染为 PNG\n(Render to Image)" as render_png
  rectangle "PaddleOCR\n版面分析\n(Layout Analysis)" as ocr_layout
  mxgraph.bpmn.data2.dataObject "OcrPageResult[]\n(blocks + bbox)" as ocr_result
  rectangle "VLM 增强处理\n(DashScope qwen3-vl-flash)\n理解表格/图表/公式" as vlm_enhance
  mxgraph.bpmn.data2.dataObject "ParsedContent\n(text + tables + images)" as parsed_content
  render_png --> ocr_layout
  ocr_layout --> ocr_result
  ocr_result --> vlm_enhance
  vlm_enhance --> parsed_content
}

rectangle "PARSE 阶段 — 其他格式" as parse_other #e0f2fe {
  rectangle "格式特定解析器\n(Text/Markdown/HTML)" as other_parser
  other_parser
}

mxgraph.bpmn.gateway2.exclusive "是否为\n图片PDF?" as is_image_pdf

mxgraph.bpmn.event.errorBound "格式不支持\n返回错误" as err_format

mxgraph.bpmn.gateway2.parallel "进入\nCHUNK" as to_chunk

rectangle "CHUNK 阶段" as chunk_stage #e0e7ff {
  rectangle "句子切片\n(Sentence Split)" as sentence_split
  rectangle "句子嵌入\n(Sentence Embedding)" as sentence_embed
  rectangle "断崖检测\n(Cliff Detection)\n相似度梯度分析" as cliff_detect
  rectangle "语义边界切分\n(Boundary Selection)" as boundary
  rectangle "层级 Chunk 构建\nParent + Small Chunks" as hier_build
  rectangle "质量过滤\n(QualityFilter)" as quality_filter
  mxgraph.bpmn.data2.dataObject "Parent Chunks\n+ Small Chunks" as chunks_data

  sentence_split --> sentence_embed
  sentence_embed --> cliff_detect
  cliff_detect --> boundary
  boundary --> hier_build
  hier_build --> quality_filter
  quality_filter --> chunks_data
}

mxgraph.bpmn.event.errorBound "分块失败\n返回错误" as err_chunk

rectangle "EMBED 阶段" as embed_stage #ecfdf5 {
  rectangle "文本嵌入\n(Text Embedding)\nAPI / Local / Hybrid" as text_embed
  rectangle "图片嵌入\n(Image Embedding)\nCLIP-ViT" as image_embed
  mxgraph.bpmn.data2.dataObject "Embedding\nVectors" as embed_vectors

  text_embed --> embed_vectors
  image_embed --> embed_vectors
}

mxgraph.bpmn.event.errorBound "嵌入失败\n返回错误" as err_embed

rectangle "INDEX 阶段" as index_stage #f5f3ff {
  rectangle "向量存储\n(Qdrant / In-Memory)" as vector_store
  rectangle "层级存储\n(HierarchicalStore)" as hier_store
  rectangle "图片存储\n(ImageStore)" as image_store

  vector_store
  hier_store
  image_store
}

mxgraph.bpmn.event.end "处理完成\n(Document Ready)" as end_ok

start --> validate
queue_reg --> doc_type_gw

doc_type_gw --> parse_text : "文本PDF"
doc_type_gw --> is_image_pdf : "PDF文档"
doc_type_gw --> parse_other : "其他格式"

is_image_pdf --> render_png : "是(无文本层)"
is_image_pdf --> extract_text : "否(有文本层)"

extract_text --> to_chunk
parsed_content --> to_chunk
other_parser --> to_chunk
doc_type_gw --> err_format : "不支持"

to_chunk --> sentence_split

chunks_data --> text_embed
chunks_data --> image_embed

embed_vectors --> vector_store
embed_vectors --> hier_store
chunks_data --> image_store

vector_store --> end_ok
hier_store --> end_ok

@enduml
```

## 流程说明

| 阶段 | 输入 | 处理 | 输出 |
|------|------|------|------|
| **INGEST** | 原始文档文件 | 格式验证、元数据提取、队列注册 | Document Metadata |
| **PARSE (文本PDF)** | PDF 文件 | pdfjs-dist 提取文本层 | Raw Text Content |
| **PARSE (图片PDF)** | 扫描件 PDF | pdfjs-dist 渲染PNG → PaddleOCR 版面分析 → VLM 增强 | ParsedContent (text+tables+images) |
| **PARSE (其他)** | txt/md/html 等 | 格式特定解析器 | Raw Text |
| **CHUNK** | 纯文本内容 | 句子切片 → 嵌入 → 断崖检测 → 语义边界 → 层级构建 → 质量过滤 | Parent + Small Chunks |
| **EMBED** | Chunks | 文本嵌入 (API/Local/Hybrid) + 图片嵌入 (CLIP-ViT) | Embedding Vectors |
| **INDEX** | Chunks + Vectors | 向量存储 (Qdrant/In-Memory) + 层级存储 (HierarchicalStore) | 可检索索引 |

### 错误处理策略

- **格式不支持** → 立即返回错误，不进入后续阶段
- **PDF 解析失败** → 重试一次，仍失败则返回部分结果
- **OCR 失败** → 跳过 OCR，保留原始图片信息继续
- **VLM 增强失败** → 保留原始 OCR 文本，不阻塞流程
- **分块/嵌入/索引失败** → 返回错误，Pipeline 标记为 failed
