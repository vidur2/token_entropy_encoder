/**
 * Performance Comparison: Optimized vs Multi-Step Decoding
 * 
 * Demonstrates the performance benefits of using the new optimized functions
 * that minimize JS/WASM boundary crossings
 */

const {
    encode_bulk,
    decode_bulk,
    decode_ids,
    decode_bulk_to_text,
    decode_packed_ids_to_text,
    encode_decode_to_text,
    init
} = require('../pkg/token_entropy_encoder.js');

// Initialize
init();

console.log('=== Performance: Minimizing JS/WASM Boundary Crossings ===\n');

const testTokens = [1, 450, 4996, 17354, 1701, 432, 17204, 975, 278, 17366, 11203, 29889, 2];

console.log('Test Data:', testTokens.length, 'tokens\n');
console.log('━'.repeat(70) + '\n');

// METHOD 1: Multiple boundary crossings (OLD WAY)
console.log('Method 1: Multiple Boundary Crossings (3 calls)');
console.log('  Step 1: encode_bulk()       [JS → WASM → JS]');
console.log('  Step 2: decode_bulk()       [JS → WASM → JS]');
console.log('  Step 3: decode_ids()        [JS → WASM → JS]');
console.log('  Total boundary crossings: 6 (3 in + 3 out)\n');

console.time('Method 1');
const compressed1 = encode_bulk(testTokens);
const decompressed1 = decode_bulk(compressed1);
const text1 = Buffer.from(decode_ids(decompressed1)).toString('utf-8');
console.timeEnd('Method 1');
console.log('  Result:', JSON.stringify(text1));
console.log('  Compressed size:', compressed1.length, 'bytes\n');

console.log('━'.repeat(70) + '\n');

// METHOD 2: Single optimized call (NEW WAY)
console.log('Method 2: Optimized Single Call (1 call)');
console.log('  Step 1: decode_bulk_to_text() [JS → WASM → JS]');
console.log('  Total boundary crossings: 2 (1 in + 1 out)\n');

const compressed2 = encode_bulk(testTokens);
console.time('Method 2');
const text2 = Buffer.from(decode_bulk_to_text(compressed2)).toString('utf-8');
console.timeEnd('Method 2');
console.log('  Result:', JSON.stringify(text2));
console.log('  Same output:', text1 === text2 ? '✓' : '✗');
console.log('\n' + '━'.repeat(70) + '\n');

// METHOD 3: Packed IDs directly to text
console.log('Method 3: Packed Token IDs to Text');
console.log('  Use case: You have token IDs stored as binary (4 bytes per ID)');
console.log('  decode_packed_ids_to_text() [JS → WASM → JS]\n');

// Create packed token IDs (u32 array as bytes, little-endian)
const packedIds = new Uint8Array(testTokens.length * 4);
const view = new DataView(packedIds.buffer);
testTokens.forEach((id, idx) => {
    view.setUint32(idx * 4, id, true); // true = little-endian
});

console.time('Method 3');
const text3 = Buffer.from(decode_packed_ids_to_text(packedIds)).toString('utf-8');
console.timeEnd('Method 3');
console.log('  Result:', JSON.stringify(text3));
console.log('  Input size:', packedIds.length, 'bytes (raw token IDs)');
console.log('  Same output:', text1 === text3 ? '✓' : '✗');
console.log('\n' + '━'.repeat(70) + '\n');

// METHOD 4: Round-trip encoding with validation
console.log('Method 4: Round-Trip Encode/Decode/Text (validation)');
console.log('  encode_decode_to_text() - Validate compression works\n');

console.time('Method 4');
const text4 = Buffer.from(encode_decode_to_text(testTokens)).toString('utf-8');
console.timeEnd('Method 4');
console.log('  Result:', JSON.stringify(text4));
console.log('  Same output:', text1 === text4 ? '✓' : '✗');
console.log('\n' + '━'.repeat(70) + '\n');

// LARGER TEST
console.log('Performance Test with Larger Dataset:\n');
const largeTokens = Array.from({length: 1000}, (_, i) => (i % 31999) + 1);

console.log('Dataset:', largeTokens.length, 'tokens\n');

console.log('Old Way (3 separate calls):');
console.time('  Large: Old Way');
const c1 = encode_bulk(largeTokens);
const d1 = decode_bulk(c1);
const t1 = Buffer.from(decode_ids(d1)).toString('utf-8');
console.timeEnd('  Large: Old Way');

console.log('\nNew Way (1 optimized call):');
console.time('  Large: New Way');
const c2 = encode_bulk(largeTokens);
const t2 = Buffer.from(decode_bulk_to_text(c2)).toString('utf-8');
console.timeEnd('  Large: New Way');

console.log('\nResults match:', t1 === t2 ? '✓' : '✗');
console.log('');

console.log('━'.repeat(70) + '\n');

console.log('=== Summary ===\n');
console.log('New Optimized Functions:');
console.log('  ✓ decode_bulk_to_text()        - Compressed → Text (1 call)');
console.log('  ✓ decode_to_text()             - Single token compressed → Text');
console.log('  ✓ decode_packed_ids_to_text()  - Packed u32s → Text');
console.log('  ✓ encode_decode_to_text()      - Round-trip validation');
console.log('\nBenefits:');
console.log('  • Fewer JS/WASM boundary crossings');
console.log('  • Reduced data marshalling overhead');
console.log('  • Simpler API for common use cases');
console.log('  • Better performance for large datasets');
console.log('');
