#!/usr/bin/env node

const http = require('http');
const WebSocket = require('ws');
const { encode } = require('../pkg/token_entropy_encoder.js');

const PORT = 3000;
const CHUNK_SIZE = 256; // Size of each chunk to send

// Create HTTP server for health check
const server = http.createServer((req, res) => {
    if (req.url === '/hello') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Server is running!');
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ 
    server,
    path: '/chat'
});

console.log('=== Token Entropy Encoder WebSocket Server ===\n');
console.log(`HTTP server listening on http://127.0.0.1:${PORT}`);
console.log(`WebSocket server listening on ws://127.0.0.1:${PORT}/chat`);
console.log('\nWaiting for connections...\n');

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    ws.on('message', (data) => {
        try {
            // Parse the incoming JSON message
            const request = JSON.parse(data.toString());
            const tokenIds = request.token_ids || [];
            
            console.log(`Received token IDs: [${tokenIds.join(', ')}]`);
            
            // For now, encode just the first token ID (matching Rust server behavior)
            const tokenIdToEncode = tokenIds[0] || 0;
            console.log(`Encoding token ID: ${tokenIdToEncode}`);
            
            // Encode the token ID using WASM
            const encoded = encode(tokenIdToEncode);
            console.log(`Encoded to ${encoded.length} bytes`);
            
            // Stream the encoded data in chunks
            let offset = 0;
            let chunkNum = 1;
            
            while (offset < encoded.length) {
                const end = Math.min(offset + CHUNK_SIZE, encoded.length);
                const chunk = encoded.slice(offset, end);
                
                // Send as binary data
                ws.send(chunk, { binary: true });
                console.log(`Sent chunk ${chunkNum}: ${chunk.length} bytes`);
                
                offset = end;
                chunkNum++;
            }
            
            // Send completion message
            ws.send('Stream complete');
            console.log('Stream complete\n');
            ws.close();
            
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                error: error.message
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected\n');
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Start the server
server.listen(PORT, '127.0.0.1', () => {
    console.log('Server started successfully!\n');
});
