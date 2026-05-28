#!/usr/bin/env bash
# Run the SAM3 server locally on a GPU machine (CUDA or MPS).
# Usage: bash scripts/run_local_gpu.sh [--device cuda:0] [--port 8000] [--model facebook/sam3]
set -euo pipefail

DEVICE="${DEVICE:-cuda:0}"
PORT="${PORT:-8000}"
API_KEY="${API_KEY:-change-me}"
SAM3_MODEL_ID="${SAM3_MODEL_ID:-facebook/sam3}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device) DEVICE="$2"; shift 2 ;;
    --port)   PORT="$2";   shift 2 ;;
    --key)    API_KEY="$2"; shift 2 ;;
    --model)  SAM3_MODEL_ID="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python -m venv .venv
fi

source .venv/bin/activate

echo "Installing requirements..."
pip install -q -r requirements.txt

# Install GPU PyTorch if not present
if ! python -c "import torch" 2>/dev/null; then
  echo "Installing PyTorch with CUDA 12.1 support..."
  pip install -q torch torchvision --index-url https://download.pytorch.org/whl/cu121
fi

if [[ "$SAM3_MODEL_ID" == *"sam3"* ]]; then
  if ! python -c "from transformers import Sam3Model, Sam3Processor" 2>/dev/null; then
    echo "Installing/upgrade Transformers with SAM3 support..."
    pip install -q -U "transformers>=5.0.0" accelerate huggingface_hub
  fi
elif ! python -c "import transformers" 2>/dev/null; then
  pip install -q transformers huggingface_hub
fi

export DEVICE="$DEVICE"
export API_KEY="$API_KEY"
export SAM3_MODEL_ID="$SAM3_MODEL_ID"
export USE_MOCK=false
export DATA_ROOT=./data
export EXPORT_ROOT=./exports

mkdir -p ./data ./exports ./checkpoints

echo ""
echo "Starting SAM3 Factory server on port $PORT (device=$DEVICE)"
echo "API key: $API_KEY"
echo "Model: $SAM3_MODEL_ID"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1
