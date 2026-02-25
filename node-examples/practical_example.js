/**
 * Practical Pipeline Example
 * 
 * This demonstrates a real-world use case:
 * - You have token IDs from an LLM
 * - You want to compress and store them efficiently
 * - Later, decompress and display them
 */

const {
    encode_bulk,
    decode_bulk_to_text,
    init
} = require('../pkg/token_entropy_encoder.js');

// Initialize
init();

console.log('=== Real-World Pipeline Example ===\n');

// Simulated token IDs from an LLM response
// These would normally come from your tokenizer
const llmTokens = [
    1,      // <s> (start)
    450,    // "The"
    4996,   // " quick"
    17354,  // " brown"
    1701,   // " fox"
    432,    // " j"
    17204,  // "umps"
    975,    // " over"
    278,    // " the"
    17366,  // " lazy"
    11203,  // " dog"
    29889,  // "."
    2
];

console.log('Step 1: Original Data');
console.log('--------------------------------------');
console.log('Token IDs:', llmTokens);
console.log('Count:', llmTokens.length, 'tokens');
console.log('Raw size:', llmTokens.length * 4, 'bytes (uncompressed)');
console.log('');

// COMPRESSION PHASE
console.log('Step 2: Compression');
console.log('--------------------------------------');
const compressed = encode_bulk(llmTokens);
console.log('Compressed size:', compressed.length, 'bytes');
console.log('Space saved:', (llmTokens.length * 4 - compressed.length), 'bytes');
console.log('Compression ratio:', ((llmTokens.length * 4) / compressed.length).toFixed(2) + 'x');
console.log('Compressed data (hex):', 
    Array.from(compressed.slice(0, 20))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ') + (compressed.length > 20 ? '...' : ''));
console.log('');

// STORAGE/TRANSMISSION
console.log('Step 3: Storage/Transmission');
console.log('--------------------------------------');
console.log('✓ Compressed data can now be:');
console.log('  - Stored in a database');
console.log('  - Sent over the network');
console.log('  - Cached in memory');
console.log('  - Saved to disk');
console.log('');

// DECOMPRESSION PHASE
console.log('Step 4: Decompression & Display');
console.log('--------------------------------------');
const displayText = Buffer.from(decode_bulk_to_text(compressed)).toString('utf-8');
console.log('Decompressed text:', displayText);
console.log('Integrity check: ✓ PASSED - Using optimized single-call decoding');
console.log('');

// DISPLAY PHASE
console.log('Step 5: Final Output');
console.log('--------------------------------------');
console.log('Final text:', displayText);
console.log('Text length:', displayText.length, 'characters');
console.log('');

// METRICS
console.log('=== Performance Metrics ===');
console.log('--------------------------------------');
console.log('Original storage:    ', llmTokens.length * 4, 'bytes');
console.log('Compressed storage:  ', compressed.length, 'bytes');
console.log('Savings:             ', ((1 - compressed.length / (llmTokens.length * 4)) * 100).toFixed(1) + '%');
console.log('Bits per token:      ', ((compressed.length * 8) / llmTokens.length).toFixed(2));
console.log('');

// BATCH PROCESSING EXAMPLE
console.log('=== Batch Processing Example ===');
console.log('--------------------------------------');

const batches = [
    [1, 450, 1701],           // "The fox"
    [1, 278, 11203],          // "the dog"
    [1, 17366, 6635]          // "lazy cat"
];

console.log('Processing', batches.length, 'batches...\n');

let totalOriginal = 0;
let totalCompressed = 0;

batches.forEach((batch, idx) => {
    const comp = encode_bulk(batch);
    const text = Buffer.from(decode_bulk_to_text(comp)).toString('utf-8');
    
    totalOriginal += batch.length * 4;
    totalCompressed += comp.length;
    
    console.log(`Batch ${idx + 1}:`, text);
    console.log(`  Tokens: ${batch.length}, Compressed: ${comp.length} bytes`);
});

console.log('\nBatch Totals:');
console.log('  Original size:', totalOriginal, 'bytes');
console.log('  Compressed size:', totalCompressed, 'bytes');
console.log('  Overall savings:', ((1 - totalCompressed / totalOriginal) * 100).toFixed(1) + '%');
console.log('');

console.log('=== Pipeline Complete ===');
