use axum::{
    Router,
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
};
use futures::{SinkExt, StreamExt, stream::Stream};
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::pin::Pin;

use crate::huffman::generator::HuffmanGenerator;

/// Request body for the /chat endpoint
#[derive(Debug, Deserialize, Serialize)]
pub struct ChatRequest {
    pub message: String,
}

/// Trait that generalizes over an axum async websocket server with Huffman encoding capabilities
pub trait HuffmanServer<'a>: Send + Sync + Sized {
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
    fn get_huffman() -> &'a HuffmanGenerator;

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

            // 2) Encode the first token (for m=2, this packs bits into bytes)
            let huffman = Self::get_huffman();
            let tokens: Vec<&str> = message.split_whitespace().collect();

            // For now, just encode the first token as a test
            // TODO: Implement proper multi-token encoding with delimiters or separate messages
            let token_to_encode = tokens.first().unwrap_or(&"test");
            
            let encoded_packed = if huffman.alphabet_size() == 2 {
                // Use packed encoding for binary alphabet
                match huffman.encode_packed(token_to_encode) {
                    Ok(packed) => {
                        println!("Encoded token '{}' to {} packed bytes", token_to_encode, packed.len());
                        packed
                    }
                    Err(e) => {
                        let _ = sender
                            .send(Message::Text(format!(
                                "Error encoding token '{token_to_encode}': {e}"
                            )))
                            .await;
                        let _ = sender.close().await;
                        return;
                    }
                }
            } else {
                // Use regular encoding for non-binary alphabets
                match huffman.encode(token_to_encode) {
                    Ok(symbols) => {
                        println!("Encoded token '{}' to {} symbols", token_to_encode, symbols.len());
                        symbols
                    }
                    Err(e) => {
                        let _ = sender
                            .send(Message::Text(format!(
                                "Error encoding token '{token_to_encode}': {e}"
                            )))
                            .await;
                        let _ = sender.close().await;
                        return;
                    }
                }
            };

            // 3) Stream chunks back as *binary*
            let chunk_size = 4;
            let tick_ms = 100;
            let mut stream = Self::simulate_network_chunks(encoded_packed, chunk_size, tick_ms);

            while let Some(chunk) = stream.next().await {
                if sender.send(Message::Binary(chunk)).await.is_err() {
                    break; // client disconnected
                }
            }

            let _ = sender
                .send(Message::Text("Stream complete".to_string()))
                .await;
            let _ = sender.close().await;
        })
    }

    /// WebSocket chat handler for the /chat route
    fn chat_handler(ws: WebSocketUpgrade) -> impl std::future::Future<Output = axum::response::Response> + Send {async {
        ws.on_upgrade(|socket| Self::handle_socket(socket))
    } }

    /// HTTP handler for the /hello route
    fn hello_handler() -> impl std::future::Future<Output = impl IntoResponse> + Send {async {
        Self::handle_hello()
    } }
}
