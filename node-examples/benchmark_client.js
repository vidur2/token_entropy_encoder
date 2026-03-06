#!/usr/bin/env node

/**
 * Benchmark Client: WS+Huffman vs SSE+JSON
 * 
 * Measures and compares:
 * - Total transfer time
 * - First byte time (latency)
 * - Throughput (tokens/sec)
 * - Data size (bytes transferred)
 * - Compression ratio
 */

const WebSocket = require('ws');
const { decode_bulk, decode_ids } = require('../pkg/token_entropy_encoder.js');
const EventSource = require('eventsource');

const SERVER_URL = 'http://127.0.0.1:3001';

// Generate test token sequences
function generateTokens(count, pattern = 'sequential') {
    const tokens = [];
    switch (pattern) {
        case 'sequential':
            for (let i = 0; i < count; i++) {
                tokens.push(i);
            }
            break;
        case 'random':
            for (let i = 0; i < count; i++) {
                tokens.push(Math.floor(Math.random() * 32000));
            }
            break;
        case 'repetitive':
            for (let i = 0; i < count; i++) {
                tokens.push(i % 100); // Repeat 0-99
            }
            break;
        case 'sparse':
            for (let i = 0; i < count; i++) {
                tokens.push(i * 100);
            }
            break;
        default:
            throw new Error(`Unknown pattern: ${pattern}`);
    }
    return tokens;
}

// Benchmark WebSocket + Huffman
async function benchmarkWSHuffman(tokens, chunkSize = 1, delay = 0) {
    return new Promise((resolve, reject) => {
        const metrics = {
            protocol: 'WS+Huffman',
            tokenCount: tokens.length,
            chunkSize,
            delay,
            startTime: Date.now(),
            firstByteTime: null,
            endTime: null,
            totalBytes: 0,
            chunksReceived: 0,
            decodedTokens: [],
            decodedText: '', // Accumulate decoded text
            errors: [],
        };

        let resolved = false;
        const finishBenchmark = () => {
            if (resolved) return;
            resolved = true;
            if (!metrics.endTime) {
                metrics.endTime = Date.now();
            }
            resolve(metrics);
        };

        const ws = new WebSocket(`${SERVER_URL.replace('http', 'ws')}/ws-huffman`);

        ws.on('open', () => {
            const request = { tokens, chunkSize, delay };
            ws.send(JSON.stringify(request));
        });

        ws.on('message', (data) => {
            if (!metrics.firstByteTime) {
                metrics.firstByteTime = Date.now();
            }

            // Check if this is JSON (text message) or binary data
            // JSON messages start with '{' (0x7b) or '[' (0x5b)
            const isJson = data.length > 0 && (data[0] === 0x7b || data[0] === 0x5b);

            if (!isJson && data instanceof Buffer) {
                // Binary data - Huffman encoded
                metrics.totalBytes += data.length;
                metrics.chunksReceived++;

                try {
                    const decoded = decode_bulk(new Uint8Array(data));
                    metrics.decodedTokens.push(...decoded);
                    
                    // Decode to text for fair comparison with SSE
                    const textBytes = decode_ids(decoded);
                    const text = Buffer.from(textBytes).toString('utf-8');
                    metrics.decodedText += text;
                } catch (error) {
                    const errMsg = error?.message || error?.toString() || 'Decode error';
                    metrics.errors.push(errMsg);
                }
            } else {
                // Text data - status or completion message
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.done) {
                        metrics.endTime = Date.now();
                        ws.close();
                    } else if (msg.error) {
                        metrics.errors.push(msg.error);
                    }
                } catch (error) {
                    metrics.errors.push(`Parse error: ${error?.message || 'unknown'}`);
                }
            }
        });

        ws.on('error', (error) => {
            metrics.errors.push(error?.message || 'WebSocket error');
        });

        ws.on('close', () => {
            finishBenchmark();
        });

        // Timeout after 30 seconds
        setTimeout(() => {
            if (!metrics.endTime) {
                metrics.errors.push('Timeout after 30s');
                metrics.endTime = Date.now();
            }
            ws.close();
        }, 30000);
    });
}

// Benchmark SSE + JSON
async function benchmarkSSEJSON(tokens, chunkSize = 1, delay = 0) {
    return new Promise((resolve, reject) => {
        const metrics = {
            protocol: 'SSE+JSON',
            tokenCount: tokens.length,
            chunkSize,
            delay,
            startTime: Date.now(),
            firstByteTime: null,
            endTime: null,
            totalBytes: 0,
            chunksReceived: 0,
            decodedTokens: tokens, // Track original tokens for verification
            decodedText: '', // Accumulate decoded text
            errors: [],
        };

        let resolved = false;
        const finishBenchmark = () => {
            if (resolved) return;
            resolved = true;
            if (!metrics.endTime) {
                metrics.endTime = Date.now();
            }
            es.close();
            resolve(metrics);
        };

        const url = `${SERVER_URL}/sse-json?tokens=${encodeURIComponent(JSON.stringify(tokens))}&chunkSize=${chunkSize}&delay=${delay}`;
        const es = new EventSource(url);

        es.onopen = () => {
            // Connection opened
        };

        es.onmessage = (event) => {
            if (!metrics.firstByteTime) {
                metrics.firstByteTime = Date.now();
            }

            metrics.totalBytes += Buffer.byteLength(event.data, 'utf8') + 7; // +7 for "data: \n\n"
            metrics.chunksReceived++;

            try {
                const data = JSON.parse(event.data);
                if (data.text) {
                    // Receive decoded text directly from server (realistic SSE scenario)
                    metrics.decodedText += data.text;
                }
            } catch (error) {
                metrics.errors.push(`Parse error: ${error?.message || 'unknown'}`);
            }
        };

        es.addEventListener('done', (event) => {
            metrics.endTime = Date.now();
            finishBenchmark();
        });

        es.onerror = (error) => {
            finishBenchmark();
        };

        // Timeout after 30 seconds
        setTimeout(() => {
            if (!metrics.endTime) {
                metrics.errors.push('Timeout after 30s');
                metrics.endTime = Date.now();
            }
            finishBenchmark();
        }, 30000);
    });
}

// Calculate and display metrics
function calculateMetrics(metrics) {
    const totalTime = (metrics.endTime || Date.now()) - metrics.startTime;
    const firstByteLatency = metrics.firstByteTime ? metrics.firstByteTime - metrics.startTime : null;
    const throughput = totalTime > 0 ? (metrics.decodedTokens.length / totalTime) * 1000 : 0; // tokens per second
    const avgChunkSize = metrics.chunksReceived > 0 ? metrics.totalBytes / metrics.chunksReceived : 0;

    // Calculate JSON baseline size for comparison (compare text, not token IDs)
    const jsonSize = Buffer.byteLength(JSON.stringify({ text: metrics.decodedText }), 'utf8');
    const compressionRatio = metrics.totalBytes > 0 ? jsonSize / metrics.totalBytes : 0;

    // Filter out timeout errors for success detection (timeouts happen when we wait for all data)
    const criticalErrors = metrics.errors.filter(err => !err.includes('Timeout'));
    
    return {
        ...metrics,
        totalTime,
        firstByteLatency,
        throughput,
        avgChunkSize,
        jsonSize,
        compressionRatio,
        textLength: metrics.decodedText.length,
        success: metrics.decodedTokens.length === metrics.tokenCount && criticalErrors.length === 0,
    };
}

// Display results
function displayResults(result) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Protocol: ${result.protocol}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Success: ${result.success ? '✓' : '✗'}`);
    console.log(`Tokens sent: ${result.tokenCount}`);
    console.log(`Tokens received: ${result.decodedTokens.length}`);
    console.log(`Text decoded: ${result.textLength} characters`);
    console.log(`Chunk size: ${result.chunkSize}`);
    console.log(`Delay: ${result.delay}ms`);
    console.log(`\nTiming:`);
    console.log(`  Total time: ${result.totalTime}ms`);
    console.log(`  First byte latency: ${result.firstByteLatency}ms`);
    console.log(`  Throughput: ${result.throughput.toFixed(2)} tokens/sec`);
    console.log(`\nData Transfer:`);
    console.log(`  Total bytes: ${result.totalBytes}`);
    console.log(`  Chunks: ${result.chunksReceived}`);
    console.log(`  Avg chunk size: ${result.avgChunkSize.toFixed(2)} bytes`);
    console.log(`\nCompression:`);
    console.log(`  JSON baseline: ${result.jsonSize} bytes`);
    console.log(`  Actual transfer: ${result.totalBytes} bytes`);
    console.log(`  Compression ratio: ${result.compressionRatio.toFixed(2)}x`);
    const savings = result.compressionRatio > 0 ? ((1 - 1/result.compressionRatio) * 100).toFixed(1) : '0.0';
    if (result.compressionRatio > 1) {
        console.log(`  Savings: ${savings}%`);
    } else {
        console.log(`  Overhead: ${Math.abs(parseFloat(savings))}% larger`);
    }
    
    if (result.errors.length > 0) {
        console.log(`\nErrors (${result.errors.length}):`);
        result.errors.forEach(err => console.log(`  - ${err}`));
    }
}

// Compare two results
function compareResults(result1, result2) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`COMPARISON: ${result1.protocol} vs ${result2.protocol}`);
    console.log(`${'='.repeat(60)}`);
    
    const timeDiff = ((result1.totalTime - result2.totalTime) / result2.totalTime * 100);
    const bytesDiff = ((result1.totalBytes - result2.totalBytes) / result2.totalBytes * 100);
    const throughputDiff = ((result1.throughput - result2.throughput) / result2.throughput * 100);
    
    console.log(`Total Time: ${result1.totalTime}ms vs ${result2.totalTime}ms`);
    console.log(`  → ${result1.protocol} is ${Math.abs(timeDiff).toFixed(1)}% ${timeDiff > 0 ? 'slower' : 'faster'}`);
    
    console.log(`\nData Transfer: ${result1.totalBytes} bytes vs ${result2.totalBytes} bytes`);
    console.log(`  → ${result1.protocol} uses ${Math.abs(bytesDiff).toFixed(1)}% ${bytesDiff > 0 ? 'more' : 'less'} bandwidth`);
    
    console.log(`\nThroughput: ${result1.throughput.toFixed(2)} vs ${result2.throughput.toFixed(2)} tokens/sec`);
    console.log(`  → ${result1.protocol} is ${Math.abs(throughputDiff).toFixed(1)}% ${throughputDiff > 0 ? 'faster' : 'slower'}`);
    
    console.log(`\nFirst Byte Latency: ${result1.firstByteLatency}ms vs ${result2.firstByteLatency}ms`);
    console.log(`  → ${result1.protocol} is ${Math.abs(result1.firstByteLatency - result2.firstByteLatency)}ms ${result1.firstByteLatency > result2.firstByteLatency ? 'slower' : 'faster'}`);
}

// Run a benchmark suite
async function runBenchmarkSuite(config) {
    console.log(`\n${'#'.repeat(60)}`);
    console.log(`Running Benchmark: ${config.name}`);
    console.log(`${'#'.repeat(60)}`);
    console.log(`Tokens: ${config.tokenCount}, Pattern: ${config.pattern}, Chunk Size: ${config.chunkSize}`);

    const tokens = generateTokens(config.tokenCount, config.pattern);

    // Run benchmarks
    console.log(`\nTesting WS+Huffman...`);
    const wsResult = await benchmarkWSHuffman(tokens, config.chunkSize, config.delay);
    const wsCalculated = calculateMetrics(wsResult);
    displayResults(wsCalculated);

    console.log(`\nTesting SSE+JSON...`);
    const sseResult = await benchmarkSSEJSON(tokens, config.chunkSize, config.delay);
    const sseCalculated = calculateMetrics(sseResult);
    displayResults(sseCalculated);

    compareResults(wsCalculated, sseCalculated);

    return { ws: wsCalculated, sse: sseCalculated };
}

// Main benchmark runner
async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   End-to-End Benchmark: WS+Huffman vs SSE+JSON            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Check if server is running
    try {
        const response = await fetch(`${SERVER_URL}/health`);
        if (!response.ok) {
            throw new Error('Server not responding');
        }
    } catch (error) {
        console.error('❌ Error: Benchmark server is not running!');
        console.error('   Please start the server first:');
        console.error('   node node-examples/benchmark_server.js\n');
        process.exit(1);
    }

    const allResults = [];

    // Benchmark configurations
    const configs = [
        {
            name: 'Small Sequential Payload',
            tokenCount: 100,
            pattern: 'sequential',
            chunkSize: 1,
            delay: 0,
        },
        {
            name: 'Medium Sequential Payload',
            tokenCount: 1000,
            pattern: 'sequential',
            chunkSize: 10,
            delay: 0,
        },
        {
            name: 'Large Sequential Payload',
            tokenCount: 10000,
            pattern: 'sequential',
            chunkSize: 100,
            delay: 0,
        },
        {
            name: 'Random Tokens (High Entropy)',
            tokenCount: 1000,
            pattern: 'random',
            chunkSize: 10,
            delay: 0,
        },
        {
            name: 'Repetitive Tokens (Low Entropy)',
            tokenCount: 1000,
            pattern: 'repetitive',
            chunkSize: 10,
            delay: 0,
        },
        {
            name: 'Sparse Tokens',
            tokenCount: 1000,
            pattern: 'sparse',
            chunkSize: 10,
            delay: 0,
        },
        {
            name: 'Simulated LLM Streaming (1 token/chunk)',
            tokenCount: 500,
            pattern: 'random',
            chunkSize: 1,
            delay: 10, // 10ms delay between tokens
        },
    ];

    // Run all benchmarks
    for (const config of configs) {
        const result = await runBenchmarkSuite(config);
        allResults.push({ config, ...result });
        
        // Small delay between benchmarks
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log('\n\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    BENCHMARK SUMMARY                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    let wsWins = 0;
    let sseWins = 0;
    let wsTotalBytes = 0;
    let sseTotalBytes = 0;

    allResults.forEach(({ config, ws, sse }) => {
        console.log(`\n${config.name}:`);
        console.log(`  WS+Huffman:  ${ws.totalTime}ms, ${ws.totalBytes} bytes`);
        console.log(`  SSE+JSON:    ${sse.totalTime}ms, ${sse.totalBytes} bytes`);
        console.log(`  Winner:      ${ws.totalTime < sse.totalTime ? '✓ WS+Huffman (faster)' : '✓ SSE+JSON (faster)'}`);
        console.log(`  Bandwidth:   ${ws.totalBytes < sse.totalBytes ? '✓ WS+Huffman (smaller)' : '✓ SSE+JSON (smaller)'}`);
        
        if (ws.totalTime < sse.totalTime) wsWins++;
        else sseWins++;
        
        wsTotalBytes += ws.totalBytes;
        sseTotalBytes += sse.totalBytes;
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Overall Results:`);
    console.log(`  Speed wins: WS+Huffman: ${wsWins}, SSE+JSON: ${sseWins}`);
    console.log(`  Total bandwidth: WS+Huffman: ${wsTotalBytes} bytes, SSE+JSON: ${sseTotalBytes} bytes`);
    console.log(`  Bandwidth savings: ${(((sseTotalBytes - wsTotalBytes) / sseTotalBytes) * 100).toFixed(1)}%`);
    console.log(`${'='.repeat(60)}\n`);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    benchmarkWSHuffman,
    benchmarkSSEJSON,
    generateTokens,
    calculateMetrics,
};
