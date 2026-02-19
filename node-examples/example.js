#!/usr/bin/env node

const { decode, encode, alphabet_size, is_loaded } = require('../pkg/token_entropy_encoder.js');

console.log('=== Token Entropy Encoder WASM Example ===\n');

// Check if loaded
console.log('Module loaded:', is_loaded());
console.log('Alphabet size:', alphabet_size());
console.log();

// Example 1: Encode a token
console.log('Example 1: Encoding');
console.log('-------------------');
try {
    const token = 'Hello';
    console.log('Token to encode:', token);
    const encoded = encode(token);
    console.log('Encoded result:', encoded);
    console.log('Encoded length:', encoded.length);
    console.log();
} catch (error) {
    console.error('Encode error:', error.message);
    console.log();
}

// Example 2: Decode a buffer
console.log('Example 2: Decoding');
console.log('-------------------');
try {
    // Try decoding a simple buffer
    const buffer = new Uint8Array([0, 1, 0, 1]);
    console.log('Buffer to decode:', buffer);
    const decoded = decode(buffer);
    console.log('Decoded token:', decoded);
    console.log();
} catch (error) {
    console.error('Decode error:', error.message);
    console.log();
}

// Example 3: Round-trip test
console.log('Example 3: Round-trip (encode then decode)');
console.log('-------------------------------------------');
try {
    const originalToken = 'test';
    console.log('Original token:', originalToken);
    
    const encoded = encode(originalToken);
    console.log('Encoded:', encoded);
    
    const decoded = decode(encoded);
    console.log('Decoded:', decoded);
    console.log('Match:', originalToken === decoded ? '✓' : '✗');
    console.log();
} catch (error) {
    console.error('Round-trip error:', error.message);
    console.log();
}

// Example 4: Try some common tokens if they exist
console.log('Example 4: Testing common tokens');
console.log('---------------------------------');
const testTokens = ['the', 'a', 'is', 'in', 'to', 'of', 'and', ' ', '\n'];

for (const token of testTokens) {
    try {
        const encoded = encode(token);
        const decoded = decode(encoded);
        const match = token === decoded;
        console.log(`Token: "${token}" -> [${encoded.slice(0, 10).join(',')}${encoded.length > 10 ? '...' : ''}] (${encoded.length} symbols) -> "${decoded}" ${match ? '✓' : '✗'}`);
    } catch (error) {
        console.log(`Token: "${token}" -> Error: ${error.message}`);
    }
}
