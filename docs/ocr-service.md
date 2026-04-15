# OCR Service Deployment Guide

## Overview

PaddleOCR PP-Structure HTTP服务，用于处理纯图片PDF的版面分析OCR。

## Requirements

### Python Dependencies

```bash
pip install paddlepaddle paddleocr fastapi uvicorn python-multipart pillow numpy
```

### GPU Version (Optional)

如果有GPU且需要加速：

```bash
pip install paddlepaddle-gpu
```

## Quick Start

### 1. Install Dependencies

```bash
pip install -r scripts/ocr_requirements.txt
```

Or install manually:

```bash
pip install paddlepaddle paddleocr fastapi uvicorn python-multipart pillow numpy
```

### 2. Start Service

```bash
# CPU模式（默认）
python scripts/ocr_service.py --host 0.0.0.0 --port 8080

# GPU模式
python scripts/ocr_service.py --host 0.0.0.0 --port 8080 --use-gpu true

# 使用环境变量
export OCR_USE_GPU=false
export OCR_PORT=8080
python scripts/ocr_service.py
```

### 3. Verify Service

```bash
# Health check
curl http://localhost:8080/health

# Expected response
{"status": "healthy", "gpu_enabled": false}
```

## API Endpoints

### POST /ocr/layout

单页图片OCR处理。

**Request:**
- `file`: 图片文件 (multipart/form-data)
- `page_number`: 页码 (form field, optional)

**Response:**
```json
{
  "page_number": 1,
  "blocks": [
    {
      "type": "text",
      "bbox": [100, 50, 400, 80],
      "text": "第一章 引言",
      "confidence": 0.95,
      "cells": null
    }
  ],
  "processing_time_ms": 150.5,
  "width": 1024,
  "height": 768
}
```

### POST /ocr/batch

批量处理多页图片。

**Request:**
- `files`: 多个图片文件 (multipart/form-data)

**Response:**
```json
{
  "results": [...],
  "total_processing_time_ms": 500.0
}
```

### POST /ocr/base64

Base64图片输入。

**Request:**
- `image_base64`: Base64编码的图片 (form field)
- `page_number`: 页码 (form field, optional)

## Block Types

- `title`: 标题
- `text`: 正文文本
- `table`: 表格
- `figure`: 图片/图表
- `header`: 页眉
- `footer`: 页脚
- `formula`: 公式

## Performance Notes

- 首次启动需要加载模型（约10-30秒）
- CPU模式：每页处理约1-3秒
- GPU模式：每页处理约0.3-1秒
- 表格处理比纯文本稍慢

## Troubleshooting

### Model Loading Failed

```bash
# 检查PaddlePaddle安装
python -c "import paddle; print(paddle.__version__)"

# 检查PaddleOCR安装
python -c "from paddleocr import PPStructure; print('OK')"
```

### Port Already in Use

```bash
# 更换端口
python scripts/ocr_service.py --port 8081
```

### Memory Issues

对于大型PDF，建议：
- 减少批量大小（分批处理）
- 增加系统内存
- 使用GPU减少内存占用