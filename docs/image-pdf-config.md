# Image PDF Processing Configuration

## Overview

This document describes the configuration for processing image-based PDFs (scanned documents without text layers).

## Quick Start

### 1. Install OCR Dependencies

```bash
pip install paddlepaddle paddleocr fastapi uvicorn python-multipart pillow numpy
```

### 2. Start OCR Service

```bash
python scripts/ocr_service.py --host 0.0.0.0 --port 8080
```

### 3. Configure Environment

Add to `.env`:

```bash
OCR_SERVICE_URL=http://localhost:8080
```

### 4. (Optional) Configure VLM for Enhanced Understanding

```bash
DASHSCOPE_API_KEY=your-dashscope-api-key
```

## Environment Variables

### OCR Service

| Variable | Description | Default |
|----------|-------------|---------|
| `OCR_SERVICE_URL` | OCR HTTP service URL | `http://localhost:8080` |
| `OCR_BATCH_SIZE` | Pages per batch | `2` |
| `OCR_MAX_QUEUE_SIZE` | Max queue requests | `50` |
| `OCR_REQUEST_TIMEOUT` | Request timeout seconds | `300` |
| `OCR_ENABLE_STATUS_CHECK` | Pre-check queue status | `false` |

### VLM Enhancement

| Variable | Description | Default |
|----------|-------------|---------|
| `DASHSCOPE_API_KEY` | DashScope API key | (required for VLM) |
| `DASHSCOPE_BASE_URL` | DashScope API base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `DASHSCOPE_MODEL` | VLM model | `qwen3-vl-flash` |
| `VLM_ENABLE_THINKING` | Enable thinking process | `false` |
| `VLM_THINKING_BUDGET` | Thinking token limit | `8192` |

## Processing Flow

When a PDF is uploaded:

1. **Text extraction attempt**: `pdf-parse` tries to extract text
2. **Image PDF detection**: If `totalText === 0`, triggers image PDF flow
3. **PDF → Image**: `pdfjs-dist` renders pages to PNG (144dpi)
4. **OCR**: `PaddleOCR` extracts text with layout analysis
5. **Indexing**: Both text and image embeddings stored
6. **Retrieval**: Hybrid search (text + image)
7. **Answer generation**: LLM + optional VLM enhancement

## OCR Service Details

See [docs/ocr-service.md](./ocr-service.md) for OCR service deployment guide.

## VLM Usage

VLM (qwen3-vl-flash) is used for:

- Table structure understanding
- Chart/diagram analysis
- Formula recognition

VLM is **only called for these block types**, not for regular text.

## Client-side Coordination

服务端队列模式下，客户端应配合调整：

### 1. 降低 Batch Size
```bash
OCR_BATCH_SIZE=2  # 从默认5降到2
```

### 2. 处理 503/408 响应
客户端自动处理：
- **503**: 等待 `retry_after_seconds` 后重试
- **408**: 返回空结果（不重试，避免长时间等待）

### 3. 状态预检（可选）
```bash
OCR_ENABLE_STATUS_CHECK=true
```
发送请求前检查 `/status`，避开队列高峰。

### 4. 批次间延迟
客户端在批次间自动添加1秒延迟，让队列有时间处理。

## Performance Notes

| Phase | CPU Mode | GPU Mode |
|-------|----------|----------|
| PDF rendering | 0.5-1s/page | 0.5-1s/page |
| OCR | 1-3s/page | 0.3-1s/page |
| VLM (per block) | 1-3s | 1-3s (cloud) |

## Troubleshooting

### OCR Service Not Connected

```
Error: OCR service is not available
```

Solution: Start OCR service first:
```bash
python scripts/ocr_service.py
```

### OCR Results Missing

If OCR returns empty blocks:

1. Check PDF rendering quality (increase scale)
2. Check PaddleOCR logs
3. Verify image is not corrupted

### VLM API Error

```
Error: VLM API error: 401
```

Solution: Check DASHSCOPE_API_KEY is valid.