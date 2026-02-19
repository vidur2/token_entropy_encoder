/* tslint:disable */
/* eslint-disable */

/**
 * Get the alphabet size of the Huffman encoder
 */
export function alphabet_size(): number;

/**
 * Decode a buffer of packed bytes into a token string
 *
 * For m=2 (binary), expects format: [4 bytes: bit count] [packed bits]
 *
 * # Arguments
 * * `buffer` - A byte array containing packed data
 *
 * # Returns
 * The decoded token string, or an error message
 */
export function decode(buffer: Uint8Array): string;

/**
 * Decode a buffer of packed bytes into multiple token strings
 *
 * For m=2 (binary), expects format: [4 bytes: bit count] [packed bits]
 * Decodes all tokens sequentially from the buffer.
 *
 * # Arguments
 * * `buffer` - A byte array containing packed data
 *
 * # Returns
 * An array of decoded token strings, or an error message
 */
export function decode_bulk(buffer: Uint8Array): any[];

/**
 * Encode a token string into packed bytes
 *
 * For m=2 (binary), returns format: [4 bytes: bit count] [packed bits]
 *
 * # Arguments
 * * `token` - The token string to encode
 *
 * # Returns
 * A byte array (packed if m=2, or raw symbols otherwise)
 */
export function encode(token: string): Uint8Array;

/**
 * Encode multiple tokens into packed bytes
 *
 * For m=2 (binary), returns format: [4 bytes: bit count] [packed bits for all tokens]
 *
 * # Arguments
 * * `tokens` - Array of token strings to encode
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
