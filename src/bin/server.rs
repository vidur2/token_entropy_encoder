use std::pin::Pin;

use axum::{Router, routing::get};
use futures::Stream;
use token_entropy_encoder::{huffman::HuffmanGenerator, server::HuffmanServer};

pub struct HuffmanServerImpl;

impl HuffmanServer for HuffmanServerImpl {
    fn simulate_network_chunks(
        encoded: Vec<u8>,
        chunk_size: usize,
        tick_ms: u64,
    ) -> Pin<Box<dyn Stream<Item = Vec<u8>> + Send>> {
        todo!()
    }

    fn get_huffman() -> HuffmanGenerator {
        todo!()
    }
}

/// Create the router with all routes for a HuffmanServer
///
/// This function sets up the standard routes:
/// - GET /hello - Health check endpoint
/// - POST /chat - WebSocket upgrade endpoint for chat
pub fn create_router() -> Router {
    Router::new()
        .route("/hello", get(HuffmanServerImpl::hello_handler))
        .route("/chat", get(HuffmanServerImpl::chat_handler))
}

fn main() {
    
}