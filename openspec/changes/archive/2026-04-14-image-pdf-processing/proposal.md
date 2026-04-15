# Proposal: image-pdf-processing

## Problem

当前系统无法处理纯图片PDF（扫描文档、无文本层的PDF）。

**影响场景**:
- 扫描的历史文档无法索引
- 图片格式的表格文档无法检索
- 包含图表/流程图的技术文档无法理解

**用户痛点**:
- 上传此类PDF后收到错误提示："No text could be extracted"
- 无法对这类文档进行问答检索

## Proposed Solution

实现完整的纯图片PDF处理流程：

1. **PDF→图片渲染**: 使用pdfjs-dist将PDF页面渲染为图片
2. **布局OCR**: 使用PaddleOCR PP-Structure提取带bbox的结构化内容
3. **双轨索引**: 文本嵌入 + CLIP图片嵌入，融合检索
4. **VLM增强**: 使用qwen3-vl-flash深度理解表格/图表/公式
5. **多模态答案生成**: 文本内容 + 图片理解 → 综合答案

## Key Features

- ✅ 保持OCR布局信息（bbox），用于精确检索定位
- ✅ 低GPU要求方案（PaddleOCR CPU模式 + 云端VLM）
- ✅ 复用已有架构（ContentPosition、Small-to-Big、CLIP嵌入）
- ✅ 与现有普通PDF流程兼容（检测totalText===0时触发新流程）

## Scope

**包含**:
- PDF页面渲染模块
- OCR服务调用层
- 图片PDF整合处理器
- VLM增强服务
- parse-stage.ts集成

**不包含**:
- 前端UI修改
- WebSocket事件格式修改
- 实时OCR处理

## Dependencies

**新增Node.js依赖**:
- pdfjs-dist (PDF渲染)
- canvas (Node.js Canvas polyfill)
- sharp (可选，图片裁剪)

**新增Python依赖**:
- paddlepaddle
- paddleocr
- fastapi
- uvicorn

**新增API依赖**:
- 阿里云DashScope (qwen3-vl-flash)

## Estimated Effort

| 任务 | 预估工作量 |
|------|-----------|
| PDF→图片渲染模块 | 2-3小时 |
| OCR服务部署 | 2-3小时 |
| Node.js OCR调用层 | 1-2小时 |
| ImagePdfProcessor整合 | 2-3小时 |
| parse-stage.ts集成 | 1小时 |
| VLM增强服务 | 2-3小时 |
| 检索增强 | 1-2小时 |
| 测试编写 | 2-3小时 |
| **总计** | **12-17小时** |

## Success Criteria

1. 纯图片PDF可正常上传并索引
2. 用户可对纯图片PDF进行问答检索
3. 表格内容可正确提取和展示
4. 图表内容可被VLM理解并描述
5. 答案包含来源页码引用
6. 50页PDF处理时间 < 5分钟