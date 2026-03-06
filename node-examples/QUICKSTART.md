# Quick Start: Running Benchmarks

## TL;DR

```bash
# Terminal 1: Start server
cd node-examples
npm run benchmark:server

# Terminal 2: Run benchmarks
cd node-examples
npm run benchmark:client
```

## Using the Shell Script (Recommended)

The easiest way is to use the provided shell script that handles everything:

```bash
cd node-examples
./run_benchmarks.sh full
```

This will:
1. Check dependencies and install if needed
2. Start the server automatically
3. Run all benchmarks
4. Save results to `benchmark-results/`
5. Clean up when done

## Other Options

### Quick Smoke Test
```bash
# Terminal 1
npm run benchmark:server

# Terminal 2
npm run benchmark:smoke
```

### Run Specific Benchmarks
Edit the `configs` array in [benchmark_client.js](benchmark_client.js) to add or remove test scenarios.

### Analyze Saved Results
```bash
npm run benchmark:analyze benchmark-results/benchmark-2024-03-15.json
```

### Shell Script Options
```bash
./run_benchmarks.sh full      # Full benchmark suite (automated)
./run_benchmarks.sh server    # Start server only
./run_benchmarks.sh client    # Run client only
./run_benchmarks.sh quick     # Quick benchmark
./run_benchmarks.sh help      # Show help
```

## What Gets Tested

The benchmarks compare:
- **WebSocket + Huffman** - Binary protocol with compression
- **SSE + JSON** - Server-Sent Events with JSON

Across multiple scenarios:
- Different payload sizes (100 to 10,000 tokens)
- Different token patterns (sequential, random, repetitive, sparse)
- Different streaming patterns (bulk, chunked, one-at-a-time)

## Interpreting Results

### Key Metrics

- **Total Time** - Lower is better
- **First Byte Latency** - Lower is better (important for UX)
- **Throughput** - Higher is better (tokens/second)
- **Total Bytes** - Lower is better (bandwidth cost)
- **Compression Ratio** - Higher is better (WS+Huffman only)

### Typical Results

WS+Huffman typically:
- Uses **60-70% less bandwidth** than SSE+JSON
- Has **slightly higher latency** (10-20ms due to compression)
- Better for **large payloads** and **bandwidth-constrained** scenarios

SSE+JSON typically:
- **Lower latency** (faster parsing than decompression)
- **Simpler** implementation and debugging
- Better for **small payloads** and **simplicity**

## Troubleshooting

### "Server not responding"
- Make sure server is running: `npm run benchmark:server`
- Check port 3001 is not in use: `lsof -i :3001`

### "Cannot find module 'eventsource'"
- Install dependencies: `npm install`

### Results seem inconsistent
- Close other applications to reduce noise
- Run benchmarks multiple times and average
- Check CPU/network usage during tests

## Next Steps

- Read [BENCHMARKS.md](BENCHMARKS.md) for detailed documentation
- Customize test scenarios in `benchmark_client.js`
- Use the analyzer to generate reports for your team

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║   End-to-End Benchmark: WS+Huffman vs SSE+JSON            ║
╚════════════════════════════════════════════════════════════╝

Running Benchmark: Medium Sequential Payload
Tokens: 1000, Pattern: sequential, Chunk Size: 10

Testing WS+Huffman...
============================================================
Protocol: WS+Huffman
Success: ✓
Total time: 245ms
Throughput: 4081.63 tokens/sec
Total bytes: 1856
Compression ratio: 2.64x
Savings: 62.1%

Testing SSE+JSON...
============================================================
Protocol: SSE+JSON
Success: ✓
Total time: 198ms
Throughput: 5050.51 tokens/sec
Total bytes: 5700
Compression ratio: 0.86x

COMPARISON: WS+Huffman vs SSE+JSON
  → WS+Huffman uses 67.4% less bandwidth
  → SSE+JSON is 23.7% faster
```
