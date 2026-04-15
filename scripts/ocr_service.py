#!/usr/bin/env python3
"""
PaddleOCR PP-Structure HTTP Service
支持版面分析的OCR服务，输出结构化结果

依赖安装：
  pip install paddlepaddle paddleocr fastapi uvicorn python-multipart pillow numpy

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
from typing import List, Optional
from pathlib import Path

import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

# PaddleOCR导入 - 使用兼容的2.x API
from paddleocr import PPStructure, PaddleOCR

# ========================================
# 配置
# ========================================

class OcrConfig:
    """OCR服务配置"""
    def __init__(self):
        self.use_gpu = os.getenv('OCR_USE_GPU', 'false').lower() == 'true'
        self.use_mkldnn = not self.use_gpu  # CPU加速
        self.show_log = False
        self.lang = 'ch'        # 中文
        self.det_db_thresh = 0.3
        self.det_db_box_thresh = 0.5
        self.table_max_len = 500
        self.merge_no_span_structure = True

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

def create_ocr_engine(config: OcrConfig) -> PPStructure:
    """创建PP-Structure引擎（兼容2.x API）"""
    print(f"[OCR] Initializing PP-Structure engine (GPU: {config.use_gpu})")

    # 使用兼容的PPStructure API
    engine = PPStructure(
        show_log=config.show_log,
        use_gpu=config.use_gpu,
        lang=config.lang,
        table=False,  # 禁用表格识别（避免兼容性问题）
        ocr=True,     # 启用OCR
        layout=True,  # 启用版面分析
        structure_version='PP-StructureV2',  # 使用V2版本
    )

    # 预热：处理一个空白图片，确保模型加载
    print("[OCR] Preheating engine...")
    dummy_image = np.zeros((100, 100, 3), dtype=np.uint8)
    try:
        result = engine(dummy_image)
        print(f"[OCR] Engine ready (preheat result: {len(result)} blocks)")
    except Exception as e:
        print(f"[OCR] Preheat warning: {e}")
        print("[OCR] Engine initialized (may need first call to fully load)")

    return engine

# ========================================
# 结果转换函数
# ========================================

def format_table_cells(table_res: List) -> List[dict]:
    """格式化表格单元格"""
    cells = []
    for cell in table_res:
        cell_data = {
            'row': cell.get('row', 0),
            'col': cell.get('col', 0),
            'text': cell.get('text', ''),
            'bbox': cell.get('bbox', []),
        }
        cells.append(cell_data)
    return cells

def format_table_text(cells: List[dict]) -> str:
    """将表格单元格转换为Markdown表格文本"""
    if not cells:
        return ''

    # 按行列组织
    rows_dict = {}
    max_col = 0
    for cell in cells:
        r = cell['row']
        c = cell['col']
        if r not in rows_dict:
            rows_dict[r] = {}
        rows_dict[r][c] = cell['text']
        max_col = max(max_col, c)

    # 生成Markdown表格
    lines = []
    for r in sorted(rows_dict.keys()):
        row_cells = rows_dict[r]
        line_parts = []
        for c in range(max_col + 1):
            line_parts.append(row_cells.get(c, ''))
        line = '| ' + ' | '.join(line_parts) + ' |'
        lines.append(line)

        # 第一行后添加分隔符
        if r == 0:
            separator = '| ' + ' | '.join(['---'] * (max_col + 1)) + ' |'
            lines.append(separator)

    return '\n'.join(lines)

def process_ocr_result(result: List, image_width: int, image_height: int) -> List[OcrBlock]:
    """处理OCR原始结果，转换为结构化输出（兼容PPStructure 2.x API）"""
    blocks = []

    for item in result:
        block_type = item.get('type', 'text')
        bbox = item.get('bbox', [0, 0, image_width, image_height])
        confidence = item.get('score', 0.0)

        # 提取文本
        text = ''
        cells = None

        if 'res' in item:
            res = item['res']

            if isinstance(res, list):
                # OCR结果列表 - 每个元素是一行文字
                text_lines = []
                for line in res:
                    if isinstance(line, dict):
                        line_text = line.get('text', '')
                        if line_text:
                            text_lines.append(line_text)
                    elif isinstance(line, (list, tuple)) and len(line) >= 1:
                        # 旧格式: [[bbox], (text, confidence)]
                        if len(line) >= 2 and isinstance(line[1], (list, tuple)):
                            line_text = line[1][0] if len(line[1]) > 0 else ''
                            text_lines.append(line_text)
                text = '\n'.join(text_lines)
            elif isinstance(res, dict):
                # 文本块
                text = res.get('text', '')

        block = OcrBlock(
            type=block_type,
            bbox=bbox,
            text=text,
            confidence=confidence,
            cells=cells,
        )
        blocks.append(block)

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
ocr_engine: Optional[PPStructure] = None
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

    # 执行OCR
    result = ocr_engine(img_array)

    # 转换结果
    blocks = process_ocr_result(result, image.width, image.height)

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

        result = ocr_engine(img_array)
        blocks = process_ocr_result(result, image.width, image.height)

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

    # 执行OCR
    result = ocr_engine(img_array)
    blocks = process_ocr_result(result, image.width, image.height)

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