# End-to-End Benchmarks: WebSocket + Huffman vs SSE + JSON

This directory contains comprehensive end-to-end benchmarks comparing two streaming approaches for token delivery:

1. **WebSocket + Huffman** - Binary WebSocket protocol with Huffman compression
2. **SSE + JSON** - Server-Sent Events with JSON encoding

## Quick Start

### 1. Install Dependencies

```bash
cd node-examples
npm install
```

### 2. Run Benchmarks

**Terminal 1** - Start the benchmark server:
```bash
npm run benchmark:server
```

**Terminal 2** - Run the benchmark client:
```bash
npm run benchmark:client
```

The client will automatically run a comprehensive suite of benchmarks and display results.

## Files

### Core Benchmark Files

- **`benchmark_server.js`** - Dual-protocol server implementing both WS+Huffman and SSE+JSON endpoints
- **`benchmark_client.js`** - Automated benchmark runner that tests both protocols and collects metrics
- **`benchmark_analyzer.js`** - Results analyzer that generates reports in Markdown, JSON, and CSV formats
- **`run_benchmarks.sh`** - Helper script to run the full benchmark suite

### Server Endpoints

The benchmark server runs on `http://localhost:3001` and provides:

- **`ws://localhost:3001/ws-huffman`** - WebSocket endpoint with Huffman encoding
- **`http://localhost:3001/sse-json`** - SSE endpoint with JSON encoding
- **`http://localhost:3001/health`** - Health check endpoint

## Benchmark Scenarios

The benchmark suite tests multiple scenarios:

### Payload Sizes
- **Small** (100 tokens) - Quick responses, low latency scenarios
- **Medium** (1,000 tokens) - Typical conversation turns
- **Large** (10,000 tokens) - Document processing, long generations

### Token Patterns
- **Sequential** (0, 1, 2, ...) - Best case for compression
- **Random** (high entropy) - Worst case for compression
- **Repetitive** (0-99 repeating) - Tests compression efficiency
- **Sparse** (0, 100, 200, ...) - Tests encoding of large token IDs

### Streaming Patterns
- **Bulk** - All tokens sent at once
- **Chunked** - Tokens sent in configurable chunks
- **Streaming** - One token at a time (simulates LLM streaming)

## Metrics Collected

For each test, the benchmark collects:

### Performance Metrics
- **Total Time** - End-to-end transfer time
- **First Byte Latency** - Time to first data received
- **Throughput** - Tokens per second
- **Chunks Received** - Number of network messages

### Data Transfer Metrics
- **Total Bytes** - Actual bytes transferred over the wire
- **Average Chunk Size** - Mean size of each message
- **JSON Baseline** - Size of data as raw JSON
- **Compression Ratio** - How much smaller than JSON
- **Bandwidth Savings** - Percentage saved vs JSON

### Quality Metrics
- **Success Rate** - Did all tokens arrive correctly?
- **Error Count** - Any failures during transfer
- **Token Verification** - Decoded tokens match sent tokens

## Results Output

### Console Output

The benchmark client displays real-time results including:
- Individual test results with detailed metrics
- Head-to-head comparisons
- Overall summary with winner analysis

### Saved Reports

Reports are saved to `benchmark-results/` directory:

- **`benchmark-YYYY-MM-DD.md`** - Comprehensive Markdown report
- **`benchmark-YYYY-MM-DD.json`** - Raw data in JSON format
- **`benchmark-YYYY-MM-DD.csv`** - Spreadsheet-compatible CSV

### Sample Output

```
╔════════════════════════════════════════════════════════════╗
║   End-to-End Benchmark: WS+Huffman vs SSE+JSON            ║
╚════════════════════════════════════════════════════════════╝

Running Benchmark: Medium Sequential Payload
Tokens: 1000, Pattern: sequential, Chunk Size: 10

Testing WS+Huffman...
============================================================
Protocol: WS+Huffman
============================================================
Success: ✓
Tokens sent: 1000
Tokens received: 1000

Timing:
  Total time: 245ms
  First byte latency: 12ms
  Throughput: 4081.63 tokens/sec

Data Transfer:
  Total bytes: 1856
  Chunks: 100
  Avg chunk size: 18.56 bytes

Compression:
  JSON baseline: 4892 bytes
  Actual transfer: 1856 bytes
  Compression ratio: 2.64x
  Savings: 62.1%

Testing SSE+JSON...
============================================================
Protocol: SSE+JSON
============================================================
Success: ✓
Tokens sent: 1000
Tokens received: 1000

Timing:
  Total time: 198ms
  First byte latency: 8ms
  Throughput: 5050.51 tokens/sec

Data Transfer:
  Total bytes: 5700
  Chunks: 100
  Avg chunk size: 57.00 bytes

Compression:
  JSON baseline: 4892 bytes
  Actual transfer: 5700 bytes
  Compression ratio: 0.86x
  Savings: -16.5%

============================================================
COMPARISON: WS+Huffman vs SSE+JSON
============================================================
Total Time: 245ms vs 198ms
  → WS+Huffman is 23.7% slower

Data Transfer: 1856 bytes vs 5700 bytes
  → WS+Huffman uses 67.4% less bandwidth

Throughput: 4081.63 vs 5050.51 tokens/sec
  → WS+Huffman is 19.2% slower

First Byte Latency: 12ms vs 8ms
  → WS+Huffman is 4ms slower
```

## Understanding the Results

### When WS+Huffman Wins
- **High bandwidth costs** - Huffman compression typically saves 40-70% bandwidth
- **Large payloads** - Compression benefits increase with payload size
- **Repetitive data** - Low-entropy data compresses better
- **Mobile/metered connections** - Data transfer costs matter

### When SSE+JSON Wins
- **Low latency critical** - JSON parsing is typically faster than decompression
- **Small payloads** - Compression overhead outweighs benefits
- **Simple infrastructure** - SSE works with standard HTTP/2
- **Debugging** - JSON is human-readable

### Trade-offs

| Factor | WS+Huffman | SSE+JSON |
|--------|------------|----------|
| Bandwidth | ✓✓✓ (60%+ savings) | ✗ (full JSON overhead) |
| Latency | ✓ (slight overhead) | ✓✓ (faster parsing) |
| Complexity | ✗ (binary protocol) | ✓✓ (standard HTTP) |
| Browser Support | ✓✓ (modern browsers) | ✓✓✓ (universal) |
| Bi-directional | ✓✓✓ (full duplex) | ✗ (server→client only) |
| Debugging | ✗ (binary data) | ✓✓✓ (readable JSON) |

## Customizing Benchmarks

### Add Custom Test Scenarios

Edit `benchmark_client.js` and add to the `configs` array:

```javascript
const configs = [
    // ... existing configs ...
    {
        name: 'My Custom Test',
        tokenCount: 5000,
        pattern: 'random',
        chunkSize: 50,
        delay: 5,
    },
];
```

### Change Server Port

Edit both `benchmark_server.js` and `benchmark_client.js`:

```javascript
const PORT = 3001; // Change to your preferred port
```

### Adjust Timeouts

In `benchmark_client.js`, change the timeout:

```javascript
// Default is 30 seconds
setTimeout(() => {
    // ... timeout handling
}, 30000); // Change this value
```

## Advanced Usage

### Running Individual Tests

You can import and use the benchmark functions programmatically:

```javascript
const { benchmarkWSHuffman, benchmarkSSEJSON, generateTokens } = require('./benchmark_client.js');

async function customBenchmark() {
    const tokens = generateTokens(500, 'random');
    
    const wsResult = await benchmarkWSHuffman(tokens, 10, 0);
    console.log('WS Result:', wsResult);
    
    const sseResult = await benchmarkSSEJSON(tokens, 10, 0);
    console.log('SSE Result:', sseResult);
}
```

### Analyzing Saved Results

```bash
node benchmark_analyzer.js benchmark-results/benchmark-2024-03-15.json
```

### Export Results

The analyzer automatically exports to:
- **Markdown** - For documentation and reports
- **JSON** - For programmatic analysis
- **CSV** - For Excel/Google Sheets

## Troubleshooting

### Server Won't Start

**Error**: `EADDRINUSE: address already in use`
- Another process is using port 3001
- Solution: Change the port or kill the other process

### Client Can't Connect

**Error**: `Server not responding`
- Make sure the server is running first
- Check that you're using the correct URL and port

### Timeout Errors

**Error**: `Timeout after 30s`
- Network is too slow or payload too large
- Solution: Increase timeout or reduce payload size

### Missing Dependencies

**Error**: `Cannot find module 'eventsource'`
- Dependencies not installed
- Solution: Run `npm install` in the node-examples directory

## Performance Tips

### For Production Use

1. **Enable HTTP/2** - Improves SSE performance significantly
2. **Use Connection Pooling** - Reduces WebSocket handshake overhead
3. **Implement Backpressure** - Prevent buffer overflow in streams
4. **Monitor Compression Ratios** - Track actual bandwidth savings

### For Benchmarking

1. **Warm Up** - Run tests multiple times and discard first results
2. **Network Simulation** - Use tools like `tc` to simulate real network conditions
3. **Concurrent Users** - Test with multiple simultaneous clients
4. **Long-Running Tests** - Monitor memory usage over time

## Contributing

To add new benchmark scenarios or improve the analysis:

1. Fork the repository
2. Add your test case to `benchmark_client.js`
3. Update this README with any new metrics or insights
4. Submit a pull request

## License

Same as the parent project.
