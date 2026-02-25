/**
 * Example demonstrating how to decode token IDs into displayable strings
 * using the embedded decoder functionality in WASM
 */

const {
    decode_ids,
    decoder_is_loaded,
    decoder_vocab_size,
    init
} = require('../pkg/token_entropy_encoder.js');

// Initialize the WASM module (loads HuffmanGenerator and Decoder)
init();

console.log('Decoder loaded:', decoder_is_loaded());
console.log('Vocabulary size:', decoder_vocab_size());
console.log('');

// Example: decode some token IDs
const tokenIds = [1, 29871, 30022, 29902, 30010, 29879]; // Example token IDs

console.log('Decoding token IDs:', tokenIds);

// Decode token IDs to UTF-8 bytes
const utf8Bytes = decode_ids(tokenIds);

// Convert UTF-8 bytes to a string
const text = Buffer.from(utf8Bytes).toString('utf-8');

console.log('Decoded text:', text);
console.log('');

// Example with a more realistic sequence
const exampleTokens = [1, 450, 2691, 323, 279, 1917];
console.log('Decoding another sequence:', exampleTokens);

try {
    const decodedBytes = decode_ids(exampleTokens);
    const decodedText = Buffer.from(decodedBytes).toString('utf-8');
    console.log('Result:', decodedText);
} catch (error) {
    console.error('Error decoding:', error);
}
