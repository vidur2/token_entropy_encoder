/**
 * Huffman Proxy Server
 * 
 * Middleware that sits between VS Code extension and local LLM server.
 * - Receives prompts via WebSocket from VS Code
 * - Forwards to local LLM server
 * - Streams token IDs from LLM
 * - Huffman-encodes tokens
 * - Streams compressed data back to VS Code
 */

const WebSocket = require('ws');
const http = require('http');

// Import WASM Huffman encoder
const { encode_bulk } = require('../pkg/token_entropy_encoder.js');

// Configuration
const CONFIG = {
  proxyPort: 3002,
  llmEndpoint: process.env.LLM_ENDPOINT || 'http://localhost:8000/v1/chat/completions',
  llmApiKey: process.env.LLM_API_KEY || '',
  model: process.env.LLM_MODEL || 'gpt-3.5-turbo', // or 'llama-2-7b', etc.
};

console.log('🚀 Huffman Proxy Server Configuration:');
console.log(`   Proxy Port: ${CONFIG.proxyPort}`);
console.log(`   LLM Endpoint: ${CONFIG.llmEndpoint}`);
console.log(`   Model: ${CONFIG.model}`);

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', config: CONFIG }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('✅ VS Code extension connected');

  ws.on('message', async (message) => {
    try {
      const request = JSON.parse(message);
      console.log(`📨 Received request: ${request.prompt?.substring(0, 50)}...`);

      await handleLLMRequest(ws, request);
    } catch (error) {
      console.error('❌ Error processing message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        error: error?.message || 'Unknown error' 
      }));
    }
  });

  ws.on('close', () => {
    console.log('👋 VS Code extension disconnected');
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

/**
 * Handle LLM request and stream Huffman-encoded tokens back
 */
async function handleLLMRequest(ws, request) {
  const { prompt, systemPrompt, temperature = 0.7, maxTokens = 2048 } = request;

  // Build messages array
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  // Prepare LLM request
  const llmRequest = {
    model: CONFIG.model,
    messages: messages,
    temperature: temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  console.log(`🔄 Forwarding to LLM: ${CONFIG.llmEndpoint}`);

  try {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(CONFIG.llmEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': CONFIG.llmApiKey ? `Bearer ${CONFIG.llmApiKey}` : '',
      },
      body: JSON.stringify(llmRequest),
    });

    if (!response.ok) {
      throw new Error(`LLM server error: ${response.status} ${response.statusText}`);
    }

    // Track token IDs as they stream in
    let tokenBuffer = [];
    const CHUNK_SIZE = 50; // Send chunks of 50 tokens

    // Parse SSE stream from LLM
    const reader = response.body;
    let buffer = '';

    reader.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            // Flush remaining tokens
            if (tokenBuffer.length > 0) {
              sendHuffmanChunk(ws, tokenBuffer);
              tokenBuffer = [];
            }
            ws.send(JSON.stringify({ type: 'done' }));
            console.log('✅ Stream complete');
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              // In a real implementation, you'd need to tokenize this content
              // For now, we'll simulate by converting to token IDs
              const tokenIds = simulateTokenization(content);
              tokenBuffer.push(...tokenIds);

              // Send chunks periodically
              if (tokenBuffer.length >= CHUNK_SIZE) {
                const toSend = tokenBuffer.splice(0, CHUNK_SIZE);
                sendHuffmanChunk(ws, toSend);
              }
            }
          } catch (e) {
            // Ignore JSON parse errors for incomplete chunks
          }
        }
      }
    });

    reader.on('end', () => {
      if (tokenBuffer.length > 0) {
        sendHuffmanChunk(ws, tokenBuffer);
      }
      ws.send(JSON.stringify({ type: 'done' }));
      console.log('✅ Stream complete');
    });

    reader.on('error', (error) => {
      console.error('❌ Stream error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        error: error?.message || 'Stream error' 
      }));
    });

  } catch (error) {
    console.error('❌ LLM request failed:', error);
    ws.send(JSON.stringify({ 
      type: 'error', 
      error: error?.message || 'LLM request failed' 
    }));
  }
}

/**
 * Send Huffman-encoded token chunk to VS Code
 */
function sendHuffmanChunk(ws, tokenIds) {
  try {
    // Encode tokens using Huffman compression
    const encoded = encode_bulk(new Uint32Array(tokenIds));
    
    // Send as binary data
    ws.send(encoded, { binary: true });
    
    console.log(`📤 Sent ${tokenIds.length} tokens (${encoded.length} bytes compressed)`);
  } catch (error) {
    console.error('❌ Encoding error:', error);
    ws.send(JSON.stringify({ 
      type: 'error', 
      error: 'Failed to encode tokens' 
    }));
  }
}

/**
 * Simulate tokenization (temporary - replace with actual tokenizer)
 * 
 * In production, you'd use the same tokenizer as your LLM:
 * - tiktoken for GPT models
 * - sentencepiece for Llama models
 * - etc.
 */
function simulateTokenization(text) {
  // Very naive simulation: map each character to a token ID
  // This is just for demonstration - use proper tokenizer in production
  const tokens = [];
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Map to token range 0-50000
    tokens.push(charCode % 50000);
  }
  return tokens;
}

// Start server
server.listen(CONFIG.proxyPort, () => {
  console.log(`\n🎯 Huffman Proxy Server running on ws://localhost:${CONFIG.proxyPort}`);
  console.log(`📡 Ready to forward requests to ${CONFIG.llmEndpoint}`);
  console.log('\n💡 Usage:');
  console.log('   1. Start your local LLM server');
  console.log('   2. Set LLM_ENDPOINT environment variable if needed');
  console.log('   3. Connect VS Code extension to this proxy');
  console.log('\n🔧 Environment variables:');
  console.log('   LLM_ENDPOINT - LLM server URL (default: http://localhost:8000/v1/chat/completions)');
  console.log('   LLM_API_KEY - Optional API key');
  console.log('   LLM_MODEL - Model name (default: gpt-3.5-turbo)');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down proxy server...');
  server.close();
  process.exit(0);
});
