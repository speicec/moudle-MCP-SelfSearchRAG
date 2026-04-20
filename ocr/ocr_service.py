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
"""

import argparse
import io
import json
import base64
import time
import os
from typing import List, Optional, Generator, Any
from pathlib import Path

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
    description="OCR服务 with 版面分析",
    version="1.0.0",
)

# 全局OCR引擎（服务启动时初始化）
ocr_engine = None
ocr_config: OcrConfig = OcrConfig()

@app.on_event("startup")
async def startup_event():
    """服务启动时初始化OCR引擎"""
    global ocr_engine
    ocr_engine = create_ocr_engine(ocr_config)

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "gpu_enabled": ocr_config.use_gpu}

@app.post("/ocr/layout", response_model=OcrResult)
async def layout_ocr(
    file: UploadFile = File(...),
    page_number: int = Form(1),
):
    """
    单页图片OCR处理
    返回结构化的布局分析结果
    """
    if ocr_engine is None:
        raise HTTPException(status_code=500, detail="OCR engine not initialized")

    start_time = time.time()

    # 读取图片
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))

    # 转换为RGB（如果需要）
    if image.mode != 'RGB':
        image = image.convert('RGB')

    img_array = np.array(image)

    # 执行OCR - V3使用predict()方法，返回generator
    results = list(ocr_engine.predict(img_array))
    if len(results) == 0:
        blocks = []
    else:
        # 取第一个结果（单页）
        blocks = process_v3_result(results[0], image.width, image.height)

    processing_time = (time.time() - start_time) * 1000

    return OcrResult(
        page_number=page_number,
        blocks=blocks,
        processing_time_ms=processing_time,
        width=image.width,
        height=image.height,
    )

@app.post("/ocr/batch", response_model=BatchOcrResult)
async def batch_ocr(files: List[UploadFile] = File(...)):
    """
    批量OCR处理
    同时处理多个图片页面
    """
    if ocr_engine is None:
        raise HTTPException(status_code=500, detail="OCR engine not initialized")

    start_time = time.time()
    results = []

    for i, file in enumerate(files):
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        if image.mode != 'RGB':
            image = image.convert('RGB')

        img_array = np.array(image)

        # 执行OCR - V3使用predict()方法
        page_results = list(ocr_engine.predict(img_array))
        if len(page_results) > 0:
            blocks = process_v3_result(page_results[0], image.width, image.height)
        else:
            blocks = []

        results.append(OcrResult(
            page_number=i + 1,
            blocks=blocks,
            processing_time_ms=0,  # 单页时间不计
            width=image.width,
            height=image.height,
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

    start_time = time.time()

    # 解码Base64
    if image_base64.startswith('data:image'):
        image_base64 = image_base64.split(',')[1]

    image_data = base64.b64decode(image_base64)
    image = Image.open(io.BytesIO(image_data))

    if image.mode != 'RGB':
        image = image.convert('RGB')

    img_array = np.array(image)

    # 执行OCR - V3使用predict()方法
    results = list(ocr_engine.predict(img_array))
    if len(results) > 0:
        blocks = process_v3_result(results[0], image.width, image.height)
    else:
        blocks = []

    processing_time = (time.time() - start_time) * 1000

    return OcrResult(
        page_number=page_number,
        blocks=blocks,
        processing_time_ms=processing_time,
        width=image.width,
        height=image.height,
    )

# ========================================
# 启动入口
# ========================================

def main():
    parser = argparse.ArgumentParser(description='PaddleOCR Layout Service')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='服务地址')
    parser.add_argument('--port', type=int, default=int(os.getenv('OCR_PORT', '8080')), help='服务端口')
    parser.add_argument('--use-gpu', type=str, default=os.getenv('OCR_USE_GPU', 'false'), help='是否使用GPU')
    parser.add_argument('--workers', type=int, default=1, help='Worker数量')

    args = parser.parse_args()

    # 设置配置
    global ocr_config
    ocr_config.use_gpu = args.use_gpu.lower() == 'true'

    print(f"[OCR Service] Starting on {args.host}:{args.port}")
    print(f"[OCR Service] GPU: {ocr_config.use_gpu}, Workers: {args.workers}")

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        workers=args.workers,
    )

if __name__ == '__main__':
    main()