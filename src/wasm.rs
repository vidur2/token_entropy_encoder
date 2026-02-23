use crate::huffman::HuffmanGenerator;
use crate::token_compressor::TokenCompressor;
use once_cell::sync::Lazy;
use wasm_bindgen::prelude::*;

// Static HuffmanGenerator loaded once from the JSON file
static HUFFMAN: Lazy<HuffmanGenerator> = Lazy::new(|| {
    // The JSON string is embedded at compile time
    let json_data = include_str!("../enc_dec.json");
    HuffmanGenerator::from_json(json_data)
        .expect("Failed to deserialize HuffmanGenerator from JSON")
});

/// Initialize the WASM module and load the HuffmanGenerator
/// This is called automatically when the module is loaded
#[wasm_bindgen(start)]
pub fn init() {
    // Force initialization of the static HUFFMAN generator
    Lazy::force(&HUFFMAN);
}

/// Decode a buffer of packed bytes into a token ID
///
/// For m=2 (binary), expects format: [4 bytes: bit count] [packed bits]
///
/// # Arguments
/// * `buffer` - A byte array containing packed data
///
/// # Returns
/// The decoded token ID, or an error message
#[wasm_bindgen]
pub fn decode(buffer: &[u8]) -> Result<u32, JsValue> {
    if HUFFMAN.alphabet_size() == 2 {
        // Use packed decoding for binary alphabet
        HUFFMAN
            .decode_packed(buffer)
            .map_err(|e| JsValue::from_str(&format!("Decode error: {}", e)))
    } else {
        // Use regular decoding for non-binary alphabets
        HUFFMAN
            .decode(buffer)
            .map_err(|e| JsValue::from_str(&format!("Decode error: {}", e)))
    }
}

/// Encode a token ID into packed bytes
///
/// For m=2 (binary), returns format: [4 bytes: bit count] [packed bits]
///
/// # Arguments
/// * `token_id` - The token ID to encode
///
/// # Returns
/// A byte array (packed if m=2, or raw symbols otherwise)
#[wasm_bindgen]
pub fn encode(token_id: u32) -> Result<Vec<u8>, JsValue> {
    if HUFFMAN.alphabet_size() == 2 {
        // Use packed encoding for binary alphabet
        HUFFMAN
            .encode_packed(token_id)
            .map_err(|e| JsValue::from_str(&format!("Encode error: {}", e)))
    } else {
        // Use regular encoding for non-binary alphabets
        HUFFMAN
            .encode(token_id)
            .map_err(|e| JsValue::from_str(&format!("Encode error: {}", e)))
    }
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
/// For m=2 (binary), returns format: [4 bytes: bit count] [packed bits for all tokens]
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
    
    if HUFFMAN.alphabet_size() == 2 {
        // Use packed encoding for binary alphabet
        HUFFMAN
            .encode_bulk_packed(&token_ids)
            .map_err(|e| JsValue::from_str(&format!("Bulk encode error: {}", e)))
    } else {
        // Use regular encoding for non-binary alphabets
        HUFFMAN
            .encode_bulk(&token_ids)
            .map_err(|e| JsValue::from_str(&format!("Bulk encode error: {}", e)))
    }
}

/// Decode a buffer of packed bytes into multiple token IDs
///
/// For m=2 (binary), expects format: [4 bytes: bit count] [packed bits]
/// Decodes all tokens sequentially from the buffer.
///
/// # Arguments
/// * `buffer` - A byte array containing packed data
///
/// # Returns
/// An array of decoded token IDs, or an error message
#[wasm_bindgen]
pub fn decode_bulk(buffer: &[u8]) -> Result<Box<[JsValue]>, JsValue> {
    let token_ids = if HUFFMAN.alphabet_size() == 2 {
        // Use packed decoding for binary alphabet
        HUFFMAN
            .decode_bulk_packed(buffer)
            .map_err(|e| JsValue::from_str(&format!("Bulk decode error: {}", e)))?
    } else {
        // Use regular decoding for non-binary alphabets
        HUFFMAN
            .decode_bulk(buffer)
            .map_err(|e| JsValue::from_str(&format!("Bulk decode error: {}", e)))?
    };
    
    // Convert Vec<u32> to Box<[JsValue]>
    let js_values: Vec<JsValue> = token_ids.into_iter().map(|id| JsValue::from(id)).collect();
    Ok(js_values.into_boxed_slice())
}
