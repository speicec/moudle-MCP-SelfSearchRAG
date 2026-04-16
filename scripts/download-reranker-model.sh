#!/bin/bash

# Model download script for bge-reranker-v2-m3
# This script downloads the reranker model to local cache

MODEL_NAME="BAAI/bge-reranker-v2-m3"
CACHE_DIR="./models"

echo "Downloading reranker model: $MODEL_NAME"
echo "Cache directory: $CACHE_DIR"

# Create cache directory
mkdir -p "$CACHE_DIR"

# Check if huggingface-cli is available
if command -v huggingface-cli &> /dev/null; then
    echo "Using huggingface-cli to download model..."
    huggingface-cli download "$MODEL_NAME" --local-dir "$CACHE_DIR/bge-reranker-v2-m3"
    echo "Model downloaded successfully!"
else
    echo "huggingface-cli not found. Please install huggingface-hub:"
    echo "  pip install huggingface-hub"
    echo ""
    echo "Alternative: Download manually from https://huggingface.co/$MODEL_NAME"
    exit 1
fi

# Verify download
if [ -d "$CACHE_DIR/bge-reranker-v2-m3" ]; then
    echo "Model files:"
    ls -la "$CACHE_DIR/bge-reranker-v2-m3"
    echo ""
    echo "Download complete. Model ready for use."
else
    echo "Download failed. Please check your internet connection and try again."
    exit 1
fi