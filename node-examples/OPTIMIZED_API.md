# Optimized API for Minimal Boundary Crossings

This document describes the optimized functions that minimize JS/WASM boundary crossings for better performance.

## Performance Benefits

Based on benchmarks:
- **Small datasets (13 tokens)**: 16x faster
- **Large datasets (1000 tokens)**: 4x faster

## New Optimized Functions

### 1. `decode_to_text(buffer)`
**Single token: Compressed bytes → UTF-8 text in one call**

```javascript
const compressed = encode(tokenId);
const text = Buffer.from(decode_to_text(compressed)).toString('utf-8');
```

**Pipeline:** Huffman decode → Token ID → UTF-8 bytes  
**Boundary crossings:** 1 call (vs 2 calls with old API)

---

### 2. `decode_bulk_to_text(buffer)`
**Multiple tokens: Compressed bytes → UTF-8 text in one call**

```javascript
const compressed = encode_bulk([1, 450, 4996]);
const text = Buffer.from(decode_bulk_to_text(compressed)).toString('utf-8');
```

**Pipeline:** Huffman decode → Token IDs → UTF-8 bytes  
**Boundary crossings:** 1 call (vs 3 calls with old API)

**Old way (3 calls):**
```javascript
const compressed = encode_bulk(tokens);
const decompressed = decode_bulk(compressed);    // Call 1
const utf8 = decode_ids(decompressed);           // Call 2
const text = Buffer.from(utf8).toString('utf-8');
```

**New way (1 call):**
```javascript
const compressed = encode_bulk(tokens);
const text = Buffer.from(decode_bulk_to_text(compressed)).toString('utf-8');
```

---

### 3. `decode_packed_ids_to_text(packedBytes)`
**Packed token IDs → UTF-8 text**

Useful when you have token IDs stored as raw binary (4 bytes per u32, little-endian) and want to convert them directly to text.

```javascript
// Create packed token IDs (u32 array as bytes)
const packedIds = new Uint8Array(tokens.length * 4);
const view = new DataView(packedIds.buffer);
tokens.forEach((id, idx) => {
    view.setUint32(idx * 4, id, true); // little-endian
});

// Convert directly to text
const text = Buffer.from(decode_packed_ids_to_text(packedIds)).toString('utf-8');
```

**Pipeline:** Unpack u32s → Token IDs → UTF-8 bytes  
**Use case:** Token IDs stored in binary format (e.g., from disk or database)

---

### 4. `encode_decode_to_text(tokenIds)`
**Round-trip validation: Token IDs → Compressed → Decompressed → UTF-8 text**

```javascript
const tokens = [1, 450, 4996];
const text = Buffer.from(encode_decode_to_text(tokens)).toString('utf-8');
```

**Pipeline:** Huffman encode → Huffman decode → UTF-8 bytes  
**Use case:** Testing and validation that compression/decompression works correctly

---

## Comparison: Old vs New API

### Old API (Multiple Calls)
```javascript
// Step 1: Encode tokens
const compressed = encode_bulk(tokens);

// Step 2: Decode to token IDs (1st boundary crossing)
const tokenIds = decode_bulk(compressed);

// Step 3: Convert to text (2nd boundary crossing)
const utf8 = decode_ids(tokenIds);
const text = Buffer.from(utf8).toString('utf-8');

// Total: 2-3 WASM function calls
```

### New API (Single Call)
```javascript
// All in one call
const compressed = encode_bulk(tokens);
const text = Buffer.from(decode_bulk_to_text(compressed)).toString('utf-8');

// Total: 1 WASM function call
```

---

## When to Use Which Function

### Use `decode_bulk_to_text()` when:
- ✓ You have Huffman-compressed bytes
- ✓ You want the final text output
- ✓ Performance matters (streaming, large datasets)

### Use `decode_bulk()` + `decode_ids()` when:
- ✓ You need the intermediate token IDs
- ✓ You're doing token-level analysis
- ✓ You need to inspect or modify token IDs

### Use `decode_packed_ids_to_text()` when:
- ✓ Token IDs are stored as raw bytes (not Huffman-encoded)
- ✓ Reading from binary storage format
- ✓ Interoperating with other systems

### Use `encode_decode_to_text()` when:
- ✓ Testing compression integrity
- ✓ Validating round-trip encoding
- ✓ Benchmarking

---

## Performance Metrics

Based on `optimized_pipeline.js`:

| Method | Calls | Time (13 tokens) | Time (1000 tokens) |
|--------|-------|------------------|---------------------|
| Old API (3 calls) | 3 | 1.838ms | 3.082ms |
| **New API (1 call)** | **1** | **0.112ms** | **0.722ms** |
| **Speedup** | - | **16.4x** | **4.3x** |

---

## Migration Guide

### Example 1: Simple decoding
```javascript
// Before
const compressed = encode_bulk(tokens);
const tokenIds = decode_bulk(compressed);
const text = Buffer.from(decode_ids(tokenIds)).toString('utf-8');

// After
const compressed = encode_bulk(tokens);
const text = Buffer.from(decode_bulk_to_text(compressed)).toString('utf-8');
```

### Example 2: Streaming LLM responses
```javascript
// Before
streamingChunks.forEach(chunk => {
    const compressed = encode_bulk(chunk);
    const ids = decode_bulk(compressed);
    const text = Buffer.from(decode_ids(ids)).toString('utf-8');
    display(text);
});

// After
streamingChunks.forEach(chunk => {
    const compressed = encode_bulk(chunk);
    const text = Buffer.from(decode_bulk_to_text(compressed)).toString('utf-8');
    display(text);
});
```

---

## Complete API Reference

All functions available in the WASM module:

```javascript
const api = require('./pkg/token_entropy_encoder.js');

// Initialization
api.init();                          // Auto-called on import

// Huffman Encoding
api.encode(tokenId)                  // Single token: u32 → Uint8Array
api.encode_bulk(tokenIds)            // Multiple tokens: u32[] → Uint8Array

// Huffman Decoding
api.decode(buffer)                   // Single token: Uint8Array → u32
api.decode_bulk(buffer)              // Multiple tokens: Uint8Array → u32[]

// Token Decoding (IDs to Text)
api.decode_ids(tokenIds)             // u32[] → Uint8Array (UTF-8)

// 🆕 Optimized Combined Operations
api.decode_to_text(buffer)           // Compressed → Text (single)
api.decode_bulk_to_text(buffer)      // Compressed → Text (bulk)
api.decode_packed_ids_to_text(bytes) // Packed u32s → Text
api.encode_decode_to_text(tokenIds)  // Round-trip validation

// Decoder Info
api.decoder_vocab_size()             // Get vocabulary size
api.decoder_is_loaded()              // Check if decoder ready

// Encoder Info
api.alphabet_size()                  // Get Huffman alphabet size
api.average_code_length()            // Get avg code length
api.is_loaded()                      // Check if encoder ready
```
