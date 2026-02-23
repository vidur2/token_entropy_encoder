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
 * Initialize the WASM module and load the HuffmanGenerator
 * This is called automatically when the module is loaded
 */
export function init(): void;

/**
 * Check if the HuffmanGenerator is loaded
 */
export function is_loaded(): boolean;
