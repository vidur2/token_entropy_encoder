#!/usr/bin/env node

const WebSocket = require('ws');
const { decode_bulk } = require('../pkg/token_entropy_encoder.js');

const SERVER_URL = 'ws://127.0.0.1:3000/chat';

async function testWebSocketChat() {
    console.log('=== WebSocket Chat Client ===\n');
    console.log('Connecting to server:', SERVER_URL);

    const ws = new WebSocket(SERVER_URL);

    // Track requests and responses
    let currentRequest = 0;
    let requestTokens = [];
    let allDecodedTokens = [];
    let messageCount = 0;

    // Define multiple requests to send
    const requests = [
        [0, 1, 2, 3, 10, 50, 100, 200, 300, 400, 500],
        [1000, 1001, 1002, 1003, 1004],
        [5, 15, 25, 35, 45, 55, 65, 75, 85, 95],
    ];

    function sendNextRequest() {
        if (currentRequest >= requests.length) {
            console.log('\n=== All requests sent, closing connection ===');
            ws.close();
            return;
        }

        const tokenIds = requests[currentRequest];
        requestTokens = [...tokenIds]; // Save for verification
        
        const request = {
            token_ids: tokenIds
        };

        console.log(`\n[Request ${currentRequest + 1}] Sending token IDs:`, tokenIds);
        console.log(`  Total tokens to send: ${tokenIds.length}`);
        ws.send(JSON.stringify(request));
        console.log('  Waiting for encoded response chunks...\n');
        
        currentRequest++;
    }

    ws.on('open', () => {
        console.log('Connected to server!\n');
        sendNextRequest(); // Send first request
    });

    ws.on('message', (data) => {
        if (data instanceof Buffer) {
            // Binary message - this is a complete encoded packet from a flush
            messageCount++;
            console.log(`[Message ${messageCount}] Received encoded packet: ${data.length} bytes`);
            
            try {
                // Each binary message is a complete encoded packet with header
                // We can decode it immediately
                const buffer = new Uint8Array(data);
                const decoded = decode_bulk(buffer);
                
                console.log(`  Decoded ${decoded.length} tokens:`, decoded);
                
                // Accumulate decoded tokens
                allDecodedTokens.push(...decoded);
                
                // Check if we've received all tokens for current request
                if (allDecodedTokens.length >= requestTokens.length) {
                    console.log(`\n✓ Request complete! Decoded all ${allDecodedTokens.length} tokens`);
                    allDecodedTokens = []; // Reset for next request
                    
                    // Small delay before sending next request
                    setTimeout(() => sendNextRequest(), 100);
                }
                
            } catch (error) {
                console.error('  Decode error:', error.message);
            }
        } else {
            // Text message (for errors or status updates)
            const text = data.toString();
            console.log('\nServer message:', text);
        }
    });

    ws.on('error', (error) => {
        console.error('\nWebSocket error:', error.message);
    });

    ws.on('close', () => {
        console.log('\n--- Connection Closed ---');
        console.log(`Total requests sent: ${currentRequest}`);
        console.log(`Total messages received: ${messageCount}`);
        console.log('\nDone!');
    });
}

// Check if server is running first
const http = require('http');
http.get('http://127.0.0.1:3000/hello', (res) => {
    if (res.statusCode === 200) {
        console.log('Server is running!\n');
        testWebSocketChat().catch(console.error);
    }
}).on('error', (error) => {
    console.error('Error: Server is not running!');
    console.error('Please start the server first with: cargo run --bin server');
    process.exit(1);
});
