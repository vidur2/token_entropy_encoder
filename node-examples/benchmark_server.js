#!/usr/bin/env node

/**
 * Benchmark Server: WS+Huffman vs SSE+JSON
 * 
 * Endpoints:
 * - ws://localhost:3001/ws-huffman - WebSocket with Huffman encoding
 * - http://localhost:3001/sse-json - Server-Sent Events with JSON
 * - http://localhost:3001/health - Health check
 */

const http = require('http');
const WebSocket = require('ws');
const { encode_bulk, decode_ids } = require('../pkg/token_entropy_encoder.js');

const PORT = 3001;

// Simulate streaming tokens (like LLM generation)
function* simulateTokenStream(tokens, chunkSize = 1, delayMs = 0) {
    for (let i = 0; i < tokens.length; i += chunkSize) {
        const chunk = tokens.slice(i, Math.min(i + chunkSize, tokens.length));
        yield chunk;
    }
}

// Create HTTP server
const server = http.createServer((req, res) => {
    // Enable CORS for all endpoints
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Benchmark server running');
        return;
    }

    if (req.url.startsWith('/sse-json')) {
        handleSSEJSON(req, res);
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

// Handle SSE+JSON endpoint
function handleSSEJSON(req, res) {
    // Parse query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const tokensParam = url.searchParams.get('tokens');
    const chunkSizeParam = url.searchParams.get('chunkSize') || '1';
    const delayParam = url.searchParams.get('delay') || '0';

    if (!tokensParam) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing tokens parameter');
        return;
    }

    const tokens = JSON.parse(tokensParam);
    const chunkSize = parseInt(chunkSizeParam);
    const delayMs = parseInt(delayParam);

    // Set up SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    console.log(`[SSE-JSON] Starting stream: ${tokens.length} tokens, chunk size: ${chunkSize}, delay: ${delayMs}ms`);

    let totalBytes = 0;
    let chunkCount = 0;

    // Stream tokens as SSE events (decode to text on server like OpenAI API)
    (async () => {
        try {
            for (const chunk of simulateTokenStream(tokens, chunkSize, delayMs)) {
                if (delayMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }

                // REALISTIC: Decode tokens to text on server side
                const textBytes = decode_ids(chunk);
                const text = Buffer.from(textBytes).toString('utf-8');
                
                const data = JSON.stringify({ text });
                const sseMessage = `data: ${data}\n\n`;
                totalBytes += Buffer.byteLength(sseMessage, 'utf8');
                chunkCount++;

                res.write(sseMessage);
            }

            // Send completion event
            const doneMessage = 'event: done\ndata: {}\n\n';
            totalBytes += Buffer.byteLength(doneMessage, 'utf8');
            res.write(doneMessage);
            res.end();

            console.log(`[SSE-JSON] Stream complete: ${chunkCount} chunks, ${totalBytes} bytes total`);
        } catch (error) {
            console.error('[SSE-JSON] Error:', error.message);
            res.end();
        }
    })();

    req.on('close', () => {
        console.log('[SSE-JSON] Client disconnected');
    });
}

// Create WebSocket server
const wss = new WebSocket.Server({ 
    server,
    path: '/ws-huffman'
});

wss.on('connection', (ws) => {
    console.log('[WS-Huffman] Client connected');
    
    ws.on('message', async (data) => {
        try {
            const request = JSON.parse(data.toString());
            const { tokens, chunkSize = 1, delay = 0 } = request;

            if (!tokens || !Array.isArray(tokens)) {
                ws.send(JSON.stringify({ error: 'Invalid tokens' }));
                return;
            }

            console.log(`[WS-Huffman] Starting stream: ${tokens.length} tokens, chunk size: ${chunkSize}, delay: ${delay}ms`);

            let totalBytes = 0;
            let chunkCount = 0;

            // Stream tokens as Huffman-encoded chunks
            for (const chunk of simulateTokenStream(tokens, chunkSize, delay)) {
                if (delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                try {
                    // Encode the chunk with Huffman
                    const encoded = encode_bulk(chunk);
                    totalBytes += encoded.length;
                    chunkCount++;

                    ws.send(encoded, { binary: true });
                } catch (error) {
                    console.error('[WS-Huffman] Encoding error:', error.message);
                    ws.send(JSON.stringify({ error: error.message }));
                    return;
                }
            }

            // Send completion message
            ws.send(JSON.stringify({ 
                done: true, 
                stats: { 
                    chunks: chunkCount, 
                    bytes: totalBytes 
                } 
            }));

            console.log(`[WS-Huffman] Stream complete: ${chunkCount} chunks, ${totalBytes} bytes total`);

        } catch (error) {
            console.error('[WS-Huffman] Error:', error.message);
            ws.send(JSON.stringify({ error: error.message }));
        }
    });
    
    ws.on('close', () => {
        console.log('[WS-Huffman] Client disconnected');
    });
    
    ws.on('error', (error) => {
        console.error('[WS-Huffman] WebSocket error:', error.message);
    });
});

// Start the server
server.listen(PORT, '127.0.0.1', () => {
    console.log('\n=== Benchmark Server: WS+Huffman vs SSE+JSON ===\n');
    console.log(`Server running on http://127.0.0.1:${PORT}`);
    console.log(`WebSocket endpoint: ws://127.0.0.1:${PORT}/ws-huffman`);
    console.log(`SSE endpoint: http://127.0.0.1:${PORT}/sse-json?tokens=[...]`);
    console.log(`Health check: http://127.0.0.1:${PORT}/health`);
    console.log('\nReady for benchmarks!\n');
});

process.on('SIGINT', () => {
    console.log('\n\nShutting down server...');
    server.close();
    process.exit(0);
});
