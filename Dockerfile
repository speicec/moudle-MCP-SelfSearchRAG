# ==============================================================================
# RAG MCP Server - 主服务 Dockerfile
# ==============================================================================
#
# 构建: docker build -t rag-server .
# 运行: docker run -p 3001:3001 rag-server
#
# 模型下载（在能访问 HuggingFace 的环境中执行）:
#   1. npm run download-models
#   2. 模型下载到 ~/.cache/huggingface/hub/
#   3. 复制到项目目录: cp -r ~/.cache/huggingface/hub ./hf_cache/
#   4. docker build 会自动打包模型到镜像
#
# ==============================================================================

# ------------------------------------------------------------------------------
# 阶段1: 构建 (使用 Debian slim，支持 glibc for onnxruntime-node)
# ------------------------------------------------------------------------------
FROM node:24-slim AS builder

WORKDIR /app

# 配置国内 npm 镜像源 (淘宝)
RUN npm config set registry https://registry.npmmirror.com

# 配置 sharp 的 libvips 镜像 (解决二进制下载超时)
ENV npm_config_sharp_libvips_binary_host=https://npmmirror.com/mirrors/sharp-libvips
ENV npm_config_sharp_binary_host=https://npmmirror.com/mirrors/sharp

# 配置国内 apt 镜像源 (阿里云)
RUN sed -i 's@deb.debian.org@mirrors.aliyun.com@g' /etc/apt/sources.list.d/debian.sources

# 安装系统依赖 (canvas 和构建工具需要)
RUN apt-get update && apt-get install -y --no-install-recommends --fix-missing \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# 安装 Node.js 依赖 (先跳过脚本，避免下载超时)
COPY package*.json ./
RUN npm ci --ignore-scripts

# 手动安装需要二进制下载的包
RUN npm rebuild sharp --verbose
RUN npm rebuild @huggingface/transformers --verbose || true

# 创建模型缓存目录 (transformers.js 本地模型路径)
RUN mkdir -p /app/node_modules/@huggingface/transformers/models/Xenova/bge-m3 \
             /app/node_modules/@huggingface/transformers/models/Xenova/clip-vit-base-patch32

# 复制本地模型到 transformers.js 的本地模型目录
COPY hf_cache/bge-m3 /app/node_modules/@huggingface/transformers/models/Xenova/bge-m3/
COPY hf_cache/clip-vit-base-patch32 /app/node_modules/@huggingface/transformers/models/Xenova/clip-vit-base-patch32/

# 复制源码和配置
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY src ./src
COPY config ./config

# 构建后端 (tsc 编译 + vite build)
RUN npm run build

# 构建前端 (Vite)
RUN npm run build:frontend

# ------------------------------------------------------------------------------
# 阶段2: 运行 (使用 Debian slim，支持 glibc for onnxruntime-node)
# ------------------------------------------------------------------------------
FROM node:24-slim

WORKDIR /app

# 配置国内 apt 镜像源 (阿里云)
RUN sed -i 's@deb.debian.org@mirrors.aliyun.com@g' /etc/apt/sources.list.d/debian.sources

# 安装运行时依赖 (canvas、DOM polyfill、CA证书和 glibc 需要)
RUN apt-get update && apt-get install -y --no-install-recommends --fix-missing \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    libpixman-1-0 \
    curl \
    ca-certificates \
    chromium \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# 复制构建产物和依赖 (包含预下载的模型)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# 创建数据目录
RUN mkdir -p /app/data/documents

# 环境变量默认值
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV CANVAS_FONT_PATH=/usr/share/fonts

# 配置嵌入模型路径 (使用构建时下载的模型)
ENV TRANSFORMERS_CACHE=/root/.cache/huggingface
ENV HF_ENDPOINT=https://hf-mirror.com

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
  CMD curl -f http://0.0.0.0:3001/api/health || exit 1

EXPOSE 3001

# 启动服务
CMD ["node", "dist/server/main-server.js"]