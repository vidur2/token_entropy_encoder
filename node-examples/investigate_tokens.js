/**
 * Token Investigation - Understanding Token Decoding
 */

const {
    decode_ids,
    init
} = require('../pkg/token_entropy_encoder.js');

init();

console.log('=== Investigating Token Decoding ===\n');

// Let's see what individual tokens actually decode to
const testTokens = [
    [1, 'BOS (Beginning of Sequence)'],
    [2, 'EOS (End of Sequence)'],
    [450, 'Token 450'],
    [4996, 'Token 4996'],
    [17354, 'Token 17354'],
    [1701, 'Token 1701'],
    [432, 'Token 432'],
    [17204, 'Token 17204'],
    [975, 'Token 975'],
    [278, 'Token 278'],
    [17366, 'Token 17366'],
    [11203, 'Token 11203'],
    [29889, 'Token 29889']
];

console.log('Individual Token Decoding:\n');
testTokens.forEach(([id, desc]) => {
    const bytes = decode_ids([id]);
    const text = Buffer.from(bytes).toString('utf-8');
    console.log(`  Token ${id.toString().padStart(5)} (${desc.padEnd(35)}): "${text}"`);
});

console.log('\n' + '━'.repeat(70) + '\n');

// In LLaMA-style tokenizers, spaces are often PART of the token
// Let's find some tokens that likely contain spaces
console.log('Looking for tokens with spaces...\n');

// Common tokens that typically have leading spaces in LLaMA tokenizers
const spacedTokenIds = [
    29871,  // This is typically " " (space) in LLaMA tokenizers
    518,    // Often "["
    29914,  // Often "/"
];

spacedTokenIds.forEach(id => {
    const bytes = decode_ids([id]);
    const text = Buffer.from(bytes).toString('utf-8');
    const visible = text.replace(/ /g, '␣').replace(/\n/g, '↵');
    console.log(`  Token ${id}: "${visible}" (${text.length} bytes)`);
});

console.log('\n' + '━'.repeat(70) + '\n');
console.log('KEY INSIGHT:\n');
console.log('In LLaMA-based tokenizers like TinyLlama:');
console.log('  - Token 29871 = " " (space character)');
console.log('  - Many word tokens include the leading space');
console.log('  - Example: " hello" is often a single token, not "hello"');
console.log('\nTo get proper spacing, use token sequences that include');
console.log('space tokens (29871) or tokens with embedded spaces.');
console.log('');
