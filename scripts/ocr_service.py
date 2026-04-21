#!/usr/bin/env python3
"""
PaddleOCR PP-StructureV3 HTTP Service
支持版面分析的OCR服务，输出结构化结果

依赖安装：
  pip install paddlepaddle paddleocr paddlex[ocr] fastapi uvicorn python-multipart pillow numpy opencv-python-headless

启动：
  python scripts/ocr_service.py --host 0.0.0.0 --port 8080 --use-gpu false

环境变量：
  OCR_USE_GPU: 是否使用GPU (default: false)
  OCR_PORT: 服务端口 (default: 8080)
  OCR_MAX_QUEUE_SIZE: 队列最大容量 (default: 50)
  OCR_REQUEST_TIMEOUT: 请求超时秒数 (default: 300)
"""

import argparse
import io
import json
import base64
import time
import os
import asyncio
from dataclasses import dataclass
from typing import List, Optional, Generator, Any

import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

# Disable oneDNN on Windows due to compatibility issues
os.environ['FLAGS_USE_MKLDNN'] = '0'
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'

# PaddleOCR导入 - PPStructureV3是新版本
from paddleocr import PPStructureV3

# ========================================
# Queue Configuration
# ========================================

MAX_QUEUE_SIZE = int(os.getenv('OCR_MAX_QUEUE_SIZE', '50'))
REQUEST_TIMEOUT_SECONDS = int(os.getenv('OCR_REQUEST_TIMEOUT', '300'))

# ========================================
# 配置
# ========================================

class OcrConfig:
    """OCR服务配置"""
    def __init__(self):
        self.use_gpu = os.getenv('OCR_USE_GPU', 'false').lower() == 'true'
        self.show_log = False
        self.lang = 'ch'        # 中文

# ========================================
# 响应数据结构
# ========================================

class OcrBlock(BaseModel):
    """单个OCR块的输出"""
    type: str                 # title/text/table/figure/header/footer/formula
    bbox: List[int]           # [x1, y1, x2, y2] 像素坐标
    text: str                 # OCR识别文本
    confidence: float         # 置信度 0-1
    cells: Optional[List[dict]] = None  # 表格单元格（仅table类型）

class OcrResult(BaseModel):
    """单页OCR结果"""
    page_number: int
    blocks: List[OcrBlock]
    processing_time_ms: float
    width: int                # 图片宽度
    height: int               # 图片高度

class BatchOcrResult(BaseModel):
    """批量OCR结果"""
    results: List[OcrResult]
    total_processing_time_ms: float

class QueueStatus(BaseModel):
    """队列状态响应"""
    status: str
    gpu_enabled: bool
    queue: dict
    timing: dict
    stats: dict

# ========================================
# Queue Item Dataclass
# ========================================

@dataclass
class QueueItem:
    """队列中的请求项"""
    image_array: np.ndarray
    page_number: int
    image_width: int
    image_height: int
    future: asyncio.Future
    arrived_at: float  # 入队时间戳

# ========================================
# OCR引擎初始化
# ========================================

def create_ocr_engine(config: OcrConfig):
    """创建PP-StructureV3引擎"""
    print(f"[OCR] Initializing PP-StructureV3 engine (GPU: {config.use_gpu})")

    # PPStructureV3 API 参数
    # 注意：Windows上禁用MKL-DNN避免oneDNN兼容性问题
    engine = PPStructureV3(
        # 禁用表格识别（由VLM处理）
        use_table_recognition=False,
        # 禁用公式识别（由VLM处理）
        use_formula_recognition=False,
        # 禁用印章识别
        use_seal_recognition=False,
        # 禁用图表识别（由VLM处理）
        use_chart_recognition=False,
        # 语言
        lang=config.lang,
        # 设备：GPU 或 CPU
        device='gpu' if config.use_gpu else 'cpu',
        # Windows兼容：禁用MKL-DNN
        enable_mkldnn=False,
    )

    # 预热：处理一个空白图片，确保模型加载
    print("[OCR] Preheating engine...")
    dummy_image = np.zeros((100, 100, 3), dtype=np.uint8)
    try:
        result = list(engine.predict(dummy_image))
        print(f"[OCR] Engine ready (preheat complete)")
    except Exception as e:
        print(f"[OCR] Preheat warning: {e}")
        print("[OCR] Engine initialized (may need first call to fully load)")

    return engine

# ========================================
# 结果转换函数
# ========================================

def process_v3_result(result: dict, image_width: int, image_height: int) -> List[OcrBlock]:
    """处理PPStructureV3结果，转换为结构化输出"""
    blocks = []

    # 从layout_det_res提取布局块
    layout_det_res = result.get('layout_det_res', {})
    boxes = layout_det_res.get('boxes', [])

    # 从overall_ocr_res提取OCR文本
    overall_ocr_res = result.get('overall_ocr_res', {})
    rec_texts = overall_ocr_res.get('rec_texts', [])
    rec_polys = overall_ocr_res.get('rec_polys', [])
    rec_scores = overall_ocr_res.get('rec_scores', [])

    # 如果有OCR文本，合并为文本块
    if rec_texts:
        # 合并所有识别文本
        full_text = '\n'.join(rec_texts)
        avg_score = sum(rec_scores) / len(rec_scores) if rec_scores else 0.0

        blocks.append(OcrBlock(
            type='text',
            bbox=[0, 0, image_width, image_height],
            text=full_text,
            confidence=avg_score,
            cells=None,
        ))

    # 从布局检测结果提取块
    for box in boxes:
        label = box.get('label', 'text')
        score = box.get('score', 0.0)
        coord = box.get('coordinate', [0, 0, image_width, image_height])

        # 转换坐标为整数
        bbox = [int(c) if hasattr(c, '__int__') else int(float(c)) for c in coord]

        # 映射label到block type
        block_type = label
        if label in ('image', 'chart', 'figure'):
            block_type = 'figure'
        elif label == 'table':
            block_type = 'table'
        elif label in ('title', 'text', 'header', 'footer'):
            block_type = label
        else:
            block_type = 'text'

        blocks.append(OcrBlock(
            type=block_type,
            bbox=bbox,
            text='',  # 文本在overall_ocr_res中
            confidence=score,
            cells=None,
        ))

    # 按bbox的y1排序（从上到下的阅读顺序）
    blocks.sort(key=lambda b: b.bbox[1])

    return blocks

# ========================================
# FastAPI应用
# ========================================

app = FastAPI(
    title="PaddleOCR Layout Service",
    description="OCR服务 with 版面分析和请求队列",
    version="2.0.0",
)

# 全局OCR引擎和队列状态
ocr_engine = None
ocr_config: OcrConfig = OcrConfig()
request_queue: asyncio.Queue = None
worker_task: asyncio.Task = None

# 统计信息
queue_stats = {
    "total_processed": 0,
    "total_failed": 0,
    "total_timeout": 0,
    "avg_processing_time_ms": 0.0,
    "avg_queue_wait_ms": 0.0,
}

# ========================================
# Background Worker
# ========================================

async def queue_worker():
    """
    后台 worker：从队列中逐个取出请求，串行执行 OCR
    """
    global queue_stats

    print("[OCR Worker] Started, waiting for requests...")

    while True:
        try:
            # 从队列获取下一个请求
            item: QueueItem = await request_queue.get()

            # 计算队列等待时间
            queue_wait_time = (time.time() - item.arrived_at) * 1000

            print(f"[OCR Worker] Processing page {item.page_number} (queue wait: {queue_wait_time:.0f}ms)")

            start_process_time = time.time()

            try:
                # 执行 OCR（同步调用）
                results = list(ocr_engine.predict(item.image_array))

                if len(results) == 0:
                    blocks = []
                else:
                    blocks = process_v3_result(results[0], item.image_width, item.image_height)

                processing_time = (time.time() - start_process_time) * 1000

                # 构建结果
                result = OcrResult(
                    page_number=item.page_number,
                    blocks=blocks,
                    processing_time_ms=processing_time,
                    width=item.image_width,
                    height=item.image_height,
                )

                # 设置 Future 结果（通知等待的客户端）
                if not item.future.done():
                    item.future.set_result(result)

                # 更新统计
                queue_stats["total_processed"] += 1
                queue_stats["avg_processing_time_ms"] = (
                    queue_stats["avg_processing_time_ms"] * (queue_stats["total_processed"] - 1) + processing_time
                ) / queue_stats["total_processed"]
                queue_stats["avg_queue_wait_ms"] = (
                    queue_stats["avg_queue_wait_ms"] * (queue_stats["total_processed"] - 1) + queue_wait_time
                ) / queue_stats["total_processed"]

                print(f"[OCR Worker] Page {item.page_number} done: {len(blocks)} blocks, {processing_time:.0f}ms")

            except Exception as e:
                # OCR 执行失败
                queue_stats["total_failed"] += 1

                if not item.future.done():
                    item.future.set_exception(HTTPException(
                        status_code=500,
                        detail=f"OCR processing failed: {str(e)}"
                    ))

                print(f"[OCR Worker] Page {item.page_number} failed: {e}")

            finally:
                request_queue.task_done()

        except asyncio.CancelledError:
            print("[OCR Worker] Cancelled, shutting down...")
            break

        except Exception as e:
            print(f"[OCR Worker] Unexpected error: {e}")
            # 继续运行，不中断 worker

# ========================================
# Startup and Shutdown Events
# ========================================

@app.on_event("startup")
async def startup_event():
    """服务启动时初始化OCR引擎和队列"""
    global ocr_engine, request_queue, worker_task

    # 初始化 OCR 引擎
    ocr_engine = create_ocr_engine(ocr_config)

    # 初始化请求队列
    request_queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)

    # 启动后台 worker 任务
    worker_task = asyncio.create_task(queue_worker())

    print(f"[OCR] Queue initialized (maxsize={MAX_QUEUE_SIZE})")
    print(f"[OCR] Request timeout: {REQUEST_TIMEOUT_SECONDS}s")

@app.on_event("shutdown")
async def shutdown_event():
    """服务关闭时清理"""
    global worker_task
    if worker_task:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass
    print("[OCR] Worker stopped")

# ========================================
# Status Endpoints
# ========================================

@app.get("/status")
async def get_status():
    """获取队列状态"""
    queue_size = request_queue.qsize() if request_queue else 0
    queue_capacity = MAX_QUEUE_SIZE - queue_size

    # 预估等待时间 = (当前队列长度 + 1) × 平均处理时间
    estimated_wait = (queue_size + 1) * queue_stats["avg_processing_time_ms"] / 1000 if queue_stats["avg_processing_time_ms"] > 0 else 0

    return {
        "status": "healthy" if ocr_engine is not None else "initializing",
        "gpu_enabled": ocr_config.use_gpu,
        "queue": {
            "size": queue_size,
            "max_size": MAX_QUEUE_SIZE,
            "available_slots": queue_capacity,
        },
        "timing": {
            "avg_processing_time_ms": round(queue_stats["avg_processing_time_ms"], 1),
            "avg_queue_wait_ms": round(queue_stats["avg_queue_wait_ms"], 1),
            "estimated_wait_seconds": round(estimated_wait, 1),
        },
        "stats": {
            "total_processed": queue_stats["total_processed"],
            "total_failed": queue_stats["total_failed"],
            "total_timeout": queue_stats["total_timeout"],
        }
    }

@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy" if ocr_engine is not None else "initializing",
        "gpu_enabled": ocr_config.use_gpu,
        "queue_size": request_queue.qsize() if request_queue else 0,
    }

# ========================================
# OCR Endpoints
# ========================================

@app.post("/ocr/layout", response_model=OcrResult)
async def layout_ocr(
    file: UploadFile = File(...),
    page_number: int = Form(1),
):
    """
    单页图片OCR处理（通过队列串行执行）

    如果队列已满，返回 503 Service Unavailable
    如果请求超时，返回 408 Request Timeout
    """
    if ocr_engine is None:
        raise HTTPException(status_code=500, detail="OCR engine not initialized")

    if request_queue is None:
        raise HTTPException(status_code=500, detail="Queue not initialized")

    # 检查队列容量
    if request_queue.full():
        estimated_wait = queue_stats["avg_processing_time_ms"] * request_queue.qsize() / 1000
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Queue is full, please retry later",
                "queue_size": request_queue.qsize(),
                "max_size": MAX_QUEUE_SIZE,
                "retry_after_seconds": round(estimated_wait, 1),
            }
        )

    # 读取图片
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))

    if image.mode != 'RGB':
        image = image.convert('RGB')

    img_array = np.array(image)

    # 创建 Future（用于等待 worker 返回结果）
    loop = asyncio.get_event_loop()
    future: asyncio.Future = loop.create_future()

    # 构建队列项
    item = QueueItem(
        image_array=img_array,
        page_number=page_number,
        image_width=image.width,
        image_height=image.height,
        future=future,
        arrived_at=time.time(),
    )

    # 入队
    try:
        request_queue.put_nowait(item)
    except asyncio.QueueFull:
        raise HTTPException(
            status_code=503,
            detail="Queue is full, request rejected"
        )

    print(f"[OCR] Page {page_number} queued (queue size: {request_queue.qsize()})")

    # 等待结果（带超时）
    try:
        result = await asyncio.wait_for(future, timeout=REQUEST_TIMEOUT_SECONDS)
        return result

    except asyncio.TimeoutError:
        queue_stats["total_timeout"] += 1

        # 取消 Future（如果还在处理）
        if not future.done():
            future.cancel()

        raise HTTPException(
            status_code=408,
            detail={
                "error": "Request timeout",
                "timeout_seconds": REQUEST_TIMEOUT_SECONDS,
                "page_number": page_number,
            }
        )

    except HTTPException:
        # Worker 设置的异常，直接抛出
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/ocr/batch", response_model=BatchOcrResult)
async def batch_ocr(files: List[UploadFile] = File(...)):
    """
    批量OCR处理（通过队列串行执行每个页面）

    注意：批量请求会占用多个队列槽位，如果队列容量不足会返回 503
    """
    if ocr_engine is None:
        raise HTTPException(status_code=500, detail="OCR engine not initialized")

    if request_queue is None:
        raise HTTPException(status_code=500, detail="Queue not initialized")

    # 检查是否有足够的队列容量
    num_files = len(files)
    available_slots = MAX_QUEUE_SIZE - request_queue.qsize()

    if num_files > available_slots:
        estimated_wait = queue_stats["avg_processing_time_ms"] * request_queue.qsize() / 1000
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Not enough queue capacity for batch",
                "requested": num_files,
                "available": available_slots,
                "retry_after_seconds": round(estimated_wait, 1),
            }
        )

    start_time = time.time()
    results: List[OcrResult] = []

    # 为每个文件创建队列项
    loop = asyncio.get_event_loop()
    futures: List[asyncio.Future] = []

    for i, file in enumerate(files):
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        if image.mode != 'RGB':
            image = image.convert('RGB')

        img_array = np.array(image)

        future: asyncio.Future = loop.create_future()

        item = QueueItem(
            image_array=img_array,
            page_number=i + 1,
            image_width=image.width,
            image_height=image.height,
            future=future,
            arrived_at=time.time(),
        )

        request_queue.put_nowait(item)
        futures.append(future)

    print(f"[OCR] Batch queued: {num_files} pages")

    # 等待所有结果
    for i, future in enumerate(futures):
        try:
            result = await asyncio.wait_for(future, timeout=REQUEST_TIMEOUT_SECONDS * num_files)
            results.append(result)
        except asyncio.TimeoutError:
            queue_stats["total_timeout"] += 1
            results.append(OcrResult(
                page_number=i + 1,
                blocks=[],
                processing_time_ms=0,
                width=0,
                height=0,
            ))
        except HTTPException:
            results.append(OcrResult(
                page_number=i + 1,
                blocks=[],
                processing_time_ms=0,
                width=0,
                height=0,
            ))

    total_time = (time.time() - start_time) * 1000

    return BatchOcrResult(
        results=results,
        total_processing_time_ms=total_time,
    )

@app.post("/ocr/base64", response_model=OcrResult)
async def base64_ocr(
    image_base64: str = Form(...),
    page_number: int = Form(1),
):
    """
    Base64图片OCR处理
    适用于内存中的图片数据
    """
    if ocr_engine is None:
        raise HTTPException(status_code=500, detail="OCR engine not initialized")

    if request_queue is None:
        raise HTTPException(status_code=500, detail="Queue not initialized")

    # 检查队列容量
    if request_queue.full():
        estimated_wait = queue_stats["avg_processing_time_ms"] * request_queue.qsize() / 1000
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Queue is full, please retry later",
                "queue_size": request_queue.qsize(),
                "max_size": MAX_QUEUE_SIZE,
                "retry_after_seconds": round(estimated_wait, 1),
            }
        )

    # 解码Base64
    if image_base64.startswith('data:image'):
        image_base64 = image_base64.split(',')[1]

    image_data = base64.b64decode(image_base64)
    image = Image.open(io.BytesIO(image_data))

    if image.mode != 'RGB':
        image = image.convert('RGB')

    img_array = np.array(image)

    # 创建 Future
    loop = asyncio.get_event_loop()
    future: asyncio.Future = loop.create_future()

    # 构建队列项
    item = QueueItem(
        image_array=img_array,
        page_number=page_number,
        image_width=image.width,
        image_height=image.height,
        future=future,
        arrived_at=time.time(),
    )

    # 入队
    try:
        request_queue.put_nowait(item)
    except asyncio.QueueFull:
        raise HTTPException(
            status_code=503,
            detail="Queue is full, request rejected"
        )

    # 等待结果（带超时）
    try:
        result = await asyncio.wait_for(future, timeout=REQUEST_TIMEOUT_SECONDS)
        return result

    except asyncio.TimeoutError:
        queue_stats["total_timeout"] += 1

        if not future.done():
            future.cancel()

        raise HTTPException(
            status_code=408,
            detail={
                "error": "Request timeout",
                "timeout_seconds": REQUEST_TIMEOUT_SECONDS,
                "page_number": page_number,
            }
        )

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

# ========================================
# 启动入口
# ========================================

def main():
    parser = argparse.ArgumentParser(description='PaddleOCR Layout Service')
    parser.add_argument('--host', type=str, default='0.0.0.0')
    parser.add_argument('--port', type=int, default=int(os.getenv('OCR_PORT', '8080')))
    parser.add_argument('--use-gpu', type=str, default=os.getenv('OCR_USE_GPU', 'false'))
    parser.add_argument('--workers', type=int, default=1)

    # 队列配置参数
    parser.add_argument('--max-queue-size', type=int,
        default=int(os.getenv('OCR_MAX_QUEUE_SIZE', '50')),
        help='Maximum queue size')
    parser.add_argument('--request-timeout', type=int,
        default=int(os.getenv('OCR_REQUEST_TIMEOUT', '300')),
        help='Request timeout in seconds')

    args = parser.parse_args()

    # 更新全局配置
    global MAX_QUEUE_SIZE, REQUEST_TIMEOUT_SECONDS, ocr_config
    MAX_QUEUE_SIZE = args.max_queue_size
    REQUEST_TIMEOUT_SECONDS = args.request_timeout
    ocr_config.use_gpu = args.use_gpu.lower() == 'true'

    print(f"[OCR Service] Starting on {args.host}:{args.port}")
    print(f"[OCR Service] GPU: {ocr_config.use_gpu}")
    print(f"[OCR Service] Queue: maxsize={MAX_QUEUE_SIZE}, timeout={REQUEST_TIMEOUT_SECONDS}s")

    # workers=1 对于队列模式是最优的（队列保证了串行）
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        workers=1,
    )

if __name__ == '__main__':
    main()