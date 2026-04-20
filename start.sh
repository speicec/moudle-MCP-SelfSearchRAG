#!/bin/bash

# ==============================================================================
# RAG 系统 - 一键启动脚本 (本地开发模式)
# ==============================================================================

echo "========================================"
echo "  RAG MCP Server - 一键启动"
echo "========================================"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "❌ 错误: .env 文件不存在"
    echo "请复制 .env.example 并填写 API Keys:"
    echo "  cp .env.example .env"
    exit 1
fi

# 检查关键配置
DEEPSEEK_KEY=$(grep -E "^DEEPSEEK_API_KEY=" .env | cut -d'=' -f2)
DASHSCOPE_KEY=$(grep -E "^DASHSCOPE_API_KEY=" .env | cut -d'=' -f2)

if [[ "$DEEPSEEK_KEY" == "your-deepseek-api-key" ]] || [[ -z "$DEEPSEEK_KEY" ]]; then
    echo "⚠️  警告: DEEPSEEK_API_KEY 未配置，Chat功能将无法使用"
fi

if [[ "$DASHSCOPE_KEY" == "your-dashscope-api-key" ]] || [[ -z "$DASHSCOPE_KEY" ]]; then
    echo "⚠️  警告: DASHSCOPE_API_KEY 未配置，VLM图片理解将无法使用"
fi

# 启动模式选择
echo ""
echo "请选择启动模式:"
echo "  1) Docker Compose (推荐，一键启动所有服务)"
echo "  2) 本地开发 (需要手动启动 Qdrant 和 OCR)"
echo ""
read -p "请输入选项 [1/2]: " choice

case $choice in
    1)
        echo ""
        echo "🚀 启动 Docker Compose..."
        docker-compose up -d

        echo ""
        echo "等待服务启动..."
        sleep 10

        echo ""
        echo "检查服务状态:"
        docker-compose ps

        echo ""
        echo "========================================"
        echo "  服务已启动!"
        echo "========================================"
        echo ""
        echo "  Web Dashboard:  http://localhost:3001"
        echo "  Qdrant Dashboard: http://localhost:6333/dashboard"
        echo "  OCR Health:     http://localhost:8080/health"
        echo ""
        echo "查看日志: docker-compose logs -f rag-server"
        echo "停止服务: docker-compose down"
        echo ""
        ;;
    2)
        echo ""
        echo "🚀 本地开发模式..."
        echo ""

        # 检查 Qdrant
        if ! curl -s http://localhost:6333/health > /dev/null 2>&1; then
            echo "⚠️  Qdrant 未运行，请先启动:"
            echo "  docker run -d -p 6333:6333 qdrant/qdrant"
        fi

        # 检查 OCR 服务
        if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
            echo "⚠️  OCR 服务未运行，请先启动:"
            echo "  cd scripts && uv run ocr_service.py"
        fi

        echo ""
        echo "启动主服务..."
        npm run build:fast
        node dist/server/main-server.js
        ;;
    *)
        echo "无效选项"
        exit 1
        ;;
esac