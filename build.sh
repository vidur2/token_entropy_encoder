#!/bin/bash
set -e

# Parse arguments
USE_SAMPLE=false
MODEL_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --sample)
            USE_SAMPLE=true
            shift
            ;;
        *)
            if [ -z "$MODEL_ID" ]; then
                MODEL_ID="$1"
            fi
            shift
            ;;
    esac
done

# Check if model ID argument is provided
if [ -z "$MODEL_ID" ]; then
    echo "Usage: ./build.sh [--sample] <model_id>"
    echo ""
    echo "Options:"
    echo "  --sample    Use sample_pmf_from_llm.py (slower but more accurate)"
    echo ""
    echo "Examples:"
    echo "  ./build.sh TinyLlama/TinyLlama-1.1B-Chat-v1.0"
    echo "  ./build.sh --sample TinyLlama/TinyLlama-1.1B-Chat-v1.0"
    exit 1
fi

echo "Building with model: $MODEL_ID"

# Extract model name for decode pack directory (last part after /)
MODEL_NAME=$(basename "$MODEL_ID")
DECODE_PACK_DIR="scripts/packs/$MODEL_NAME"

echo ""
echo "=== Step 1: Building PMF ==="
if [ "$USE_SAMPLE" = true ]; then
    echo "Using sample_pmf_from_llm.py (this may take a while...)"
    python scripts/sample_pmf_from_llm.py "$MODEL_ID"
else
    echo "Using get_pmf_from_llama.py (fast method)"
    python scripts/get_pmf_from_llama.py "$MODEL_ID"
fi

echo ""
echo "=== Step 2: Compiling decoder ==="
mkdir -p "$DECODE_PACK_DIR"
python scripts/build_decode_pack.py "$MODEL_ID" --out_dir "$DECODE_PACK_DIR"

echo ""
echo "=== Step 3: Compiling Rust project in release mode ==="
cargo build --release

echo ""
echo "=== Step 4: Running create_tree ==="
./target/release/create_tree

echo ""
echo "=== Step 5: Compiling WASM ==="
sh build_wasm.sh

echo ""
echo "✅ Build completed successfully!"
