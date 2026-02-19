use crate::huffman::HuffmanGenerator;
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

/// Decode a buffer of packed bytes into a token string
///
/// For m=2 (binary), expects format: [4 bytes: bit count] [packed bits]
///
/// # Arguments
/// * `buffer` - A byte array containing packed data
///
/// # Returns
/// The decoded token string, or an error message
#[wasm_bindgen]
pub fn decode(buffer: &[u8]) -> Result<String, JsValue> {
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

/// Encode a token string into packed bytes
///
/// For m=2 (binary), returns format: [4 bytes: bit count] [packed bits]
///
/// # Arguments
/// * `token` - The token string to encode
///
/// # Returns
/// A byte array (packed if m=2, or raw symbols otherwise)
#[wasm_bindgen]
pub fn encode(token: &str) -> Result<Vec<u8>, JsValue> {
    if HUFFMAN.alphabet_size() == 2 {
        // Use packed encoding for binary alphabet
        HUFFMAN
            .encode_packed(token)
            .map_err(|e| JsValue::from_str(&format!("Encode error: {}", e)))
    } else {
        // Use regular encoding for non-binary alphabets
        HUFFMAN
            .encode(token)
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
