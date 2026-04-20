# ==============================================================================
# RAG MCP Server - 主服务 Dockerfile
# ==============================================================================
#
# 构建: docker build -t rag-server .
# 运行: docker run -p 3001:3001 rag-server
#
# ==============================================================================

# ------------------------------------------------------------------------------
# 阶段1: 构建
# ------------------------------------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /app

# 安装系统依赖 (canvas需要)
RUN apk add --no-cache \
    build-base \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev \
    python3

# 安装 Node.js 依赖
COPY package*.json ./
RUN npm ci

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
# 阶段2: 运行
# ------------------------------------------------------------------------------
FROM node:18-alpine

WORKDIR /app

# 安装运行时依赖 (canvas和DOM polyfill需要)
RUN apk add --no-cache \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    librsvg \
    pixman \
    curl \
    chromium

# 复制构建产物和依赖
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

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

EXPOSE 3001

# 启动服务
CMD ["node", "dist/server/main-server.js"]