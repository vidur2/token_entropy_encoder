/**
 * SSE JSON Client
 * 
 * Alternative client using Server-Sent Events + JSON for comparison
 * with the Huffman WebSocket approach
 */

import * as http from 'http';

// Import decode_ids to convert token IDs to text (server-side simulation)
const { decode_ids } = require('../../../pkg/token_entropy_encoder.js');

export interface GenerationRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerationCallbacks {
  onToken?: (text: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export class SSEClient {
  private isReady = false;

  constructor(private serverUrl: string) {}

  /**
   * Initialize the client (for consistency with HuffmanClient API)
   */
  async initialize(): Promise<void> {
    this.isReady = true;
  }

  /**
   * Connect (for consistency with HuffmanClient API)
   */
  async connect(): Promise<void> {
    this.isReady = true;
  }

  /**
   * Generate completion using SSE + JSON
   */
  async generate(
    request: GenerationRequest,
    callbacks: GenerationCallbacks
  ): Promise<void> {
    if (!this.isReady) {
      throw new Error('Client not initialized. Call initialize() and connect() first.');
    }

    return new Promise((resolve, reject) => {
      const url = new URL('/sse-json', this.serverUrl);
      
      // Make HTTP request
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Server error: ${res.statusCode}`));
            return;
          }

          let buffer = '';

          res.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);

                if (data === '[DONE]') {
                  if (callbacks.onComplete) {
                    callbacks.onComplete();
                  }
                  resolve();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);

                  if (parsed.type === 'error') {
                    const error = new Error(parsed.error || 'Unknown error');
                    if (callbacks.onError) {
                      callbacks.onError(error);
                    }
                    reject(error);
                    return;
                  }

                  if (parsed.text && callbacks.onToken) {
                    callbacks.onToken(parsed.text);
                  }
                } catch (e) {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          });

          res.on('end', () => {
            if (callbacks.onComplete) {
              callbacks.onComplete();
            }
            resolve();
          });

          res.on('error', (error) => {
            if (callbacks.onError) {
              callbacks.onError(error);
            }
            reject(error);
          });
        }
      );

      req.on('error', (error) => {
        if (callbacks.onError) {
          callbacks.onError(error);
        }
        reject(error);
      });

      // Send request body
      req.write(JSON.stringify(request));
      req.end();
    });
  }

  /**
   * Disconnect (for consistency with HuffmanClient API)
   */
  disconnect(): void {
    this.isReady = false;
  }

  /**
   * Check if client is ready
   */
  get ready(): boolean {
    return this.isReady;
  }
}
