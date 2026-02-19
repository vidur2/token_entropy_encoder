/* tslint:disable */
/* eslint-disable */

/**
 * Get the alphabet size of the Huffman encoder
 */
export function alphabet_size(): number;

/**
 * Decode a buffer of alphabet symbols into a token string
 *
 * # Arguments
 * * `buffer` - A byte array containing alphabet symbols (each in range 0 to m-1)
 *
 * # Returns
 * The decoded token string, or an error message
 */
export function decode(buffer: Uint8Array): string;

/**
 * Encode a token string into a buffer of alphabet symbols
 *
 * # Arguments
 * * `token` - The token string to encode
 *
 * # Returns
 * A byte array containing alphabet symbols
 */
export function encode(token: string): Uint8Array;

/**
 * Initialize the WASM module and load the HuffmanGenerator
 * This is called automatically when the module is loaded
 */
export function init(): void;

/**
 * Check if the HuffmanGenerator is loaded
 */
export function is_loaded(): boolean;
