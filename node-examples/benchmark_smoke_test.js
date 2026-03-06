#!/usr/bin/env node

/**
 * Quick smoke test for the benchmark system
 * Verifies that both protocols work with a minimal test case
 */

const { benchmarkWSHuffman, benchmarkSSEJSON, generateTokens, calculateMetrics } = require('./benchmark_client.js');

async function smokeTest() {
    console.log('🔍 Running benchmark smoke test...\n');

    // Generate a small test payload
    const tokens = generateTokens(50, 'sequential');
    console.log(`Generated ${tokens.length} test tokens\n`);

    try {
        // Test WS+Huffman
        console.log('[1/2] Testing WebSocket + Huffman...');
        const wsResult = await benchmarkWSHuffman(tokens, 5, 0);
        const wsMetrics = calculateMetrics(wsResult);
        
        if (wsMetrics.success) {
            console.log(`✓ WS+Huffman: ${wsMetrics.totalTime}ms, ${wsMetrics.totalBytes} bytes`);
        } else {
            console.log(`✗ WS+Huffman failed:`, wsMetrics.errors);
            return false;
        }

        // Test SSE+JSON
        console.log('[2/2] Testing SSE + JSON...');
        const sseResult = await benchmarkSSEJSON(tokens, 5, 0);
        const sseMetrics = calculateMetrics(sseResult);
        
        if (sseMetrics.success) {
            console.log(`✓ SSE+JSON: ${sseMetrics.totalTime}ms, ${sseMetrics.totalBytes} bytes`);
        } else {
            console.log(`✗ SSE+JSON failed:`, sseMetrics.errors);
            return false;
        }

        // Compare
        console.log('\n📊 Quick Comparison:');
        console.log(`  Speed: ${wsMetrics.totalTime < sseMetrics.totalTime ? 'WS+Huffman' : 'SSE+JSON'} is faster`);
        console.log(`  Size: ${wsMetrics.totalBytes < sseMetrics.totalBytes ? 'WS+Huffman' : 'SSE+JSON'} is smaller`);
        console.log(`  Compression: WS saved ${(((sseMetrics.totalBytes - wsMetrics.totalBytes) / sseMetrics.totalBytes) * 100).toFixed(1)}% bandwidth`);

        console.log('\n✅ Smoke test passed!\n');
        return true;

    } catch (error) {
        console.error('\n❌ Smoke test failed:', error.message);
        console.error('\nMake sure the benchmark server is running:');
        console.error('  node node-examples/benchmark_server.js\n');
        return false;
    }
}

// Run smoke test
if (require.main === module) {
    smokeTest()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { smokeTest };
