#!/usr/bin/env node

const WebSocket = require('ws');
const { decode } = require('../pkg/token_entropy_encoder.js');

const SERVER_URL = 'ws://127.0.0.1:3000/chat';

async function testWebSocketChat() {
    console.log('=== WebSocket Chat Client ===\n');
    console.log('Connecting to server:', SERVER_URL);

    const ws = new WebSocket(SERVER_URL);

    // Accumulate all chunks
    let allChunks = [];
    let receivedComplete = false;

    ws.on('open', () => {
        console.log('Connected to server!\n');

        // Send a chat message
        const message = 'Hello world from the client';
        const request = {
            message: message
        };

        console.log('Sending message:', message);
        ws.send(JSON.stringify(request));
        console.log('Waiting for encoded response chunks...\n');
    });

    ws.on('message', (data) => {
        if (data instanceof Buffer) {
            // Binary message - this is an encoded chunk
            console.log(`Received chunk: ${data.length} bytes`);
            allChunks.push(...Array.from(data));
        } else {
            // Text message
            const text = data.toString();
            console.log('Server message:', text);
            
            if (text === 'Stream complete') {
                receivedComplete = true;
                
                // Decode all accumulated chunks
                console.log('\n--- Decoding ---');
                console.log('Total encoded bytes received:', allChunks.length);
                
                try {
                    const buffer = new Uint8Array(allChunks);
                    const decoded = decode(buffer);
                    console.log('Decoded result:', decoded);
                } catch (error) {
                    console.error('Decode error:', error.message);
                }
                
                ws.close();
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
        if (!receivedComplete) {
            console.log('\nConnection closed before "Stream complete" message');
            console.log('Attempting to decode anyway...\n');
            console.log('--- Decoding ---');
            console.log('Total bytes received:', allChunks.length);
            
            try {
                const buffer = new Uint8Array(allChunks);
                const decoded = decode(buffer);
                console.log('Decoded result:', decoded);
            } catch (error) {
                console.error('Decode error:', error.message);
            }
        } else {
            console.log('\nConnection closed');
        }
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
