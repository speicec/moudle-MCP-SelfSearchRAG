## Why

OCR服务在处理大型文档时持续出现"fetch failed"错误，导致大量页面处理失败。根因分析表明：PaddleOCR引擎不支持并发调用，而当前服务架构使用单worker uvicorn，在高并发请求（batchSize=5）下服务端资源耗尽崩溃。

观察到的失败模式：
- Batch 1-3：正常运行
- Batch 4：开始不稳定，部分失败
- Batch 5+：全部失败（服务崩溃）

这是当前文档处理流程的阻塞问题，需要在服务端引入请求队列机制，保证OCR请求串行处理，防止服务崩溃。

## What Changes

### 服务端改动

- **新增请求队列系统**：使用 `asyncio.Queue` + Background Worker 实现请求串行处理
- **新增 `/status` 端点**：返回队列状态、处理进度、预估等待时间，供客户端决策
- **新增超时处理**：请求超过指定时间返回 408 Request Timeout
- **新增队列满处理**：队列容量不足时返回 503 Service Unavailable
- **新增环境变量配置**：`OCR_MAX_QUEUE_SIZE`, `OCR_REQUEST_TIMEOUT`

### 客户端改动

- **降低默认 batchSize**：从 5 改为 1-2
- **处理 503/408 响应**：自动等待并重试
- **预检服务状态**：发送请求前检查 `/status` 端点

## Capabilities

### New Capabilities

- `ocr-queue-management`：请求队列管理能力，包括入队、串行处理、超时控制、队列容量限制
- `ocr-service-status`：服务状态监控能力，返回队列长度、处理进度、预估等待时间

### Modified Capabilities

无现有能力修改。这是新增能力，不改变现有 spec 级别行为。

## Impact

### 服务端文件

- `scripts/ocr_service.py`：主要改动，添加队列系统和状态端点
- `scripts/Dockerfile.ocr`：更新启动参数和环境变量

### 客户端文件

- `src/parsers/layout-ocr-service.ts`：配合改动，处理新响应码、预检状态
- `src/parsers/image-pdf-processor.ts`：更新默认配置

### 配置文件

- `.env.example`：新增 `OCR_MAX_QUEUE_SIZE`, `OCR_REQUEST_TIMEOUT` 说明

### API 变化

| 端点 | 变化 |
|------|------|
| `/status` | **新增**：返回队列状态和处理统计 |
| `/health` | **增强**：添加队列信息 |
| `/ocr/layout` | **增强**：可能返回 503/408 响应码 |
| `/ocr/batch` | **增强**：可能返回 503/408 响应码 |