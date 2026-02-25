/**
 * Streaming Pipeline Example
 * 
 * Simulates a real-time LLM streaming scenario:
 * - Tokens arrive incrementally
 * - Each chunk is compressed immediately
 * - Can be decompressed and displayed on demand
 */

const {
    encode_bulk,
    decode_bulk_to_text,
    init
} = require('../pkg/token_entropy_encoder.js');

// Initialize
init();

console.log('=== Streaming LLM Response Pipeline ===\n');

// Simulate streaming token generation from an LLM
const streamingChunks = [
    [1, 450],                    // "<s>The"
    [4996, 17354],               // " quick brown"
    [1701, 432, 17204],          // " fox jumps"
    [975, 278],                  // " over the"
    [17366, 11203],              // " lazy dog"
    [29889, 13],                 // ".\n"
    [2]                          // "</s>"
];

let compressedChunks = [];
let totalTokens = 0;
let totalUncompressed = 0;
let totalCompressed = 0;

console.log('Simulating LLM streaming response...\n');
console.log('━'.repeat(60));

streamingChunks.forEach((chunk, idx) => {
    // Simulate delay between chunks
    console.log(`\n[Chunk ${idx + 1}] Received ${chunk.length} token(s): ${JSON.stringify(chunk)}`);
    
    // Compress immediately
    const compressed = encode_bulk(chunk);
    compressedChunks.push(compressed);
    
    totalTokens += chunk.length;
    totalUncompressed += chunk.length * 4;
    totalCompressed += compressed.length;
    
    console.log(`  → Compressed to ${compressed.length} bytes`);
    console.log(`  → Cumulative: ${totalTokens} tokens, ${totalCompressed}/${totalUncompressed} bytes (${((1 - totalCompressed/totalUncompressed) * 100).toFixed(1)}% saved)`);
});

console.log('\n' + '━'.repeat(60));
console.log('\n=== Stream Complete - Decompressing & Displaying ===\n');

// Now reconstruct the full response
let allCompressed = [];

compressedChunks.forEach((compressed, idx) => {
    allCompressed.push(compressed);
    
    // For progressive display, we'd decompress all chunks so far
    // In this demo, just show what each chunk decodes to
    const chunkText = Buffer.from(decode_bulk_to_text(compressed)).toString('utf-8');
    console.log(`Chunk ${idx + 1} text: ${JSON.stringify(chunkText)}`);
});

// Show full reconstruction by decoding all compressed data
console.log('\nFull text reconstruction:');
const fullBytes = Buffer.concat(compressedChunks.map(c => decode_bulk_to_text(c)));
const fullText = fullBytes.toString('utf-8');
console.log(JSON.stringify(fullText));

console.log('\n' + '━'.repeat(60));
console.log('\n=== Final Results ===\n');

console.log('Complete text:', fullText);
console.log('\nStatistics:');
console.log('  Total tokens:', totalTokens);
console.log('  Uncompressed size:', totalUncompressed, 'bytes');
console.log('  Compressed size:', totalCompressed, 'bytes');
console.log('  Space saved:', totalUncompressed - totalCompressed, 'bytes');
console.log('  Compression ratio:', (totalUncompressed / totalCompressed).toFixed(2) + 'x');
console.log('  Average bits/token:', ((totalCompressed * 8) / totalTokens).toFixed(2));
console.log('\n=== Use Cases ===\n');
console.log('✓ Store LLM conversation history efficiently');
console.log('✓ Cache model outputs with reduced memory');
console.log('✓ Transmit token streams over bandwidth-limited connections');
console.log('✓ Store training data or fine-tuning examples compactly');
console.log('✓ Archive chat logs or model interactions');
console.log('');
