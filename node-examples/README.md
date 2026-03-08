# Node.js Examples

This directory contains Node.js examples for using the token-entropy-encoder WASM module.

## Setup

From this directory (`node-examples`), install dependencies:
```bash
npm install
```

## Examples

### 1. Basic WASM Usage (`example.js`)

Demonstrates basic encoding/decoding with the WASM module:

```bash
node example.js
# or
npm run example
```

This will test:
- Loading the WASM module
- Encoding token IDs (u32) to binary
- Decoding binary to token IDs (u32)
- Round-trip encoding/decoding

**Note:** The API now uses u32 token IDs instead of string tokens. For example:
```javascript
const tokenId = 1234;  // Token ID as a number
const encoded = encode(tokenId);  // Returns Uint8Array
const decoded = decode(encoded);  // Returns number (token ID)
```

### 2. Performance Benchmarks (`huffman_benchmark.js`)

Run comprehensive performance benchmarks for the Huffman WebSocket client:

```bash
node huffman_benchmark.js
```

This benchmark suite measures:
- Connection latency
- Decoding throughput
- End-to-end latency for various completion sizes (100, 1000, 5000 tokens)
- Sequential request performance
- Connection reuse efficiency

### 3. Comparison Benchmarks (`huffman_comparison.js`)

Run head-to-head comparison between WebSocket+Huffman and SSE+JSON:

```bash
node huffman_comparison.js
```

This benchmark compares the two approaches across 5 scenarios:
- Inline completions (50 tokens)
- Small completions (100 tokens)
- Medium completions (1000 tokens)
- Large completions (5000 tokens)
- Chat messages (2000 tokens)

Results show WebSocket+Huffman typically achieves 11-30% speedup over SSE+JSON.

### 4. WebSocket Client (`client.js`)

Connects to the Rust WebSocket server and decodes the streamed response:

```bash
# First, start the Rust server in another terminal (from project root):
cd ..
cargo run --bin server

# Then in this directory, run the client:
node client.js
# or
npm run client
```

This will:
1. Check if the server is running
2. Connect to the WebSocket server at `ws://127.0.0.1:3000/chat`
3. Send a request with token IDs: `{ "token_ids": [0, 1, 2, 3, 10, 50, 100, 200, 300, 400, 500] }`
4. Receive encoded packets from the server (sent when buffer fills or timeout occurs)
5. Decode each packet immediately using bulk decoding
6. Display all decoded tokens when the connection closes

### 3. Node.js WebSocket Server (`server.js`)

Alternative to the Rust server, implemented in Node.js:

```bash
node server.js
# or
npm run server
```

This provides the same functionality as the Rust server but is easier to modify for testing.

### Support Files

**WebSocket Clients (`huffmanClient.js`, `sseClient.js`)**

These modules provide reusable clients for:
- `huffmanClient.js`: WebSocket client with WASM Huffman decoding
- `sseClient.js`: SSE (Server-Sent Events) client with JSON parsing

Used by the benchmark scripts for performance comparisons.

**Mock Server (`mockProxyServer.js`)**

Mock proxy server for testing and benchmarking:
- Simulates both WebSocket+Huffman and SSE+JSON endpoints
- Generates realistic token distributions
- Configurable delays and error simulation
- Used by benchmark scripts for consistent testing

## How It Works

The WebSocket client demonstrates the full flow:
1. Client sends token IDs to the server: `{ "token_ids": [0, 1, 2, 3, ...] }`
2. Server simulates streaming the token IDs with network delays
3. Server buffers tokens and flushes them when:
   - The buffer reaches MAX_WINDOW_SIZE_TOKENS (e.g., 255 tokens), OR
   - A timeout expires (e.g., 100ms with no new tokens)
4. On flush, server encodes all buffered tokens using bulk Huffman encoding
5. Shuffman_benchmark.js    # Performance benchmarks for HuffmanClient
├── huffman_comparison.js   # WebSocket+Huffman vs SSE+JSON comparison
├── huffmanClient.js    # Reusable WebSocket client with WASM decoder
├── sseClient.js        # Reusable SSE client for comparison
├── mockProxyServer.js  # Mock server for testing and benchmarks
├── decode_example.js   # Token ID to text decoding example
├── full_pipeline.js    # Complete integration test
```ulk()`
7. When the stream ends, the server closes the connection

**API Changes:** The system now uses u32 token IDs throughout instead of string tokens. This provides:
- More efficient encoding/decoding (no string parsing)
- Direct compatibility with tokenizer outputs
- Fixed-size array-based lookups (O(1) instead of HashMap)
- Bulk encoding/decoding for better performance

## Directory Structure

```
node-examples/
├── example.js              # Basic WASM usage examples with token IDs
├── test.js                 # Comprehensive test suite
├── client.js               # WebSocket client that connects to Rust server
├── server.js               # Node.js WebSocket server alternative
├── proxy_server.js         # Huffman proxy server
├── decode_example.js       # Token ID to text decoding example
├── full_pipeline.js        # Complete integration test
├── streaming_example.js    # Simulates real-time LLM token streaming
│
├── huffman_benchmark.js    # Performance benchmarks for HuffmanClient
├── huffman_comparison.js   # WebSocket+Huffman vs SSE+JSON comparison
├── huffmanClient.js        # Reusable WebSocket client with WASM decoder
├── sseClient.js            # Reusable SSE client for comparison
├── mockProxyServer.js      # Mock server for testing and benchmarks
│
├── package.json            # Node.js dependencies
└── README.md               # This file

../pkg/                     # WASM module (generated by wasm-bindgen)
├── token_entropy_encoder.js
├── token_entropy_encoder_bg.wasm
└── ...
```

## API Overview
```

## NEW: Full Pipeline Integration

The encoder now includes complete pipeline support from compression to displayable text:

### 4. Token Decoding (`decode_example.js`)

Demonstrates converting token IDs to displayable UTF-8 strings:

```bash
node decode_example.js
```

This shows how to use the embedded decoder to convert LLM token IDs into human-readable text.

### 5. Full Pipeline (`full_pipeline.js`)

Complete integration test showing the entire flow:
```bash
node full_pipeline.js
```

Pipeline stages:
1. **Encode**: Token IDs → Compressed bytes (Huffman)
2. **Decode**: Compressed bytes → Token IDs (Huffman)
3. **Display**: Token IDs → UTF-8 text (Decoder)

### 6. Streaming Example (`streaming_example.js`)

Simulates real-time LLM token streaming:
```bash
node streaming_example.js
```

Demonstrates:
- Incremental token compression as they arrive
- Progressive text reconstruction
- Cumulative statistics tracking
- Use cases for chat history, caching, etc.

## API Overview

```javascript
const {
    // Huffman compression
    encode,           // Single token: u32 → Uint8Array
    encode_bulk,      // Multiple tokens: u32[] → Uint8Array
    decode,           // Single token: Uint8Array → u32
    decode_bulk,      // Multiple tokens: Uint8Array → u32[]
    
    // Decoder (token IDs to text)
    decode_ids,       // u32[] → Uint8Array (UTF-8 bytes)
    decoder_vocab_size,      // Get vocabulary size
    decoder_is_loaded,       // Check if decoder initialized
    
    // Metadata
    alphabet_size,           // Get Huffman alphabet size
    average_code_length,     // Get average code length
    is_loaded,               // Check if encoder loaded
    init                     // Initialize (auto-called)
} = require('../pkg/token_entropy_encoder.js');
```

## Use Cases

- **LLM Response Storage**: Compress conversation history efficiently
- **Model Output Caching**: Reduce memory footprint of cached outputs
- **Network Transmission**: Send token streams over limited bandwidth
- **Training Data**: Store fine-tuning examples compactly
- **Chat Logs**: Archive model interactions with compression
- **Real-time Streaming**: Handle streaming LLM responses incrementally

---

## Optimized API for Performance

The module includes optimized functions that minimize JS/WASM boundary crossings for better performance.

### Performance Benefits
- **Small datasets (13 tokens)**: 16x faster
- **Large datasets (1000 tokens)**: 4x faster

### Key Optimized Functions

#### `decode_bulk_to_text(buffer)`
**Multiple tokens: Compressed bytes → UTF-8 text in one call**

```javascript
const compressed = encode_bulk([1, 450, 4996]);
const text = Buffer.from(decode_bulk_to_text(compressed)).toString('utf-8');
```

**Old way (2 calls):**
```javascript
const decompressed = decode_bulk(compressed);
const utf8 = decode_ids(decompressed);
const text = Buffer.from(utf8).toString('utf-8');
```

**New way (1 call):**
```javascript
const text = Buffer.from(decode_bulk_to_text(compressed)).toString('utf-8');
```

#### Other Optimized Functions
- `decode_to_text(buffer)` - Single token: Compressed → UTF-8 text
- `decode_packed_ids_to_text(packedBytes)` - Packed token IDs → UTF-8 text
- `encode_decode_to_text(tokenIds)` - Round-trip validation

See [full API reference](#api-overview) for complete details.

---

## Running Benchmarks

### Quick Start

Run performance benchmarks:
```bash
node huffman_benchmark.js
```

Run comparison benchmarks (WebSocket+Huffman vs SSE+JSON):
```bash
node huffman_comparison.js
```

### What Gets Tested

The benchmarks compare:
- **WebSocket + Huffman** - Binary protocol with compression
- **SSE + JSON** - Server-Sent Events with JSON

Across multiple scenarios:
- Different completion sizes (50 to 5000 tokens)
- Connection latency and throughput
- Sequential vs connection reuse
- Overall performance metrics

### Typical Results

WS+Huffman typically:
- Achieves **11-30% speedup** over SSE+JSON
- Uses **60-70% less bandwidth**
- Better for **large payloads** and **bandwidth-constrained** scenarios

### Understanding the Results

**When WS+Huffman Wins:**
- High bandwidth costs - compression saves 40-70%
- Large payloads - compression benefits scale
- Mobile/metered connections
- Many concurrent users (client-side decoding)

**When SSE+JSON Wins:**
- Low latency critical - simpler parsing
- Small payloads - overhead outweighs benefits
- Simpler infrastructure needs

---