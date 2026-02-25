/**
 * Full Pipeline Integration Test
 * 
 * This example demonstrates the complete flow:
 * 1. Start with token IDs
 * 2. Encode (compress) them using Huffman encoding
 * 3. Decode (decompress) back to token IDs
 * 4. Convert token IDs to displayable UTF-8 strings
 */

const {
    encode_bulk,
    decode_bulk,
    decode_ids,
    decoder_is_loaded,
    decoder_vocab_size,
    alphabet_size,
    average_code_length,
    init
} = require('../pkg/token_entropy_encoder.js');

console.log('=== Token Entropy Encoder - Full Pipeline Test ===\n');

// Initialize the WASM module
init();

console.log('System Status:');
console.log('  Huffman encoder loaded:', true);
console.log('  Alphabet size:', alphabet_size());
console.log('  Average code length:', average_code_length().toFixed(4), 'symbols');
console.log('  Decoder loaded:', decoder_is_loaded());
console.log('  Vocabulary size:', decoder_vocab_size());
console.log('');

// Test 1: Simple greeting
console.log('=== Test 1: Simple Greeting ===');
const greeting = [1, 15043, 29892, 920, 526, 366, 29973]; // Example: "<s> Hello, how are you?"
console.log('Original token IDs:', greeting);
console.log('Original token count:', greeting.length);

// Step 1: Encode (compress) the tokens
console.log('\n[Step 1] Encoding tokens with Huffman...');
const encoded = encode_bulk(greeting);
console.log('  Encoded bytes:', encoded.length, 'bytes');
console.log('  Compression ratio:', (greeting.length * 4 / encoded.length).toFixed(2) + 'x');
console.log('  First 16 bytes:', Array.from(encoded.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));

// Step 2: Decode (decompress) back to token IDs
console.log('\n[Step 2] Decoding back to token IDs...');
const decoded = decode_bulk(encoded);
console.log('  Decoded token IDs:', decoded);
console.log('  Round-trip match:', JSON.stringify(greeting) === JSON.stringify(decoded) ? '✓ SUCCESS' : '✗ FAILED');

// Step 3: Convert token IDs to displayable string
console.log('\n[Step 3] Converting token IDs to text...');
const utf8Bytes = decode_ids(decoded);
const text = Buffer.from(utf8Bytes).toString('utf-8');
console.log('  Text:', JSON.stringify(text));
console.log('  UTF-8 bytes:', utf8Bytes.length);
console.log('');

// Test 2: Longer sequence
console.log('=== Test 2: Longer Sequence ===');
const paragraph = [
    1, 450, 4996, 17354, 1701, 29916, 26681, 261, 338, 263, 4665, 6509, 393,
    508, 2407, 322, 21822, 4515, 8260, 408, 368, 508, 2821, 373, 596, 6601,
    29889
]; // Example paragraph
console.log('Token count:', paragraph.length);

const encoded2 = encode_bulk(paragraph);
console.log('Encoded size:', encoded2.length, 'bytes');
console.log('Uncompressed size:', paragraph.length * 4, 'bytes (32-bit integers)');
console.log('Compression ratio:', (paragraph.length * 4 / encoded2.length).toFixed(2) + 'x');

const decoded2 = decode_bulk(encoded2);
const text2 = Buffer.from(decode_ids(decoded2)).toString('utf-8');
console.log('Decoded text:', JSON.stringify(text2));
console.log('Round-trip match:', JSON.stringify(paragraph) === JSON.stringify(decoded2) ? '✓ SUCCESS' : '✗ FAILED');
console.log('');

// Test 3: Empty sequence
console.log('=== Test 3: Edge Cases ===');
try {
    console.log('Testing empty sequence...');
    const empty = [];
    const encodedEmpty = encode_bulk(empty);
    const decodedEmpty = decode_bulk(encodedEmpty);
    console.log('  Empty sequence: ✓ SUCCESS');
} catch (e) {
    console.log('  Empty sequence: ✗ FAILED -', e.message);
}

// Test 4: Single token
try {
    console.log('Testing single token...');
    const single = [1];
    const encodedSingle = encode_bulk(single);
    const decodedSingle = decode_bulk(encodedSingle);
    const textSingle = Buffer.from(decode_ids(decodedSingle)).toString('utf-8');
    console.log('  Single token [1]:', JSON.stringify(textSingle), '✓ SUCCESS');
} catch (e) {
    console.log('  Single token: ✗ FAILED -', e.message);
}

// Test 5: Special tokens
try {
    console.log('Testing special tokens...');
    const special = [1, 2, 0]; // BOS, EOS, UNK
    const encodedSpecial = encode_bulk(special);
    const decodedSpecial = decode_bulk(encodedSpecial);
    const textSpecial = Buffer.from(decode_ids(decodedSpecial)).toString('utf-8');
    console.log('  Special tokens:', JSON.stringify(textSpecial), '✓ SUCCESS');
} catch (e) {
    console.log('  Special tokens: ✗ FAILED -', e.message);
}

console.log('');
console.log('=== Pipeline Test Complete ===');
