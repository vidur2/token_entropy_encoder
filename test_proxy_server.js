#!/usr/bin/env node

/**
 * Mock Huffman Proxy Server for Testing VS Code Extension
 * 
 * This simulates a Huffman proxy that streams token IDs back to the client.
 * Since real LLM APIs don't expose token IDs, this is for testing purposes.
 */

const WebSocket = require('ws');
const http = require('http');

// Import WASM encoder
const { encode_bulk, decode_ids } = require('./pkg/token_entropy_encoder.js');

const PORT = 3003;

// Sample token sequences for different types of responses
const SAMPLE_RESPONSES = {
  'code': [
    // "function hello() {\n  console.log('Hello, World!');\n}\n"
    1644, 22172, 580, 341, 29871, 13, 29871, 29871, 3591, 29889, 1188, 877, 10994, 29892, 2787, 29991, 2157, 13, 29913, 13
  ],
  'explanation': [
    // "This code defines a simple function that prints a greeting message."
    4013, 775, 17645, 263, 2560, 740, 393, 14010, 263, 1395, 15133, 2643, 29889
  ],
  'default': [
    // "Here is a response to your prompt. This is simulated streaming output."
    8439, 338, 263, 2933, 304, 596, 9508, 29889, 910, 338, 1027, 7964, 24820, 1962, 29889
  ]
};

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('✅ Client connected');

  ws.on('message', async (message) => {
    try {
      const request = JSON.parse(message.toString());
      console.log(`📨 Request: "${request.prompt.substring(0, 60)}..."`);

      // Determine response type based on prompt
      let tokenSeq;
      if (request.prompt.toLowerCase().includes('code') || request.prompt.toLowerCase().includes('function')) {
        tokenSeq = SAMPLE_RESPONSES.code;
      } else if (request.prompt.toLowerCase().includes('explain') || request.prompt.toLowerCase().includes('what')) {
        tokenSeq = SAMPLE_RESPONSES.explanation;
      } else {
        tokenSeq = SAMPLE_RESPONSES.default;
      }

      // Send tokens in small chunks to simulate streaming
      const chunkSize = 3;
      for (let i = 0; i < tokenSeq.length; i += chunkSize) {
        const chunk = tokenSeq.slice(i, Math.min(i + chunkSize, tokenSeq.length));
        
        try {
          // Encode the token IDs using Huffman
          const encoded = encode_bulk(new Uint32Array(chunk));
          
          // Send as binary data
          ws.send(encoded, { binary: true });
          
          // Small delay to simulate network latency
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (encodeError) {
          console.error('❌ Encoding error:', encodeError);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Encoding failed'
          }));
          return;
        }
      }

      // Send completion signal
      ws.send(JSON.stringify({ type: 'done' }));
      console.log('✅ Request completed');

    } catch (error) {
      console.error('❌ Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('👋 Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// Start server
server.listen(PORT, () => {
  console.log('');
  console.log('🚀 Mock Huffman Proxy Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ WebSocket server: ws://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('📝 This is a MOCK server for testing.');
  console.log('   It simulates Huffman-compressed token streaming.');
  console.log('');
  console.log('🔌 Ready for VS Code extension connections...');
  console.log('');
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
