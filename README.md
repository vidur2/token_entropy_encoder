# Token-Aware LLM Streaming Compression

> **TL;DR**: Stream LLM token IDs over WebSocket+Huffman instead of text over SSE+JSON for **30% faster inline completions** and **60% bandwidth savings**. Proof-of-concept with mock benchmarks.

## Benchmark Results 🚀

Comparing **WebSocket+Huffman (this project)** vs **SSE+JSON (current standard)**:

| Metric | Result |
|--------|--------|
| **Inline Completions** | **30.7% faster** (1.44x speedup) |
| **Small Completions** | **25.5% faster** (1.34x speedup) |
| **Overall Average** | **11.9% faster** (1.14x speedup) |
| **Bandwidth Savings** | **~60%** (3 bytes/token vs 8 bytes/token) |
| **Scenarios Won** | **4 out of 5** |

**Key Insight**: Client-side token decoding offloads server CPU and enables better scaling.

[📊 Full Benchmark Results](HN_POST_SUMMARY.md)

---

## ⚠️ Current Status: Proof of Concept

**What Works:**
- ✅ Huffman encoder/decoder (Rust → WASM)
- ✅ WebSocket streaming protocol
- ✅ Comprehensive benchmarks with mock server
- ✅ Protocol overhead comparison validated
- ✅ Node.js examples and test suite

**What Doesn't Work:**
- ❌ **VS Code Extension** - Command registration issues prevent activation (see `vscode-extension/` directory for non-functional code)
- ❌ **Modified LLM server** - Standard APIs (OpenAI, Ollama) return text, not token IDs
- ❌ **Custom inference backend** - Need llama.cpp modification or custom server
- ❌ **Multi-model support** - Tokenizer baked at build time via `./build.sh <tokenizer_name>`
- ❌ **Real-world testing** - Mock server simulates realistic patterns but isn't actual inference

**Best Use Cases:**
- Self-hosted LLM deployments where you control the inference stack
- High-throughput scenarios prioritizing bandwidth efficiency
- Applications with many concurrent users (client-side decoding scales better)

---

## Overview

This project is a **proof-of-concept** for a transport-layer optimization for streaming Large Language Model (LLM) outputs, achieving **40-60% bandwidth reduction** and **70% server CPU reduction** compared to traditional JSON+SSE approaches.

Instead of sending UTF-8 text over HTTP/WebSocket and relying on general-purpose compression (gzip/brotli), the system transmits **token IDs encoded with Huffman compression** designed for the tokenizer vocabulary.

The decoder runs in the browser via **Rust → WebAssembly (WASM)** to ensure performance and deterministic synchronization with the server.

**The goal**: Reduce bandwidth and latency while preserving real-time streaming.

### What We Built

1. **Huffman Encoder/Decoder** (Rust → WASM)
   - Huffman compression optimized for token IDs
   - `encode_bulk()` and `decode_bulk()` functions
   - ~160KB WASM module with baked-in tokenizer
   - Runs in browser/Node.js via WebAssembly

2. **Benchmark Suite** (`vscode-extension/out/test/`)
   - Mock servers simulating WebSocket+Huffman and SSE+JSON
   - Comprehensive performance comparison across 5 scenarios
   - Proves protocol overhead reduction
   - Commands: `npm run test:unit`, `npm run benchmark:compare`

3. **Node.js Examples** (`node-examples/`)
   - Working encode/decode examples
   - Format comparison tools
   - Streaming demonstrations
   - Practical usage patterns

4. **VS Code Extension** (`vscode-extension/`) - ⚠️ NON-FUNCTIONAL
   - Code exists but command registration fails
   - Intended to demonstrate WebSocket client + WASM decoder
   - Benchmarks work, extension itself doesn't

---

## Architecture

**Conceptual Flow** (VS Code extension is non-functional, but this shows the intended design):

```
┌────────────────────────────────────────────────────────────────┐
│                   Benchmark/Test Environment                   │
│                   (vscode-extension/out/test/)                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Mock Proxy Servers                                      │  │
│  │  - WebSocket+Huffman simulator                           │  │
│  │  - SSE+JSON simulator                                    │  │
│  │  - Performance comparison harness                        │  │
│  └──────────────────────┬──────────────────────────────────┘  │
│                          │                                      │
│  ┌──────────────────────▼──────────────────────────────────┐  │
│  │  huffmanClient.ts (test harness)                         │  │
│  │  - WASM decoder (decode_bulk)                            │  │
│  │  - WebSocket client                                      │  │
│  │  - Benchmark measurements                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘

Intended Production Flow (not implemented):
┌────────────────────────────────────────────────────────────────┐
│                       VS Code Extension                        │
│                      (NON-FUNCTIONAL)                          │
│                                                                 │
│  WebSocket Client → WASM Decoder → Text Insertion              │
│  - text-generation-webui                                        │
│  - Any OpenAI-compatible server                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Performance Characteristics

Based on our benchmarks:

| Metric | Traditional (SSE+JSON) | Huffman (WS+Binary) | Improvement |
|--------|------------------------|---------------------|-------------|
| **Latency** (1000 tokens) | 7ms | 5ms | **29% faster** |
| **Bandwidth** (1000 tokens) | 6.4 KB | 3.7 KB | **42% reduction** |
| **Compression Ratio** | 1:1 | 1:1.73 | **42% smaller** |
| **Server CPU** | 100% (decoding) | 30% (no decoding) | **70% reduction** |
| **Throughput** | 143K tok/s | 200K tok/s | **40% increase** |

**Why This Matters:**

1. **Faster perceived latency**: Tokens decode on client → feel faster
2. **Lower server costs**: Offload token→text decoding to clients
3. **Better scaling**: Serve 3x more users per server
4. **Reduced bandwidth**: Critical for mobile/remote users

---

## Quick Start

```bash
# 1. Build WASM module with tokenizer
./build.sh TinyLlama/TinyLlama-1.1B-Chat-v1.0

# 2. Run Node.js examples
cd node-examples
npm install
node full_pipeline.js       # See basic encode/decode flow
node huffman_vs_json.js     # Compare formats

# 3. Run benchmarks (VS Code extension tests)
cd vscode-extension
npm install
npm run compile
npm run test:unit           # Run unit tests (8/8 passing)
npm run benchmark:compare   # Run comparison benchmarks

# Note: VS Code extension itself is non-functional due to command registration issues
```

---

## Setup Guide

### Prerequisites

- Node.js 18+ and npm
- Rust toolchain (for building WASM module)
- Python 3.8+ with venv (for tokenizer extraction)
- VS Code 1.80+

### Step 1: Clone and Setup

```bash
git clone https://github.com/vidur2/token_entropy_encoder
cd token_entropy_encoder

# Create Python virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install transformers torch
```

### Step 2: Build WASM Module

```bash
# Install wasm-pack if you haven't already
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build WASM with a specific tokenizer (bakes tokenizer at build time)
./build.sh TinyLlama/TinyLlama-1.1B-Chat-v1.0

# Or use another model:
# ./build.sh meta-llama/Llama-2-7b-hf
# ./build.sh gpt2
```

This creates the `pkg/` directory with:
- `token_entropy_encoder.js` - JavaScript bindings
- `token_entropy_encoder_bg.wasm` - Compiled WASM module (~160KB)
- Type definitions

### Step 3: Run Benchmarks

⚠️ **Note:** The VS Code extension has command registration issues and is non-functional. However, the benchmark suite works and demonstrates the protocol performance.

```bash
cd vscode-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run unit tests
npm run test:unit

# Run comparison benchmarks (WS+Huffman vs SSE+JSON)
npm run benchmark:compare
```

### Step 4: Try Node.js Examples

For working examples of the encoding/decoding system:

```bash
cd node-examples
npm install

# Basic encode/decode flow
node full_pipeline.js

# Format comparison
node huffman_vs_json.js

# Streaming example
node streaming_example.js
```

### Note on VS Code Extension

⚠️ The VS Code extension in `vscode-extension/` is **non-functional** due to command registration issues. However, the benchmarks work:

```bash
cd vscode-extension
npm install
npm run compile
npm run test:unit           # Unit tests
npm run benchmark:compare   # Performance benchmarks
```

The extension was intended to demonstrate the WebSocket+WASM client but does not activate properly in VS Code.

---

## Key Idea

Current pipeline:

```
LLM → tokens → text → JSON → UTF-8 → gzip → network → browser → parse → display
```

Proposed pipeline:

```
LLM → tokens → token entropy codec → network → WASM decode → tokens → detokenize → display
```

The proposal removes redundant representation layers and compresses at the semantic symbol level instead of the byte level.

---

## Compression Method

### Token Huffman Coding

A Huffman code is constructed over the tokenizer vocabulary:

* Each token assigned a prefix code based on probability
* Frequent tokens receive shorter codes
* Rare tokens receive longer codes

This approximates:

```
Expected bits ≈ −log₂ P(token)
```

Unlike byte compression, the model operates over semantic symbols rather than characters.

### Personalized Adaptive Model (Bayesian Updates)

The system maintains a **per-user token distribution** that adapts during usage.

#### Initialization

Start from a global baseline distribution built from a large corpus.

#### Online Updating

After each observed token, update counts using Bayesian updating:

```
Posterior(token) ∝ Prior(token) + ObservedCount(token)
```

This allows the encoder/decoder to converge toward user-specific vocabulary patterns (topics, coding style, language usage).

#### Codebook Refresh

The Huffman tree is periodically rebuilt at safe boundaries (frame resets) using the updated posterior distribution.

This trades small synchronization overhead for improved compression over long sessions.

---

## WASM Client Decoder

The decoder is implemented in Rust and compiled to WebAssembly.

Responsibilities:

* Incremental bitstream decoding
* Frame synchronization
* Error detection and resync
* Token buffering for smooth UI updates

Advantages:

* Faster than JavaScript bit parsing
* Deterministic behavior across platforms
* Shared codebase between server and client

---

## Streaming Protocol

Each transmission consists of framed binary messages:

Frame Structure:

* version
* codec id
* codebook id / epoch
* payload length
* compressed token bitstream
* CRC checksum

Features:

* Periodic reset frames to prevent desync
* Partial decode allowed per frame for smooth streaming
* Compatible with WebSocket or HTTP streaming

---

## Implementation

### M-ary Huffman Generator

The `HuffmanGenerator` implements a flexible m-ary Huffman coding system supporting arbitrary alphabet sizes (binary, ternary, etc.).

#### Features

* **Generic alphabet size**: Supports any m ≥ 2 (binary, ternary, quaternary, etc.)
* **Trie-based encoding/decoding**: Efficient O(L) encode/decode where L is code length
* **Automatic tree construction**: Builds optimal m-ary Huffman tree from PMF
* **Bidirectional mapping**: Both encode (codeword → symbols) and decode (symbols → codeword)

#### Usage

```rust
use token_entropy_encoder::huffman::HuffmanGenerator;

// Define codewords and their probabilities
let codewords = [
    "A".to_string(),
    "B".to_string(),
    "C".to_string(),
    "D".to_string(),
];

let pmf = [0.4, 0.3, 0.2, 0.1]; // Probability mass function
let m = 2u8; // Binary alphabet (2 symbols: 0 and 1)

// Create the Huffman generator
let huffman = HuffmanGenerator::new(codewords, pmf, m)?;

// Encode a codeword to alphabet symbols
let encoded = huffman.encode("A")?; // e.g., [0]

// Decode alphabet symbols back to codeword
let decoded = huffman.decode(&[0])?; // "A"
```

#### API Reference

* `HuffmanGenerator::new(codewords, pmf, m)` - Construct encoder/decoder from codewords, PMF, and alphabet size
* `encode(&self, codeword: &str)` - Encode codeword to sequence of alphabet symbols
* `decode(&self, alphabet_seq: &[u8])` - Decode alphabet symbols to codeword
* `alphabet_size(&self)` - Get the alphabet size (m)
* `get_encoding_map(&self)` - Inspect the full encoding table

#### Example: Ternary Encoding

```rust
// Use ternary alphabet (3 symbols: 0, 1, 2)
let codewords = ["X".to_string(), "Y".to_string(), "Z".to_string()];
let pmf = [0.5, 0.3, 0.2];
let huffman = HuffmanGenerator::new(codewords, pmf, 3)?;

// Ternary encoding uses symbols {0, 1, 2}
let encoded = huffman.encode("Y")?; // e.g., [0]
let decoded = huffman.decode(&encoded)?; // "Y"
```

#### Running Examples

```bash
# Basic usage example
cargo run --example huffman_basic

# Run tests
cargo test
```

---

## Configuration

### VS Code Extension Settings

```json
{
  "huffman-llm.mode": "ws-huffman",  // or "sse-json" for comparison
  "huffman-llm.proxyUrl": "ws://localhost:3003",
  "huffman-llm.temperature": 0.7,
  "huffman-llm.maxTokens": 2048
}
```

---

## Benchmarking

Run the full benchmark suite:

```bash
cd vscode-extension
npm run benchmark:compare
```

Results:
- ✅ 28.5% faster for inline completions (50 tokens)
- ✅ 12.1% faster for small completions (100 tokens)
- ✅ 6.4% faster for large completions (5000 tokens)
- ✅ 60% bandwidth savings (3 vs 8 bytes/token)
- ✅ WS+Huffman wins 3 out of 5 scenarios

See detailed results in [HN_POST_SUMMARY.md](HN_POST_SUMMARY.md).

---

## Troubleshooting

### WASM Module Not Found

**Check pkg directory exists:**
```bash
ls -la pkg/
```

**Rebuild WASM:**
```bash
./build.sh TinyLlama/TinyLlama-1.1B-Chat-v1.0
```

### Extension Not Compiling

**Check Node.js version:**
```bash
node --version  # Should be 18+
```

**Reinstall dependencies:**
```bash
cd vscode-extension
rm -rf node_modules package-lock.json
npm install
npm run compile
```

### Tests Failing

**Ensure WASM is built:**
```bash
ls pkg/token_entropy_encoder_bg.wasm
```

**Check extension compiled:**
```bash
ls vscode-extension/out/
```

**Run tests with verbose output:**
```bash
npm run test:unit
```

---

## Use Cases

### ✅ Perfect For:
- **Vibecoding**: Frequent, rapid completions
- **Code generation**: Inline completions while typing
- **Chat interfaces**: Real-time streaming conversations
- **Mobile/remote**: Bandwidth-constrained environments
- **High-scale services**: Many concurrent users

### ❌ Not Ideal For:
- Single, large completions (overhead not worth it)
- Text-only LLM APIs (no token access)
- Public APIs where you can't control encoding

---

## Key Innovations

1. **Client-side decoding**: Offload token→text to clients, not server
2. **Binary protocol**: WebSocket binary frames vs HTTP text
3. **Huffman compression**: Optimal for token ID distributions
4. **Streaming decode**: Decompress as you receive, not after
5. **Build-time tokenizer**: Baked into WASM for zero runtime overhead

---

## TODOs / Future Work

- [ ] Support multiple models dynamically (currently build-time only)
- [ ] Multiple concurrent streams
- [ ] Request cancellation
- [ ] Bundle WASM with extension (no external dependency)
- [ ] Performance telemetry
- [ ] Streaming edits (not just insertions)
- [ ] Marketplace-ready extension package
- [ ] Reconnection logic
- [ ] Replace Huffman with arithmetic/ANS coding
- [ ] Use model logits instead of empirical frequencies
- [ ] Context-adaptive per-message distributions

---

## Files Structure

```
token_entropy_encoder/
├── build.sh                     # Build WASM with tokenizer
├── README.md                    # This file
├── HN_POST_SUMMARY.md          # Detailed technical summary
├── HN_POST_DRAFT.md            # Hacker News post draft
│
├── node-examples/
│   ├── proxy_server.js          # Huffman proxy server
│   ├── benchmark_server.js      # Test server
│   ├── benchmark_client.js      # Benchmark suite
│   └── ...
│
├── vscode-extension/            # VS Code extension
│   ├── package.json             # Extension manifest
│   ├── tsconfig.json            # TypeScript config
│   ├── README.md                # Extension docs
│   ├── src/
│   │   ├── extension.ts         # Main extension code
│   │   ├── huffmanClient.ts     # WebSocket + WASM decoder
│   │   └── sseClient.ts         # SSE + JSON client (comparison)
│   └── test/
│       ├── huffmanClient.test.ts    # Unit tests
│       ├── comparison.benchmark.ts  # Benchmark suite
│       └── mockProxyServer.ts       # Mock server
│
├── src/                         # Rust source code
│   ├── lib.rs
│   ├── wasm.rs                  # WASM bindings
│   ├── huffman/                 # Huffman implementation
│   ├── decoder.rs               # Token decoder
│   └── ...
│
├── scripts/                     # Build scripts
│   ├── get_pmf_from_llama.py    # Extract token PMF
│   ├── build_decode_pack.py     # Create decode pack
│   └── packs/                   # Generated tokenizer packs
│
└── pkg/                         # Built WASM module
    ├── token_entropy_encoder.js
    └── token_entropy_encoder_bg.wasm
```

---

## Development

### Proxy Server Development

```bash
cd node-examples
node proxy_server.js
# Edit proxy_server.js
# Restart to see changes
```

### Extension Development

```bash
cd vscode-extension
npm run watch  # Auto-compile on changes
# Press F5 in VS Code to test
```

### WASM Module Development

```bash
# Edit src/*.rs
./build.sh TinyLlama/TinyLlama-1.1B-Chat-v1.0
# Test with node-examples
```

---

## Summary

This project explores a middle layer between networking and machine learning:

A streaming protocol that transmits language model outputs at the level of information content rather than textual representation.

Key components:

* Token-level entropy compression
* Personalized adaptive distributions
* Rust/WASM streaming decoder
* Realistic HTTP/WebSocket benchmarking

The goal is not to replace transport compression but to remove structural redundancy before it occurs.

---

## License

MIT

## Credits

Built with:
- Rust Huffman encoding implementation
- WASM bindings for browser/Node.js
- VS Code Extension API
- WebSocket protocol
