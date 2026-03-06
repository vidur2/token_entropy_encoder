/* tslint:disable */
/* eslint-disable */

/**
 * Get the alphabet size of the Huffman encoder
 */
export function alphabet_size(): number;

/**
 * Get the weighted average code length using probabilities from the tree
 *
 * Returns the expected code length: sum(p_i * length_i) for all tokens
 */
export function average_code_length(): number;

/**
 * Decode a buffer of bytes into a token ID
 *
 * For m=2 (binary), expects packed format: [1 byte: valid bits in last byte (0-8)] [packed bits]
 * For other alphabets, expects raw alphabet symbols.
 *
 * # Arguments
 * * `buffer` - A byte array containing encoded data
 *
 * # Returns
 * The decoded token ID, or an error message
 */
export function decode(buffer: Uint8Array): number;

/**
 * Decode a buffer of bytes into multiple token IDs
 *
 * For m=2 (binary), expects packed format: [1 byte: valid bits in last byte (0-8)] [packed bits]
 * For other alphabets, expects raw alphabet symbols.
 * Decodes all tokens sequentially from the buffer.
 *
 * # Arguments
 * * `buffer` - A byte array containing encoded data
 *
 * # Returns
 * An array of decoded token IDs, or an error message
 */
export function decode_bulk(buffer: Uint8Array): any[];

/**
 * Decode a buffer of compressed bytes directly to UTF-8 text (bulk version)
 *
 * This combines Huffman bulk decoding and token-to-text conversion in a single call,
 * minimizing JS/WASM boundary crossings for better performance.
 *
 * Pipeline: Compressed bytes → Token IDs → UTF-8 bytes
 *
 * # Arguments
 * * `buffer` - A byte array containing Huffman-encoded data for multiple tokens
 *
 * # Returns
 * A byte array containing the UTF-8 text representation of all tokens
 */
export function decode_bulk_to_text(buffer: Uint8Array): Uint8Array;

/**
 * Decode token IDs into UTF-8 bytes (displayable string)
 *
 * # Arguments
 * * `ids` - Array of token IDs to decode
 *
 * # Returns
 * A byte array containing the UTF-8 representation of the decoded tokens
 */
export function decode_ids(ids: any[]): Uint8Array;

/**
 * Decode packed token IDs (u32 array as bytes) directly to UTF-8 text
 *
 * Takes a byte array representing packed u32 token IDs (little-endian) and
 * converts them directly to UTF-8 text, bypassing Huffman decoding.
 * This is useful when you have token IDs stored in raw binary format.
 *
 * Pipeline: Packed u32 bytes → Token IDs → UTF-8 bytes
 *
 * # Arguments
 * * `packed_ids` - Byte array containing token IDs as little-endian u32s
 *
 * # Returns
 * A byte array containing the UTF-8 text representation
 */
export function decode_packed_ids_to_text(packed_ids: Uint8Array): Uint8Array;

/**
 * Decode a buffer of compressed bytes directly to UTF-8 text
 *
 * This combines Huffman decoding and token-to-text conversion in a single call,
 * minimizing JS/WASM boundary crossings for better performance.
 *
 * Pipeline: Compressed bytes → Token IDs → UTF-8 bytes
 *
 * # Arguments
 * * `buffer` - A byte array containing Huffman-encoded data
 *
 * # Returns
 * A byte array containing the UTF-8 text representation
 */
export function decode_to_text(buffer: Uint8Array): Uint8Array;

/**
 * Check if the decoder is loaded
 */
export function decoder_is_loaded(): boolean;

/**
 * Get the vocabulary size of the decoder
 */
export function decoder_vocab_size(): number;

/**
 * Encode a token ID into bytes
 *
 * For m=2 (binary), returns packed format: [1 byte: valid bits in last byte (0-8)] [packed bits]
 * For other alphabets, returns raw alphabet symbols.
 *
 * # Arguments
 * * `token_id` - The token ID to encode
 *
 * # Returns
 * A byte array (packed if m=2, or raw symbols otherwise)
 */
export function encode(token_id: number): Uint8Array;

/**
 * Encode multiple tokens into packed bytes
 *
 * For m=2 (binary), returns format: [1 byte: valid bits in last byte (0-8)] [packed bits for all tokens]
 *
 * # Arguments
 * * `tokens` - Array of token IDs to encode
 *
 * # Returns
 * A byte array containing all encoded tokens (packed if m=2, or raw symbols otherwise)
 */
export function encode_bulk(tokens: any[]): Uint8Array;

/**
 * Encode token IDs and immediately decode to text (for testing/validation)
 *
 * This combines encoding and decoding in a single call for round-trip validation.
 *
 * Pipeline: Token IDs → Huffman encode → Huffman decode → UTF-8 bytes
 *
 * # Arguments
 * * `ids` - Array of token IDs to encode and decode
 *
 * # Returns
 * A byte array containing the UTF-8 text representation
 */
export function encode_decode_to_text(ids: any[]): Uint8Array;

/**
 * Initialize the WASM module and load the HuffmanGenerator and Decoder
 * This is called automatically when the module is loaded
 */
export function init(): void;

/**
 * Check if the HuffmanGenerator is loaded
 */
export function is_loaded(): boolean;
