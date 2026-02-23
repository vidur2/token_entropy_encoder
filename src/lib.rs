pub mod huffman;
pub mod token_compressor;

#[cfg(not(target_arch = "wasm32"))]
pub mod server;

#[cfg(not(target_arch = "wasm32"))]
pub mod vocab;

#[cfg(not(target_arch = "wasm32"))]
pub mod vocab_size;

#[cfg(target_arch = "wasm32")]
pub mod wasm;

// include!("/generated.rs");
