# Token-Aware LLM Streaming Compression

## Overview

This project proposes a transport-layer optimization for streaming Large Language Model (LLM) outputs to a web client.

Instead of sending UTF-8 text over HTTP/WebSocket and relying on general-purpose compression (gzip/brotli), the system transmits **token IDs encoded with an entropy coder** designed for the tokenizer vocabulary.

The decoder runs in the browser via **Rust → WebAssembly (WASM)** to ensure performance and deterministic synchronization with the server.

The core goal is to reduce bandwidth and latency while preserving the real-time streaming experience.

---

## Key Idea

Current pipeline:

LLM → tokens → text → JSON → UTF-8 → gzip → network → browser → parse → display

Proposed pipeline:

LLM → tokens → token entropy codec → network → WASM decode → tokens → detokenize → display

The proposal removes redundant representation layers and compresses at the semantic symbol level instead of the byte level.

---

## Compression Method

### Token Huffman Coding

A Huffman code is constructed over the tokenizer vocabulary:

* Each token assigned a prefix code based on probability
* Frequent tokens receive shorter codes
* Rare tokens receive longer codes

This approximates:

Expected bits ≈ −log₂ P(token)

Unlike byte compression, the model operates over semantic symbols rather than characters.

---

## Personalized Adaptive Model (Bayesian Updates)

The system maintains a **per-user token distribution** that adapts during usage.

### Initialization

Start from a global baseline distribution built from a large corpus.

### Online Updating

After each observed token, update counts using Bayesian updating:

Posterior(token) ∝ Prior(token) + ObservedCount(token)

This allows the encoder/decoder to converge toward user-specific vocabulary patterns (topics, coding style, language usage).

### Codebook Refresh

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

## Benchmark Plan

### Baselines

1. Raw text streaming
2. Text + gzip/brotli
3. Binary token varint encoding
4. Token Huffman codec (proposed)

### Metrics

* Bytes transmitted
* Time-to-first-visible-text (TTFVT)
* Update cadence smoothness
* Client decode cost (WASM)
* Server encode cost

### Dataset

Use prerecorded token streams from real tokenizer outputs across:

* conversational text
* code
* markdown
* JSON/tool output
* math/latex

---

## Expected Outcome

Hypothesis:

Token-aware entropy coding reduces bandwidth by ~2–4× compared to raw text and meaningfully improves over general-purpose compression in streaming scenarios, while maintaining real-time UI responsiveness.

---

## Future Extensions

* Replace Huffman with arithmetic/ANS coding
* Use model logits instead of empirical frequencies
* Context-adaptive per-message distributions
* Semantic delta encoding between model and client prediction

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
