#!/bin/bash
set -e

echo "Building WASM module..."
cargo build --target wasm32-unknown-unknown --lib --release

echo "Generating JavaScript bindings for Node.js..."
wasm-bindgen target/wasm32-unknown-unknown/release/token_entropy_encoder.wasm \
  --out-dir ./pkg \
  --target nodejs

echo "WASM module built successfully!"
echo "Output files are in ./pkg directory"
echo ""
echo "Usage in Node.js:"
echo "  import { decode, encode, alphabet_size } from 'token-entropy-encoder';"
echo "  const result = decode(buffer);"
echo ""
echo "To publish to npm:"
echo "  npm login"
echo "  npm publish"
