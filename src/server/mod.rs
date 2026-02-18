use axum::{
    Router, extract::{
        Json, Query, State, ws::{Message, WebSocket, WebSocketUpgrade}
    }, http::StatusCode, response::IntoResponse, routing::{get, post}
};
use futures::{stream::Stream, SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::pin::Pin;
use std::future::Future;
use tokio::time::{sleep, Duration};

use crate::huffman::generator::HuffmanGenerator;

/// Request body for the /chat endpoint
#[derive(Debug, Deserialize, Serialize)]
pub struct ChatRequest {
    pub message: String,
}

/// Trait that generalizes over an axum async websocket server with Huffman encoding capabilities
pub trait HuffmanServer: Send + Sync + Sized {
    /// Simulate network chunks from an encoded message
    /// 
    /// # Arguments
    /// * `encoded` - The encoded message as bytes
    /// * `chunk_size` - Size of each chunk in bytes
    /// * `tick_ms` - Milliseconds between each chunk emission
    /// 
    /// # Returns
    /// A stream that yields chunks of the encoded message
    fn simulate_network_chunks(
        encoded: Vec<u8>,
        chunk_size: usize,
        tick_ms: u64,
    ) -> Pin<Box<dyn Stream<Item = Vec<u8>> + Send>>;

    /// Get a reference to the HuffmanGenerator
    /// 
    /// # Returns
    /// A reference to the HuffmanGenerator used for encoding
    fn get_huffman() -> HuffmanGenerator;

    /// HTTP handler implementation for testing if the server is up
    fn handle_hello() -> (StatusCode, &'static str) {
        (StatusCode::OK, "Server is up and running!")
    }

    /// Handle the WebSocket connection - processes messages and streams back encoded chunks
    /// This is the core business logic that can be customized by trait implementors
    fn handle_socket(socket: WebSocket) -> Pin<Box<dyn Future<Output = ()> + Send>> {
        Box::pin(async move {
            let (mut sender, mut receiver) = socket.split();

            // 1) Read the first WS message as the "request body"
            let first = match receiver.next().await {
                Some(Ok(msg)) => msg,
                _ => return, // disconnected or error
            };

            // Accept either Text(JSON) or Binary(JSON)
            let bytes = match first {
                Message::Text(s) => s.into_bytes(),
                Message::Binary(b) => b,
                Message::Close(_) => return,
                // You can ignore ping/pong or continue reading until Text/Binary
                _ => return,
            };

            let payload: ChatRequest = match serde_json::from_slice(&bytes) {
                Ok(p) => p,
                Err(e) => {
                    let _ = sender
                        .send(Message::Text(format!("Invalid JSON ChatRequest: {e}")))
                        .await;
                    let _ = sender.close().await;
                    return;
                }
            };

            let message = payload.message;

            // 2) Encode
            let huffman = Self::get_huffman();
            let tokens: Vec<&str> = message.split_whitespace().collect();

            let mut all_encoded: Vec<u8> = Vec::new();
            for token in tokens {
                match huffman.encode(token) {
                    Ok(encoded_symbols) => {
                        // Assuming encode() returns Vec<u8> (or something extendable into bytes)
                        all_encoded.extend(encoded_symbols);
                    }
                    Err(e) => {
                        let _ = sender
                            .send(Message::Text(format!("Error encoding token '{token}': {e}")))
                            .await;
                        let _ = sender.close().await;
                        return;
                    }
                }
            }

            // 3) Stream chunks back as *binary*, not debug strings
            let chunk_size = 4;
            let tick_ms = 100;
            let mut stream = Self::simulate_network_chunks(all_encoded, chunk_size, tick_ms);

            while let Some(chunk) = stream.next().await {
                if sender.send(Message::Binary(chunk)).await.is_err() {
                    break; // client disconnected
                }
            }

            let _ = sender.send(Message::Text("Stream complete".to_string())).await;
            let _ = sender.close().await;
        })
    }


    /// WebSocket chat handler for the /chat route
    async fn chat_handler(ws: WebSocketUpgrade) -> axum::response::Response {
        ws.on_upgrade(|socket| Self::handle_socket(socket))
    }


    /// HTTP handler for the /hello route
    async fn hello_handler() -> impl IntoResponse {
        Self::handle_hello()
    }
}

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