/**
 * Huffman WebSocket Client
 * 
 * Connects to the Huffman proxy server and handles:
 * - WebSocket communication
 * - WASM Huffman decoding
 * - Streaming text callbacks
 */

const WebSocket = require('ws');
const path = require('path');

class HuffmanClient {
  constructor(proxyUrl) {
    this.proxyUrl = proxyUrl;
    this.ws = null;
    this.decoder = null;
    this.isReady = false;
  }

  /**
   * Initialize the WASM decoder
   */
  async initialize() {
    if (this.decoder) {
      return; // Already initialized
    }

    try {
      // Load WASM module from pkg directory
      const wasmPath = path.join(__dirname, '../pkg/token_entropy_encoder.js');
      this.decoder = require(wasmPath);
      console.log('✅ WASM decoder initialized');
    } catch (error) {
      console.error('❌ Failed to load WASM decoder:', error);
      throw new Error(`Failed to load WASM decoder: ${error}`);
    }
  }

  /**
   * Connect to the proxy server
   */
  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.proxyUrl);

        this.ws.on('open', () => {
          console.log('✅ Connected to Huffman proxy');
          this.isReady = true;
          resolve();
        });

        this.ws.on('error', (error) => {
          console.error('❌ WebSocket error:', error);
          this.isReady = false;
          reject(error);
        });

        this.ws.on('close', () => {
          console.log('👋 Disconnected from proxy');
          this.isReady = false;
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate completion from LLM
   */
  async generate(request, callbacks) {
    if (!this.isReady || !this.ws) {
      throw new Error('Client not connected. Call connect() first.');
    }

    if (!this.decoder) {
      throw new Error('Decoder not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      // Message handler for this generation
      const messageHandler = (data) => {
        try {
          // Convert to Buffer for consistent handling
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
          
          // Check if it's JSON or binary by inspecting first byte
          // JSON messages start with '{' (0x7b) or '[' (0x5b)
          const firstByte = buffer[0];
          const isJSON = firstByte === 0x7b || firstByte === 0x5b;
          
          if (isJSON) {
            // JSON control message
            const message = JSON.parse(buffer.toString());
            
            if (message.type === 'done') {
              // Stream complete
              if (callbacks.onComplete) {
                callbacks.onComplete();
              }
              this.ws.off('message', messageHandler);
              resolve();
            } else if (message.type === 'error') {
              // Error from server
              const error = new Error(message.error || 'Unknown error');
              if (callbacks.onError) {
                callbacks.onError(error);
              }
              this.ws.off('message', messageHandler);
              reject(error);
            }
          } else {
            // Huffman-encoded binary tokens
            const decoded = this.decoder.decode_bulk(new Uint8Array(buffer));
            // Ensure it's a string
            const text = String(decoded);
            
            if (callbacks.onToken) {
              callbacks.onToken(text);
            }
          }
        } catch (error) {
          console.error('❌ Error processing message:', error);
          const err = error instanceof Error ? error : new Error(String(error));
          if (callbacks.onError) {
            callbacks.onError(err);
          }
          this.ws.off('message', messageHandler);
          reject(err);
        }
      };

      // Error handler
      const errorHandler = (error) => {
        if (callbacks.onError) {
          callbacks.onError(error);
        }
        this.ws.off('message', messageHandler);
        this.ws.off('error', errorHandler);
        reject(error);
      };

      // Attach handlers
      this.ws.on('message', messageHandler);
      this.ws.on('error', errorHandler);

      // Send request
      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * Disconnect from proxy
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isReady = false;
    }
  }

  /**
   * Check if client is ready
   */
  get ready() {
    return this.isReady;
  }
}

module.exports = { HuffmanClient };
