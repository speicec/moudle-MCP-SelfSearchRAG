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

### GET /status

获取队列状态和处理统计。

**Response:**
```json
{
  "status": "healthy",
  "gpu_enabled": false,
  "queue": {
    "size": 5,
    "max_size": 50,
    "available_slots": 45
  },
  "timing": {
    "avg_processing_time_ms": 3000.0,
    "avg_queue_wait_ms": 1500.0,
    "estimated_wait_seconds": 18
  },
  "stats": {
    "total_processed": 100,
    "total_failed": 2,
    "total_timeout": 0
  }
}
```

### GET /health

健康检查（增强版）。

**Response:**
```json
{
  "status": "healthy",
  "gpu_enabled": false,
  "queue_size": 5
}
```

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

**Error Responses:**
- **503 Service Unavailable**: Queue is full, retry later
  ```json
  {
    "detail": {
      "error": "Queue is full, please retry later",
      "queue_size": 50,
      "max_size": 50,
      "retry_after_seconds": 30.0
    }
  }
  ```
- **408 Request Timeout**: Request exceeded timeout
  ```json
  {
    "detail": {
      "error": "Request timeout",
      "timeout_seconds": 300,
      "page_number": 1
    }
  }
  ```
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

## Queue Mode (v2.0)

服务使用 asyncio.Queue + Background Worker 实现请求串行处理：

- **队列容量**: 默认50个请求，可通过 `OCR_MAX_QUEUE_SIZE` 调整
- **请求超时**: 默认300秒，可通过 `OCR_REQUEST_TIMEOUT` 调整
- **串行处理**: 所有OCR请求按顺序处理，避免并发冲突
- **状态监控**: `/status` 端点返回队列状态和预估等待时间

客户端建议：
- 批量处理时降低 batchSize 到 1-2
- 收到 503 时等待 `retry_after_seconds` 后重试
- 可选启用状态预检 (`OCR_ENABLE_STATUS_CHECK=true`)

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
- 启用队列模式（自动串行处理）

### Queue Full (503 Error)

如果频繁收到 503 错误：
- 调大 `OCR_MAX_QUEUE_SIZE`
- 降低客户端 `OCR_BATCH_SIZE`
- 启用 `OCR_ENABLE_STATUS_CHECK` 预检队列状态
- 增加 `OCR_REQUEST_TIMEOUT` 避免超时