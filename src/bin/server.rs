use std::pin::Pin;

use axum::{Router, routing::get};
use futures::Stream;
use once_cell::sync::Lazy;
use token_entropy_encoder::{huffman::HuffmanGenerator, server::HuffmanServer};
use async_stream::stream;
use tokio::time::{sleep, Duration};

// Load HuffmanGenerator once from the JSON file
static HUFFMAN: Lazy<HuffmanGenerator> = Lazy::new(|| {
    let json_data = include_str!("../../enc_dec.json");
    HuffmanGenerator::from_json(json_data)
        .expect("Failed to deserialize HuffmanGenerator from JSON")
});

pub struct HuffmanServerImpl;

impl<'a> HuffmanServer<'a> for HuffmanServerImpl {
    fn simulate_network_chunks(
        encoded: Vec<u8>,
        chunk_size: usize,
        tick_ms: u64,
    ) -> Pin<Box<dyn Stream<Item = Vec<u8>> + Send>> {
        Box::pin(stream! {
            for chunk in encoded.chunks(chunk_size) {
                yield chunk.to_vec();
                sleep(Duration::from_millis(tick_ms)).await;
            }
        })
    }

    fn get_huffman() -> &'a HuffmanGenerator {
        return &HUFFMAN;
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

#[tokio::main]
async fn main() {
    // Force initialization of the HuffmanGenerator
    Lazy::force(&HUFFMAN);
    println!("HuffmanGenerator loaded successfully!");

    let app = create_router();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("Failed to bind to port 3000");

    println!("Server running on http://127.0.0.1:3000");
    println!("WebSocket endpoint: ws://127.0.0.1:3000/chat");
    println!("Health check: http://127.0.0.1:3000/hello");

    axum::serve(listener, app)
        .await
        .expect("Server failed to start");
}