use crate::huffman::HuffmanGenerator;
use crate::token_compressor::TokenCompressor;
use crate::decoder::Decoder;
use once_cell::sync::Lazy;
use wasm_bindgen::prelude::*;

// Static HuffmanGenerator loaded once from the JSON file
static HUFFMAN: Lazy<HuffmanGenerator> = Lazy::new(|| {
    // The JSON string is embedded at compile time
    let json_data = include_str!("../enc_dec.json");
    HuffmanGenerator::from_json(json_data)
        .expect("Failed to deserialize HuffmanGenerator from JSON")
});

// Static Decoder loaded once from the embedded decodepack.bin
static DECODER: Lazy<Option<Decoder>> = Lazy::new(|| {
    // The decodepack.bin is embedded at compile time from the path in DECODEPACK_PATH env var
    let pack_data: &[u8] = include_bytes!(env!("DECODEPACK_PATH"));
    let mut decoder = Decoder::new();
    match decoder.init_decodepack(pack_data) {
        Ok(_) => Some(decoder),
        Err(_e) => {
            // Debug: uncomment to see error
            // eprintln!("Failed to init decoder: {}", _e);
            None
        }
    }
});

/// Initialize the WASM module and load the HuffmanGenerator and Decoder
/// This is called automatically when the module is loaded
#[wasm_bindgen(start)]
pub fn init() {
    // Force initialization of the static HUFFMAN generator
    Lazy::force(&HUFFMAN);
    // Try to initialize decoder (non-fatal if it fails)
    Lazy::force(&DECODER);
}

/// Decode a buffer of bytes into a token ID
///
/// For m=2 (binary), expects packed format: [1 byte: valid bits in last byte (0-8)] [packed bits]
/// For other alphabets, expects raw alphabet symbols.
///
/// # Arguments
/// * `buffer` - A byte array containing encoded data
///
/// # Returns
/// The decoded token ID, or an error message
#[wasm_bindgen]
pub fn decode(buffer: &[u8]) -> Result<u32, JsValue> {
    HUFFMAN
        .decode(buffer)
        .map_err(|e| JsValue::from_str(&format!("Decode error: {}", e)))
}

/// Encode a token ID into bytes
///
/// For m=2 (binary), returns packed format: [1 byte: valid bits in last byte (0-8)] [packed bits]
/// For other alphabets, returns raw alphabet symbols.
///
/// # Arguments
/// * `token_id` - The token ID to encode
///
/// # Returns
/// A byte array (packed if m=2, or raw symbols otherwise)
#[wasm_bindgen]
pub fn encode(token_id: u32) -> Result<Vec<u8>, JsValue> {
    HUFFMAN
        .encode(token_id)
        .map_err(|e| JsValue::from_str(&format!("Encode error: {}", e)))
}

/// Get the alphabet size of the Huffman encoder
#[wasm_bindgen]
pub fn alphabet_size() -> u8 {
    HUFFMAN.alphabet_size()
}

/// Check if the HuffmanGenerator is loaded
#[wasm_bindgen]
pub fn is_loaded() -> bool {
    true
}

/// Get the weighted average code length using probabilities from the tree
///
/// Returns the expected code length: sum(p_i * length_i) for all tokens
#[wasm_bindgen]
pub fn average_code_length() -> f64 {
    HUFFMAN.average_code_length()
}

/// Encode multiple tokens into packed bytes
///
/// For m=2 (binary), returns format: [1 byte: valid bits in last byte (0-8)] [packed bits for all tokens]
///
/// # Arguments
/// * `tokens` - Array of token IDs to encode
///
/// # Returns
/// A byte array containing all encoded tokens (packed if m=2, or raw symbols otherwise)
#[wasm_bindgen]
pub fn encode_bulk(tokens: Box<[JsValue]>) -> Result<Vec<u8>, JsValue> {
    // Convert JsValue array to Vec<u32>
    let token_ids: Result<Vec<u32>, JsValue> = tokens
        .iter()
        .map(|v| {
            v.as_f64()
                .ok_or_else(|| JsValue::from_str("All tokens must be numbers"))
                .map(|n| n as u32)
        })
        .collect();

    let token_ids = token_ids?;

    HUFFMAN
        .encode_bulk(&token_ids)
        .map_err(|e| JsValue::from_str(&format!("Bulk encode error: {}", e)))
}

/// Decode a buffer of bytes into multiple token IDs
///
/// For m=2 (binary), expects packed format: [1 byte: valid bits in last byte (0-8)] [packed bits]
/// For other alphabets, expects raw alphabet symbols.
/// Decodes all tokens sequentially from the buffer.
///
/// # Arguments
/// * `buffer` - A byte array containing encoded data
///
/// # Returns
/// An array of decoded token IDs, or an error message
#[wasm_bindgen]
pub fn decode_bulk(buffer: &[u8]) -> Result<Box<[JsValue]>, JsValue> {
    let token_ids = HUFFMAN
        .decode_bulk(buffer)
        .map_err(|e| JsValue::from_str(&format!("Bulk decode error: {}", e)))?;

    // Convert Vec<u32> to Box<[JsValue]>
    let js_values: Vec<JsValue> = token_ids.into_iter().map(|id| JsValue::from(id)).collect();
    Ok(js_values.into_boxed_slice())
}

/// Decode a buffer of compressed bytes directly to UTF-8 text
///
/// This combines Huffman decoding and token-to-text conversion in a single call,
/// minimizing JS/WASM boundary crossings for better performance.
///
/// Pipeline: Compressed bytes → Token IDs → UTF-8 bytes
///
/// # Arguments
/// * `buffer` - A byte array containing Huffman-encoded data
///
/// # Returns
/// A byte array containing the UTF-8 text representation
#[wasm_bindgen]
pub fn decode_to_text(buffer: &[u8]) -> Result<Vec<u8>, JsValue> {
    // Step 1: Huffman decode to get token ID
    let token_id = HUFFMAN
        .decode(buffer)
        .map_err(|e| JsValue::from_str(&format!("Huffman decode error: {}", e)))?;

    // Step 2: Convert token ID to UTF-8 bytes
    let decoder = DECODER.as_ref()
        .ok_or_else(|| JsValue::from_str("Decoder not initialized"))?;
    
    decoder
        .decode_ids(&[token_id])
        .map_err(|e| JsValue::from_str(&format!("Token decode error: {}", e)))
}

/// Decode a buffer of compressed bytes directly to UTF-8 text (bulk version)
///
/// This combines Huffman bulk decoding and token-to-text conversion in a single call,
/// minimizing JS/WASM boundary crossings for better performance.
///
/// Pipeline: Compressed bytes → Token IDs → UTF-8 bytes
///
/// # Arguments
/// * `buffer` - A byte array containing Huffman-encoded data for multiple tokens
///
/// # Returns
/// A byte array containing the UTF-8 text representation of all tokens
#[wasm_bindgen]
pub fn decode_bulk_to_text(buffer: &[u8]) -> Result<Vec<u8>, JsValue> {
    // Step 1: Huffman decode to get token IDs
    let token_ids = HUFFMAN
        .decode_bulk(buffer)
        .map_err(|e| JsValue::from_str(&format!("Huffman decode error: {}", e)))?;

    // Step 2: Convert token IDs to UTF-8 bytes
    let decoder = DECODER.as_ref()
        .ok_or_else(|| JsValue::from_str("Decoder not initialized"))?;
    
    decoder
        .decode_ids(&token_ids)
        .map_err(|e| JsValue::from_str(&format!("Token decode error: {}", e)))
}

/// Decode packed token IDs (u32 array as bytes) directly to UTF-8 text
///
/// Takes a byte array representing packed u32 token IDs (little-endian) and
/// converts them directly to UTF-8 text, bypassing Huffman decoding.
/// This is useful when you have token IDs stored in raw binary format.
///
/// Pipeline: Packed u32 bytes → Token IDs → UTF-8 bytes
///
/// # Arguments
/// * `packed_ids` - Byte array containing token IDs as little-endian u32s
///
/// # Returns
/// A byte array containing the UTF-8 text representation
#[wasm_bindgen]
pub fn decode_packed_ids_to_text(packed_ids: &[u8]) -> Result<Vec<u8>, JsValue> {
    // Ensure the buffer is properly aligned for u32
    if packed_ids.len() % 4 != 0 {
        return Err(JsValue::from_str("Packed IDs buffer length must be a multiple of 4"));
    }

    // Convert bytes to u32 token IDs (little-endian)
    let token_ids: Vec<u32> = packed_ids
        .chunks_exact(4)
        .map(|chunk| u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect();

    // Convert token IDs to UTF-8 bytes
    let decoder = DECODER.as_ref()
        .ok_or_else(|| JsValue::from_str("Decoder not initialized"))?;
    
    decoder
        .decode_ids(&token_ids)
        .map_err(|e| JsValue::from_str(&format!("Token decode error: {}", e)))
}

/// Encode token IDs and immediately decode to text (for testing/validation)
///
/// This combines encoding and decoding in a single call for round-trip validation.
///
/// Pipeline: Token IDs → Huffman encode → Huffman decode → UTF-8 bytes
///
/// # Arguments
/// * `ids` - Array of token IDs to encode and decode
///
/// # Returns
/// A byte array containing the UTF-8 text representation
#[wasm_bindgen]
pub fn encode_decode_to_text(ids: Box<[JsValue]>) -> Result<Vec<u8>, JsValue> {
    // Convert JsValue array to Vec<u32>
    let token_ids: Result<Vec<u32>, JsValue> = ids
        .iter()
        .map(|v| {
            v.as_f64()
                .ok_or_else(|| JsValue::from_str("All token IDs must be numbers"))
                .map(|n| n as u32)
        })
        .collect();

    let token_ids = token_ids?;

    // Encode to compressed bytes
    let compressed = HUFFMAN
        .encode_bulk(&token_ids)
        .map_err(|e| JsValue::from_str(&format!("Encode error: {}", e)))?;

    // Decode back to token IDs
    let decoded_ids = HUFFMAN
        .decode_bulk(&compressed)
        .map_err(|e| JsValue::from_str(&format!("Decode error: {}", e)))?;

    // Convert to UTF-8 text
    let decoder = DECODER.as_ref()
        .ok_or_else(|| JsValue::from_str("Decoder not initialized"))?;
    
    decoder
        .decode_ids(&decoded_ids)
        .map_err(|e| JsValue::from_str(&format!("Token decode error: {}", e)))
}

/// Decode token IDs into UTF-8 bytes (displayable string)
///
/// # Arguments
/// * `ids` - Array of token IDs to decode
///
/// # Returns
/// A byte array containing the UTF-8 representation of the decoded tokens
#[wasm_bindgen]
pub fn decode_ids(ids: Box<[JsValue]>) -> Result<Vec<u8>, JsValue> {
    // Convert JsValue array to Vec<u32>
    let token_ids: Result<Vec<u32>, JsValue> = ids
        .iter()
        .map(|v| {
            v.as_f64()
                .ok_or_else(|| JsValue::from_str("All token IDs must be numbers"))
                .map(|n| n as u32)
        })
        .collect();

    let token_ids = token_ids?;

    let decoder = DECODER.as_ref()
        .ok_or_else(|| JsValue::from_str("Decoder not initialized"))?;
    
    decoder
        .decode_ids(&token_ids)
        .map_err(|e| JsValue::from_str(&format!("Decode IDs error: {}", e)))
}

/// Get the vocabulary size of the decoder
#[wasm_bindgen]
pub fn decoder_vocab_size() -> u32 {
    DECODER.as_ref()
        .map(|d| d.vocab_size())
        .unwrap_or(0)
}

/// Check if the decoder is loaded
#[wasm_bindgen]
pub fn decoder_is_loaded() -> bool {
    DECODER.as_ref()
        .map(|d| d.is_initialized())
        .unwrap_or(false)
}