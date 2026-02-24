#!/usr/bin/env node

const http = require('http');
const WebSocket = require('ws');
const { encode_bulk } = require('../pkg/token_entropy_encoder.js');

const PORT = 3000;

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
            
            console.log(`Received ${tokenIds.length} token IDs: [${tokenIds.join(', ')}]`);
            
            if (tokenIds.length === 0) {
                console.log('No token IDs to encode');
                ws.close();
                return;
            }
            
            // Encode all token IDs in bulk
            console.log(`Encoding ${tokenIds.length} tokens in bulk...`);
            const encoded = encode_bulk(tokenIds);
            console.log(`Encoded to ${encoded.length} bytes (including header)`);
            
            // Send the complete encoded packet as a single binary message
            ws.send(encoded, { binary: true });
            console.log(`Sent encoded packet: ${encoded.length} bytes\n`);
            
            // Close the connection (client knows stream is done when connection closes)
            ws.close();
            
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                error: error.message
            }));
            ws.close();
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
