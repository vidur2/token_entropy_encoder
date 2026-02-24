use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    http::StatusCode,
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt, stream::Stream};
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use std::{future::Future, time::Duration};

use crate::huffman::generator::HuffmanGenerator;
use crate::token_compressor::TokenCompressor;
use tokio::sync::Mutex;

/// Request body for the /chat endpoint
#[derive(Debug, Deserialize, Serialize)]
pub struct ChatRequest {
    pub token_ids: Vec<u32>,
}
/*
TODO:
Create a max window size for huffman ws connection, flushing it when it gets to that
Create a timeout on waiting for tokens, flushing the window when it gets to that

*/

/// Trait that generalizes over an axum async websocket server with Huffman encoding capabilities
pub trait HuffmanServer<'a, const MAX_WINDOW_SIZE_TOKENS: u8, const FLUSH_TIMEOUT_MS: u64>:
    Send + Sync + Sized
{
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
        encoded: Vec<u32>,
        chunk_size: usize,
        tick_ms: u64,
    ) -> Pin<Box<dyn Stream<Item = u32> + Send>>;

    /// Get a reference to the HuffmanGenerator
    ///
    /// # Returns
    /// A reference to the HuffmanGenerator used for encoding
    fn get_huffman() -> &'a HuffmanGenerator;

    /// HTTP handler implementation for testing if the server is up
    fn handle_hello() -> (StatusCode, &'static str) {
        (StatusCode::OK, "Server is up and running!")
    }

    fn flush_and_send(
        sender: &mut (impl futures::Sink<Message, Error = axum::Error> + Unpin + Send),
        collected_chunks: &tokio::sync::Mutex<Vec<u32>>,
        huffman: &HuffmanGenerator, // your type
    ) -> impl std::future::Future<Output = Result<(), axum::Error>> + Send {
        async move {
            // take chunks out quickly (unlock ASAP)
            let chunks: Vec<u32> = {
                let mut guard = collected_chunks.lock().await;
                if guard.is_empty() {
                    return Ok(());
                }
                std::mem::take(&mut *guard)
            };

            // encode without holding lock
            let encoded = if huffman.alphabet_size() == 2 {
                huffman.encode_bulk_packed(chunks.as_slice())
            } else {
                huffman.encode_bulk(chunks.as_slice())
            }
            .unwrap(); // ideally propagate instead of unwrap
            println!("{:?}", encoded);
            sender.send(Message::Binary(encoded)).await
        }
    }

    fn run_loop<S>(
        mut sender: &mut (dyn futures::Sink<Message, Error = axum::Error> + Send + Unpin),
        mut stream: S,
        collected_chunks: tokio::sync::Mutex<Vec<u32>>,
        huffman: &HuffmanGenerator,
    ) -> impl std::future::Future<Output = Result<(), axum::Error>> + Send
    where
        S: futures::Stream<Item = u32> + Unpin + Send,
    {
        async move {
            let flush_dur = Duration::from_millis(FLUSH_TIMEOUT_MS);

            let timer = tokio::time::sleep(flush_dur);
            tokio::pin!(timer);

            loop {
                tokio::select! {
                    // incoming chunk
                    maybe = stream.next() => {
                        match maybe {
                            Some(chunk) => {
                                let should_flush = {
                                    let mut guard = collected_chunks.lock().await;
                                    guard.push(chunk);
                                    guard.len() >= MAX_WINDOW_SIZE_TOKENS as usize
                                };

                                if should_flush {
                                    Self::flush_and_send(&mut sender, &collected_chunks, &huffman).await?;
                                    timer.as_mut().reset(tokio::time::Instant::now() + flush_dur);
                                }
                            }
                            None => {
                                // stream ended; final flush
                                Self::flush_and_send(&mut sender, &collected_chunks, &huffman).await?;
                                break;
                            }
                        }
                    }

                    // timeout flush
                    _ = &mut timer => {
                        Self::flush_and_send(&mut sender, &collected_chunks, &huffman).await?;
                        timer.as_mut().reset(tokio::time::Instant::now() + flush_dur); // rerun timeout
                    }
                }
            }

            Ok(())
        }
    }

    /// Handle the WebSocket connection - processes messages and streams back encoded chunks
    /// This is the core business logic that can be customized by trait implementors
    fn handle_socket(socket: WebSocket) -> Pin<Box<dyn Future<Output = ()> + Send>> {
        Box::pin(async move {
            let (mut sender, mut receiver) = socket.split();
            let huffman = Self::get_huffman();

            // Keep processing messages until the client closes the connection
            loop {
                // 1) Read the next WS message as the "request body"
                let msg = match receiver.next().await {
                    Some(Ok(msg)) => msg,
                    _ => {
                        // Connection closed or error
                        println!("Client disconnected");
                        return;
                    }
                };

                // Accept either Text(JSON) or Binary(JSON)
                let bytes = match msg {
                    Message::Text(s) => s.into_bytes(),
                    Message::Binary(b) => b,
                    Message::Close(_) => {
                        println!("Client sent close message");
                        let _ = sender.close().await;
                        return;
                    }
                    Message::Ping(_) | Message::Pong(_) => continue,
                };

                let payload: ChatRequest = match serde_json::from_slice(&bytes) {
                    Ok(p) => p,
                    Err(e) => {
                        let _ = sender
                            .send(Message::Text(format!("Invalid JSON ChatRequest: {e}")))
                            .await;
                        // Don't close, just continue to next message
                        continue;
                    }
                };

                let token_ids = payload.token_ids;
                println!("Processing {} tokens", token_ids.len());

                // 2) Stream chunks back as *binary*
                let chunk_size = 4;
                let tick_ms = 10;
                let stream = Self::simulate_network_chunks(token_ids, chunk_size, tick_ms);

                let collected_chunks: Mutex<Vec<u32>> = Mutex::new(Vec::new());
                if let Err(e) = Self::run_loop(&mut sender, stream, collected_chunks, huffman).await {
                    println!("Error in run_loop: {}", e);
                    let _ = sender.close().await;
                    return;
                }
                
                println!("Finished processing request, waiting for next message...");
            }
        })
    }

    /// WebSocket chat handler for the /chat route
    fn chat_handler(
        ws: WebSocketUpgrade,
    ) -> impl std::future::Future<Output = axum::response::Response> + Send {
        async { ws.on_upgrade(|socket| Self::handle_socket(socket)) }
    }

    /// HTTP handler for the /hello route
    fn hello_handler() -> impl std::future::Future<Output = impl IntoResponse> + Send {
        async { Self::handle_hello() }
    }
}
