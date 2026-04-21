# OCR Service Queue Mode - v2.0.0 Update

## 概述

本次更新解决了OCR服务在高并发请求下的崩溃问题，通过引入 `asyncio.Queue` + Background Worker 实现请求串行处理。

## 问题背景

原始架构下，OCR服务直接处理并发请求，但 PaddleOCR 引擎不支持并发调用：

```
Batch 1-3: 正常运行
Batch 4:  开始不稳定，部分 "fetch failed"
Batch 5+: 全部失败，服务崩溃
```

## 解决方案

### 服务端改动

**文件**: `scripts/ocr_service.py`

| 功能 | 实现方式 |
|------|----------|
| 请求队列 | `asyncio.Queue(maxsize=50)` |
| 后台Worker | `queue_worker()` 串行处理 |
| 队列满响应 | HTTP 503 + `retry_after_seconds` |
| 请求超时 | HTTP 408 + `timeout_seconds` |
| 状态监控 | `/status` 端点 |

### 客户端改动

**文件**: `src/parsers/layout-ocr-service.ts`

- 降低 `batchSize` 默认值: 5 → 2
- 新增 503/408 响应处理和重试逻辑
- 新增 `getStatus()` 和 `checkQueueAvailable()` 方法

**文件**: `src/parsers/image-pdf-processor.ts`

- 同步降低 `batchSize` 默认值: 5 → 2

### 配置

**环境变量** (`.env.example`):

```bash
OCR_MAX_QUEUE_SIZE=50      # 队列最大容量
OCR_REQUEST_TIMEOUT=300    # 请求超时秒数
OCR_ENABLE_STATUS_CHECK=false  # 是否启用状态预检
```

## API 变化

### 新增 `/status` 端点

```bash
curl http://localhost:8080/status
```

响应:
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
    "estimated_wait_seconds": 18
  },
  "stats": {
    "total_processed": 100,
    "total_failed": 2,
    "total_timeout": 0
  }
}
```

### 增强响应码

| 状态码 | 场景 | 客户端处理 |
|--------|------|------------|
| 503 | 队列已满 | 等待 `retry_after_seconds` 后重试 |
| 408 | 请求超时 | 返回空结果，不重试 |

## Docker 部署

```bash
# 构建 (在项目根目录)
docker build -t rag-ocr -f scripts/Dockerfile.ocr scripts/

# 运行
docker run -p 8080:8080 \
  -e OCR_MAX_QUEUE_SIZE=100 \
  -e OCR_REQUEST_TIMEOUT=600 \
  rag-ocr
```

## 文件清单

| 文件 | 变化 |
|------|------|
| `scripts/ocr_service.py` | 主要改动，队列系统 |
| `scripts/ocr_requirements.txt` | 同步更新 |
| `scripts/Dockerfile.ocr` | 新增 |
| `src/parsers/layout-ocr-service.ts` | 客户端适配 |
| `src/parsers/image-pdf-processor.ts` | 配置调整 |
| `docs/ocr-service.md` | 文档更新 |
| `docs/image-pdf-config.md` | 文档更新 |
| `.env.example` | 新增配置说明 |

## 版本信息

- OCR Service: v2.0.0
- 更新日期: 2026-04-21
- OpenSpec Change: `ocr-service-request-queue`