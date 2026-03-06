/**
 * Mock Proxy Server for Testing
 * 
 * Simulates the Huffman proxy server for testing the HuffmanClient
 */

import WebSocket from 'ws';
import * as http from 'http';

// Import WASM encoder/decoder for testing
const { encode_bulk, decode_ids } = require('../../../pkg/token_entropy_encoder.js');

export interface MockServerConfig {
  port: number;
  simulateDelay?: number;
  simulateErrors?: boolean;
}

export class MockProxyServer {
  private server: http.Server;
  private wss: WebSocket.Server;
  private config: MockServerConfig;
  private isRunning = false;

  constructor(config: MockServerConfig) {
    this.config = config;
    this.server = http.createServer((req, res) => this.handleHTTPRequest(req, res));
    this.wss = new WebSocket.Server({ server: this.server });
    this.setupHandlers();
  }

  private setupHandlers() {
    this.wss.on('connection', (ws) => {
      console.log('Mock server: Client connected');

      ws.on('message', async (message) => {
        try {
          const request = JSON.parse(message.toString());
          console.log('Mock server: Received request:', request.prompt?.substring(0, 50));

          await this.handleRequest(ws, request);
        } catch (error) {
          console.error('Mock server: Error handling message:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: 'Invalid request' 
          }));
        }
      });

      ws.on('close', () => {
        console.log('Mock server: Client disconnected');
      });
    });
  }

  private handleHTTPRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // Handle SSE endpoint
    if (req.url === '/sse-json' && req.method === 'POST') {
      this.handleSSERequest(req, res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  private async handleSSERequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // Parse request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const request = JSON.parse(body) as any;
        const { prompt, simulateError, tokenCount = 100 } = request;

        console.log('Mock server (SSE): Received request:', prompt?.substring(0, 50));

        // Set SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        if (this.config.simulateErrors || simulateError) {
          // Send error
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Simulated server error' })}\n\n`);
          res.end();
          return;
        }

        // Generate mock token IDs
        const tokens = this.generateMockTokens(tokenCount);

        // Convert tokens to text on SERVER (realistic SSE scenario)
        // This is the key difference: SSE decodes tokens server-side
        const chunkSize = 50;
        for (let i = 0; i < tokens.length; i += chunkSize) {
          const chunk = tokens.slice(i, i + chunkSize);
          
          // Decode tokens to text SERVER-SIDE
          const text = decode_ids(new Uint32Array(chunk));
          
          // Simulate delay if configured
          if (this.config.simulateDelay) {
            await this.sleep(this.config.simulateDelay);
          }
          
          // Send JSON text data via SSE
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }

        // Send completion
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (error) {
        console.error('Mock server (SSE): Error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Server error' })}\n\n`);
        res.end();
      }
    });
  }

  private async handleRequest(ws: WebSocket, request: any) {
    const { prompt, simulateError, tokenCount = 100 } = request as any;

    if (this.config.simulateErrors || simulateError) {
      // Simulate server error
      ws.send(JSON.stringify({ 
        type: 'error', 
        error: 'Simulated server error' 
      }));
      return;
    }

    // Generate mock token IDs
    const tokens = this.generateMockTokens(tokenCount);

    // Send in chunks
    const chunkSize = 50;
    for (let i = 0; i < tokens.length; i += chunkSize) {
      const chunk = tokens.slice(i, i + chunkSize);
      
      // Encode with Huffman
      const encoded = encode_bulk(new Uint32Array(chunk));
      
      // Simulate delay if configured
      if (this.config.simulateDelay) {
        await this.sleep(this.config.simulateDelay);
      }
      
      // Send binary data
      ws.send(encoded, { binary: true });
    }

    // Send completion
    ws.send(JSON.stringify({ type: 'done' }));
  }

  private generateMockTokens(count: number): number[] {
    // Generate realistic token distribution
    // Use smaller token IDs that are more likely to be in the Huffman encoding map
    const tokens: number[] = [];
    for (let i = 0; i < count; i++) {
      // Common tokens (0-5000) with higher probability
      if (Math.random() < 0.8) {
        tokens.push(Math.floor(Math.random() * 5000));
      } else {
        // Less common tokens (5000-10000)
        tokens.push(5000 + Math.floor(Math.random() * 5000));
      }
    }
    return tokens;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, () => {
        this.isRunning = true;
        console.log(`Mock proxy server running on port ${this.config.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      // Close all connections
      this.wss.clients.forEach(client => {
        client.close();
      });

      this.wss.close(() => {
        this.server.close(() => {
          this.isRunning = false;
          console.log('Mock proxy server stopped');
          resolve();
        });
      });
    });
  }

  get running(): boolean {
    return this.isRunning;
  }
}
