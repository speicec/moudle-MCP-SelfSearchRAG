# ==============================================================================
# OCR Service - PaddleOCR PP-StructureV3 Dockerfile
# ==============================================================================
#
# 构建: docker build -t rag-ocr .
# 运行: docker run -p 8080:8080 rag-ocr
#
# ==============================================================================

FROM python:3.11-slim

WORKDIR /app

# ------------------------------------------------------------------------------
# 安装系统依赖
# ------------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------------------
# 安装 Python 依赖
# ------------------------------------------------------------------------------
COPY ocr_requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ------------------------------------------------------------------------------
# 复制 OCR 服务代码
# ------------------------------------------------------------------------------
COPY ocr_service.py .

# ------------------------------------------------------------------------------
# 预下载 OCR 模型 (加速首次启动)
# 注意: 这会增加镜像大小，但避免运行时下载延迟
# ------------------------------------------------------------------------------
RUN python -c "\
from paddleocr import PPStructureV3; \
import numpy as np; \
engine = PPStructureV3( \
    use_table_recognition=False, \
    use_formula_recognition=False, \
    use_seal_recognition=False, \
    use_chart_recognition=False, \
    lang='ch', \
    device='cpu', \
    enable_mkldnn=False \
); \
dummy = np.zeros((100, 100, 3), dtype=np.uint8); \
list(engine.predict(dummy)); \
print('OCR models downloaded successfully')"

# ------------------------------------------------------------------------------
# 环境变量
# ------------------------------------------------------------------------------
ENV OCR_USE_GPU=false
ENV OCR_PORT=8080
ENV PYTHONUNBUFFERED=1

# ------------------------------------------------------------------------------
# 健康检查
# ------------------------------------------------------------------------------
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

EXPOSE 8080

# ------------------------------------------------------------------------------
# 启动服务
# ------------------------------------------------------------------------------
CMD ["python", "ocr_service.py", "--host", "0.0.0.0", "--port", "8080"]