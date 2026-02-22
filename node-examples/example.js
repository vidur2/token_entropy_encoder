#!/usr/bin/env node

const { decode, encode, alphabet_size, is_loaded, average_code_length } = require('../pkg/token_entropy_encoder.js');

/**
 * Unpack the header and data from a packed encoding
 * Format: [4 bytes: bit count (big-endian)] [packed bits]
 * 
 * @param {Uint8Array} packed - The packed encoding buffer
 * @returns {Object} Object with bitCount, headerBytes, dataBytes, and bits array
 */
function unpackEncoding(packed) {
    if (packed.length < 4) {
        throw new Error('Packed data too short: need at least 4 bytes for header');
    }
    
    // Extract bit count from first 4 bytes (big-endian)
    const bitCount = (packed[0] << 24) | (packed[1] << 16) | (packed[2] << 8) | packed[3];
    
    // Header is first 4 bytes
    const headerBytes = packed.slice(0, 4);
    
    // Data is everything after the header
    const dataBytes = packed.slice(4);
    
    // Unpack bits from data bytes (MSB first)
    const bits = [];
    for (let i = 0; i < dataBytes.length; i++) {
        const byte = dataBytes[i];
        for (let j = 7; j >= 0; j--) {
            bits.push((byte >> j) & 1);
            if (bits.length === bitCount) {
                break;
            }
        }
        if (bits.length === bitCount) {
            break;
        }
    }
    
    return {
        bitCount,
        headerBytes: Array.from(headerBytes),
        dataBytes: Array.from(dataBytes),
        bits,
        totalBytes: packed.length,
        headerOverhead: 4,
        dataSize: dataBytes.length
    };
}

console.log('=== Token Entropy Encoder WASM Example ===\n');

// Check if loaded
console.log('Module loaded:', is_loaded());
console.log('Alphabet size:', alphabet_size());
console.log('Average code length:', average_code_length().toFixed(2), 'bits (weighted by PMF)');
console.log();

// Example 1: Encode a token ID
console.log('Example 1: Encoding');
console.log('-------------------');
try {
    const tokenId = 1234; // Example token ID
    console.log('Token ID to encode:', tokenId);
    const encoded = encode(tokenId);
    console.log('Encoded result:', encoded);
    console.log('Encoded length:', encoded.length, 'bytes');
    console.log();
} catch (error) {
    console.error('Encode error:', error.message);
    console.log();
}

// Example 2: Decode a buffer
console.log('Example 2: Decoding');
console.log('-------------------');
try {
    // First encode a token, then decode it
    const tokenId = 100;
    const encoded = encode(tokenId);
    console.log('Encoded token ID', tokenId, 'to buffer:', encoded);
    const decoded = decode(encoded);
    console.log('Decoded token ID:', decoded);
    console.log();
} catch (error) {
    console.error('Decode error:', error.message);
    console.log();
}

// Example 3: Round-trip test
console.log('Example 3: Round-trip (encode then decode)');
console.log('-------------------------------------------');
try {
    const originalTokenId = 42;
    console.log('Original token ID:', originalTokenId);
    
    const encoded = encode(originalTokenId);
    console.log('Encoded to', encoded.length, 'bytes');
    
    const decoded = decode(encoded);
    console.log('Decoded token ID:', decoded);
    console.log('Match:', originalTokenId === decoded ? '✓' : '✗');
    console.log();
} catch (error) {
    console.error('Round-trip error:', error.message);
    console.log();
}

// Example 4: Testing various token IDs
console.log('Example 4: Testing various token IDs');
console.log('--------------------------------------');
// Test with some common token IDs (0-127 are typically common tokens)
const testTokenIds = [0, 1, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 128000];

for (const tokenId of testTokenIds) {
    try {
        const encoded = encode(tokenId);
        const decoded = decode(encoded);
        const match = tokenId === decoded;
        const bits = (encoded[0] << 24) | (encoded[1] << 16) | (encoded[2] << 8) | encoded[3];
        console.log(`Token ID ${tokenId}: ${bits} bits -> ${encoded.length} bytes -> decoded: ${decoded} ${match ? '✓' : '✗'}`);
    } catch (error) {
        console.log(`Token ID ${tokenId}: Error: ${error.message}`);
    }
}
console.log();

// Example 5: Unpacking the header and data
console.log('Example 5: Unpacking header and data');
console.log('-------------------------------------');
try {
    const tokenId = 1234;
    const encoded = encode(tokenId);
    const unpacked = unpackEncoding(encoded);
    
    console.log('Token ID:', tokenId);
    console.log('Total encoded size:', unpacked.totalBytes, 'bytes');
    console.log('Header (4 bytes):', unpacked.headerBytes, '-> bit count:', unpacked.bitCount);
    console.log('Data (' + unpacked.dataSize + ' bytes):', unpacked.dataBytes);
    console.log('Unpacked bits:', unpacked.bits.join(''));
    console.log('Header overhead:', unpacked.headerOverhead, 'bytes');
    console.log('Actual encoding size:', unpacked.dataSize, 'bytes');
    console.log('Efficiency: bits needed =', unpacked.bitCount, ', bytes needed = ~' + Math.ceil(unpacked.bitCount / 8));
    console.log();
} catch (error) {
    console.error('Unpacking error:', error.message);
    console.log();
}

// Example 6: Analyzing compression efficiency
console.log('Example 6: Analyzing compression efficiency');
console.log('--------------------------------------------');
const avgCodeLength = average_code_length();
const headerBits = 32; // 4 bytes
const rawU32Bits = 32; // 4 bytes per token

console.log('Average Huffman code length:', avgCodeLength.toFixed(2), 'bits');
console.log('Average packed size (no header):', (avgCodeLength / 8).toFixed(2), 'bytes');
console.log('Average packed size (with header):', ((avgCodeLength / 8) + 4).toFixed(2), 'bytes');
console.log('Raw u32 encoding:', 4, 'bytes per token');
console.log();
console.log('Compression analysis:');
console.log('- Single token: Huffman =', ((headerBits + avgCodeLength) / 8).toFixed(2), 'bytes vs raw u32 = 4 bytes');

// For n tokens: huffman = 32 + n*26.88 bits, raw = n*32 bits
// Break even: 32 + n*26.88 = n*32 => n = 32/(32-26.88)
const breakEvenTokens = headerBits / (rawU32Bits - avgCodeLength);
console.log('- Break-even at ~' + Math.ceil(breakEvenTokens), 'tokens');

// Show savings for various bulk sizes
const bulkSizes = [2, 5, 10, 20, 50];
console.log('- Bulk encoding savings:');
for (const n of bulkSizes) {
    const huffmanBits = headerBits + n * avgCodeLength;
    const rawBits = n * rawU32Bits;
    const savings = ((rawBits - huffmanBits) / rawBits * 100).toFixed(1);
    console.log(`  ${n} tokens: ${(huffmanBits/8).toFixed(1)} bytes vs ${rawBits/8} bytes (${savings}% savings)`);
}
console.log();
