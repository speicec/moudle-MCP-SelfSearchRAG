# Tasks: VLM Enhancement Integration

## Overview

实现Parse阶段VLM增强处理，对OCR识别的table/figure/formula类型块调用VLM获取理解结果，存入文本索引支持语义检索。

## Task List

### Phase 1: ImageStore模块

#### Task 1.1: 创建ImageStore类型定义

**文件**: `src/chunking/image-store.ts`
**状态**: ✅ completed
**预估**: 30分钟

**描述**:
定义ImageBlockRecord类型和ImageStore配置类型。

**验收标准**:
- ImageBlockType: 'figure' | 'table' | 'formula' | 'image'
- ImageBlockRecord包含: id, documentId, pageNumber, imageBuffer, blockType, ocrText, confidence, position, bboxPx, scale
- ImageStoreConfig包含: maxImagesPerDocument, minConfidence

---

#### Task 1.2: 实现ImageStore核心类

**文件**: `src/chunking/image-store.ts`
**状态**: ✅ completed
**预估**: 1.5小时

**描述**:
实现ImageStore类的存储、索引、查询方法。

**验收标准**:
- images: Map<string, ImageBlockRecord>
- documentIndex/pageIndex/typeIndex 三级索引
- addImage() 正确存储并更新索引
- getImagesByDocument() 按文档查询
- getImagesByPage() 按页码查询
- getImagesByPages() 按多个页码查询
- getVlmEligibleImages() 过滤table/figure/formula类型

---

#### Task 1.3: 实现ImageStore持久化

**文件**: `src/chunking/image-store.ts`
**状态**: ✅ completed
**预估**: 1小时

**描述**:
实现ImageStore的磁盘持久化支持。

**验收标准**:
- enablePersistence() 启用持久化
- save() 保存到JSON文件（imageBuffer转base64）
- load() 从JSON文件加载（base64转Buffer）
- autoSave延迟保存机制
- 文件路径: {storagePath}/image-store.json

---

#### Task 1.4: 编写ImageStore单元测试

**文件**: `src/chunking/image-store.test.ts`
**状态**: ✅ completed
**预估**: 1小时

**描述**:
测试ImageStore核心功能。

**验收标准**:
- addImage() 存储和索引更新
- getImagesByPage() 按页查询
- getImagesByPages() 批量查询
- getVlmEligibleImages() 类型过滤
- persistence 保存/加载循环
- validate() 数据一致性检查

---

### Phase 2: 图片裁剪实现

#### Task 2.1: 实现extractImageRegion真实裁剪

**文件**: `src/parsers/image-pdf-processor.ts`
**状态**: ✅ completed
**预估**: 1小时

**描述**:
修改extractImageRegion()方法，实现从页面图片裁剪指定bbox区域。

**验收标准**:
- 使用@napi-rs/canvas（已有依赖）
- Image.src = pageImage.imageBuffer直接赋值
- drawImage裁剪 [x1, y1, x2, y2] 区域
- 边界检查：cropWidth/cropHeight > 0
- fallback：bbox无效时返回整页图片
- 返回裁剪后的PNG Buffer

**关键代码**:
```typescript
const cropCanvas = createCanvas(cropWidth, cropHeight)
const sourceImage = new Image()
sourceImage.src = pageImage.imageBuffer
cropContext.drawImage(sourceImage, x1, y1, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
return cropCanvas.toBuffer('image/png')
```

---

#### Task 2.2: 测试图片裁剪

**文件**: `src/parsers/image-pdf-processor.test.ts`
**状态**: ✅ completed
**预估**: 30分钟

**描述**:
测试extractImageRegion裁剪正确性。

**验收标准**:
- 正常bbox裁剪尺寸正确
- 边界bbox（超出图片范围）处理正确
- 无效bbox返回整页图片
- 输出Buffer是有效PNG

---

### Phase 3: VLM集成

#### Task 3.1: 实现enhanceWithVlm方法

**文件**: `src/parsers/image-pdf-processor.ts`
**状态**: ✅ completed
**预估**: 1.5小时

**描述**:
新增enhanceWithVlm()方法，对table/figure/formula类型调用VLM。

**验收标准**:
- 遍历ocrResults，识别需要VLM的block
- 调用extractImageRegion裁剪图片
- 转换为base64传递给VlmEnhancementService
- 更新block.text为VLM理解结果
- 保留原始OCR信息：block.metadata.ocrText
- 存储：block.metadata.imageBuffer, block.metadata.vlmText

**依赖**: Task 2.1

---

#### Task 3.2: 实现getContextText辅助方法

**文件**: `src/parsers/image-pdf-processor.ts`
**状态**: ✅ completed
**预估**: 30分钟

**描述**:
提取当前块附近的文本作为VLM上下文。

**验收标准**:
- 筛选text/title类型block
- 计算Y坐标距离，阈值200像素
- 最多取3个附近block
- 返回拼接文本

---

#### Task 3.3: 修改process方法流程

**文件**: `src/parsers/image-pdf-processor.ts`
**状态**: ✅ completed
**预估**: 30分钟

**描述**:
在process()方法中增加VLM处理步骤。

**验收标准**:
- Step 3新增：检查enableVlm配置
- 检查vlmEnhancementService.isEnabled()
- 调用enhanceWithVlm()
- VLM失败时降级处理（保留原始OCR）
- 日志输出VLM处理状态

**依赖**: Task 3.1

---

#### Task 3.4: 修改convertToParsedContent存储图片数据

**文件**: `src/parsers/image-pdf-processor.ts`
**状态**: ✅ completed
**预估**: 1小时

**描述**:
在convertToParsedContent()中存储VLM处理的图片数据。

**验收标准**:
- figure类型：content =裁剪图片，metadata.vlmText = VLM结果
- table类型：content = VLM文本，metadata.imageBuffer =裁剪图片
- formula类型：content = VLM文本，metadata.imageBuffer =裁剪图片
- 普通text类型：保持不变

**依赖**: Task 2.1, Task 3.1

---

### Phase 4: 存储集成

#### Task 4.1: 修改document-processor添加ImageStore

**文件**: `src/server/document-processor.ts`
**状态**: ✅ completed
**预估**: 1小时

**描述**:
在document-processor中集成ImageStore，存储图片块。

**验收标准**:
- 从Fastify获取imageStore实例
- 从parsedContent提取images数组
- 调用imageStore.addImage()存储每张图片
- 存储时填充：imageBuffer, blockType, ocrText, pageNumber
- 日志输出存储图片数量

**依赖**: Task 1.2

---

#### Task 4.2: 修改http-server初始化ImageStore

**文件**: `src/server/http-server.ts`
**状态**: ✅ completed
**预估**: 30分钟

**描述**:
在Fastify启动时初始化ImageStore并装饰。

**验收标准**:
- createImageStore()创建实例
- enablePersistence()启用持久化
- fastify.decorate('imageStore', imageStore)
- 与hierarchicalStore同路径持久化

**依赖**: Task 1.3

---

### Phase 5: 检索集成

#### Task 5.1: 修改chat.ts提取imageContexts

**文件**: `src/server/routes/chat.ts`
**状态**: ✅ completed
**预估**: 1小时

**描述**:
在POST /generate中从检索结果提取图片上下文。

**验收标准**:
- 从results提取contentType !== 'text'的chunk
- 提取pageNumber列表
- 从imageStore.getVlmEligibleImages()获取图片
- 构建imageContexts数组：base64, blockType, sourcePage, ocrText
- 日志输出提取图片数量

**依赖**: Task 1.2, Task 4.1

---

#### Task 5.2: 修改chat.ts调用generateMultimodalAnswer

**文件**: `src/server/routes/chat.ts`
**状态**: ✅ completed
**预估**: 30分钟

**描述**:
当有imageContexts时调用generateMultimodalAnswer。

**验收标准**:
- 判断imageContexts.length > 0
- 调用llmGenerationService.generateMultimodalAnswer()
- 传递query, context, sources, imageContexts
- 无图片时保持原有generateWithStreaming()调用
- WebSocket事件流正确

**依赖**: Task 5.1

---

### Phase 6: 配置和环境

#### Task 6.1: 修改DEFAULT_IMAGE_PDF_CONFIG

**文件**: `src/parsers/image-pdf-processor.ts`
**状态**: ✅ completed
**预估**: 10分钟

**描述**:
修改默认配置启用VLM。

**验收标准**:
- enableVlm: true（默认启用）
- 日志提示VLM配置状态

---

#### Task 6.2: 更新.env.example

**文件**: `.env.example`
**状态**: ✅ completed
**预估**: 10分钟

**描述**:
添加VLM相关环境变量示例。

**验收标准**:
- DASHSCOPE_API_KEY=your_api_key
- VLM_ENABLE_THINKING=false
- 添加注释说明

---

### Phase 7: 测试和验证

#### Task 7.1: 端到端集成测试

**文件**: `src/tests/vlm-integration.test.ts` (新增)
**状态**: ✅ completed
**预估**: 1.5小时

**描述**:
测试完整VLM处理流程。

**验收标准**:
- 模拟含表格的PDF上传
- 验证VLM处理触发
- 验证HierarchicalStore包含VLM文本
- 验证ImageStore包含图片
- 模拟检索"表格"关键词
- 验证匹配到VLM结果

**依赖**: Task 1-5全部完成

---

#### Task 7.2: 性能测试

**文件**: `src/tests/vlm-performance.test.ts` (新增)
**状态**: ✅ completed
**预估**: 1小时

**描述**:
测试VLM调用性能指标。

**验收标准**:
- 单个表格VLM调用时间 < 3秒
- 10个表格批量处理时间 < 30秒
- 内存占用增量 < 100MB
- 无内存泄漏

**依赖**: Task 7.1

---

## Task Dependencies

```
Task 1.1 ──┬── Task 1.2 ──┬── Task 1.3 ── Task 1.4
           │              │
           │              └── Task 4.2
           │
           └── Task 4.1

Task 2.1 ──┬── Task 2.2
           │
           └── Task 3.1 ── Task 3.2
                          │
                          └── Task 3.3
                          │
                          └── Task 3.4

Task 1.2 ──┬── Task 4.1 ── Task 5.1 ── Task 5.2
           │
           └── Task 5.1

Task 1-5 ──┬── Task 7.1 ── Task 7.2
```

## Summary

| Phase | 任务数 | 预估时间 |
|-------|--------|----------|
| Phase 1: ImageStore | 4 | 3.5小时 |
| Phase 2: 图片裁剪 | 2 | 1.5小时 |
| Phase 3: VLM集成 | 4 | 3.5小时 |
| Phase 4: 存储集成 | 2 | 1.5小时 |
| Phase 5: 检索集成 | 2 | 1.5小时 |
| Phase 6: 配置 | 2 | 20分钟 |
| Phase 7: 测试 | 2 | 2.5小时 |
| **总计** | **16** | **13.5小时** |