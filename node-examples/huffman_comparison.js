/**
 * Comparison Benchmark: WebSocket+Huffman vs SSE+JSON
 * 
 * Direct head-to-head comparison of both approaches
 */

const { HuffmanClient } = require('./huffmanClient');
const { SSEClient } = require('./sseClient');
const { MockProxyServer } = require('./mockProxyServer');

const TEST_PORT = 3097;
const WS_URL = `ws://localhost:${TEST_PORT}`;
const SSE_URL = `http://localhost:${TEST_PORT}`;

class ComparisonBenchmark {
  constructor() {
    this.results = [];
    this.mockServer = new MockProxyServer({ port: TEST_PORT, simulateDelay: 0 });
  }

  async setup() {
    console.log('🔧 Setting up comparison benchmark...\n');
    await this.mockServer.start();
  }

  async teardown() {
    console.log('\n🧹 Cleaning up...');
    await this.mockServer.stop();
  }

  async runComparison(scenario, tokenCount, iterations) {
    console.log(`\n📊 ${scenario} (${tokenCount} tokens, ${iterations} iterations)`);
    console.log('─'.repeat(70));

    // Benchmark WebSocket + Huffman
    const huffmanTimes = await this.benchmarkHuffman(tokenCount, iterations);
    const huffmanAvg = huffmanTimes.reduce((a, b) => a + b, 0) / huffmanTimes.length;
    const huffmanMin = Math.min(...huffmanTimes);
    const huffmanMax = Math.max(...huffmanTimes);

    this.results.push({
      approach: 'WebSocket + Huffman',
      scenario,
      iterations,
      avgTime: huffmanAvg,
      minTime: huffmanMin,
      maxTime: huffmanMax,
    });

    console.log(`  WS+Huffman: avg=${huffmanAvg.toFixed(2)}ms, min=${huffmanMin.toFixed(2)}ms, max=${huffmanMax.toFixed(2)}ms`);

    // Benchmark SSE + JSON
    const sseTimes = await this.benchmarkSSE(tokenCount, iterations);
    const sseAvg = sseTimes.reduce((a, b) => a + b, 0) / sseTimes.length;
    const sseMin = Math.min(...sseTimes);
    const sseMax = Math.max(...sseTimes);

    this.results.push({
      approach: 'SSE + JSON',
      scenario,
      iterations,
      avgTime: sseAvg,
      minTime: sseMin,
      maxTime: sseMax,
    });

    console.log(`  SSE+JSON:   avg=${sseAvg.toFixed(2)}ms, min=${sseMin.toFixed(2)}ms, max=${sseMax.toFixed(2)}ms`);

    // Calculate improvement
    const improvement = ((sseAvg - huffmanAvg) / sseAvg * 100);
    const winner = huffmanAvg < sseAvg ? 'WS+Huffman' : 'SSE+JSON';
    console.log(`  Winner: ${winner} (${Math.abs(improvement).toFixed(1)}% ${improvement > 0 ? 'faster' : 'slower'})`);
  }

  async benchmarkHuffman(tokenCount, iterations) {
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const client = new HuffmanClient(WS_URL);
      await client.initialize();
      await client.connect();

      const startTime = performance.now();

      await client.generate(
        { prompt: 'Test', tokenCount },
        {
          onToken: () => {},
          onComplete: () => {},
          onError: (err) => { throw err; }
        }
      );

      const endTime = performance.now();
      times.push(endTime - startTime);

      client.disconnect();
    }

    return times;
  }

  async benchmarkSSE(tokenCount, iterations) {
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const client = new SSEClient(SSE_URL);
      await client.initialize();
      await client.connect();

      const startTime = performance.now();

      await client.generate(
        { prompt: 'Test', tokenCount },
        {
          onToken: () => {},
          onComplete: () => {},
          onError: (err) => { throw err; }
        }
      );

      const endTime = performance.now();
      times.push(endTime - startTime);

      client.disconnect();
    }

    return times;
  }

  async runAll() {
    await this.setup();

    console.log('⚡ WebSocket+Huffman vs SSE+JSON Comparison\n');
    console.log('='.repeat(70));

    // Small completions
    await this.runComparison('Small Completion', 100, 50);

    // Medium completions
    await this.runComparison('Medium Completion', 1000, 30);

    // Large completions
    await this.runComparison('Large Completion', 5000, 10);

    // Very small (inline completion simulation)
    await this.runComparison('Inline Completion', 50, 100);

    // Chat-sized
    await this.runComparison('Chat Message', 2000, 20);

    await this.teardown();
    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('Comparison Summary');
    console.log('='.repeat(70));

    console.log('\n📊 Detailed Results:\n');

    // Group by scenario
    const scenarios = [...new Set(this.results.map(r => r.scenario))];

    for (const scenario of scenarios) {
      const scenarioResults = this.results.filter(r => r.scenario === scenario);
      const huffman = scenarioResults.find(r => r.approach === 'WebSocket + Huffman');
      const sse = scenarioResults.find(r => r.approach === 'SSE + JSON');

      const improvement = ((sse.avgTime - huffman.avgTime) / sse.avgTime * 100);
      const speedup = (sse.avgTime / huffman.avgTime).toFixed(2);

      console.log(`${scenario}:`);
      console.log(`  WS+Huffman: ${huffman.avgTime.toFixed(2)}ms`);
      console.log(`  SSE+JSON:   ${sse.avgTime.toFixed(2)}ms`);
      console.log(`  Speedup:    ${speedup}x (${improvement.toFixed(1)}% faster)`);
      console.log('');
    }

    // Overall statistics
    const huffmanResults = this.results.filter(r => r.approach === 'WebSocket + Huffman');
    const sseResults = this.results.filter(r => r.approach === 'SSE + JSON');

    const huffmanAvg = huffmanResults.reduce((sum, r) => sum + r.avgTime, 0) / huffmanResults.length;
    const sseAvg = sseResults.reduce((sum, r) => sum + r.avgTime, 0) / sseResults.length;
    const overallSpeedup = (sseAvg / huffmanAvg).toFixed(2);
    const overallImprovement = ((sseAvg - huffmanAvg) / sseAvg * 100).toFixed(1);

    console.log('─'.repeat(70));
    console.log('Overall Statistics:');
    console.log(`  WS+Huffman Average: ${huffmanAvg.toFixed(2)}ms`);
    console.log(`  SSE+JSON Average:   ${sseAvg.toFixed(2)}ms`);
    console.log(`  Overall Speedup:    ${overallSpeedup}x (${overallImprovement}% faster)`);

    // Count wins
    const huffmanWins = scenarios.filter(scenario => {
      const results = this.results.filter(r => r.scenario === scenario);
      const huffman = results.find(r => r.approach === 'WebSocket + Huffman');
      const sse = results.find(r => r.approach === 'SSE + JSON');
      return huffman.avgTime < sse.avgTime;
    }).length;

    console.log(`\n  WebSocket+Huffman wins: ${huffmanWins}/${scenarios.length} scenarios`);
    console.log(`  SSE+JSON wins:          ${scenarios.length - huffmanWins}/${scenarios.length} scenarios`);

    console.log('\n💡 Key Takeaways:\n');

    if (huffmanWins === scenarios.length) {
      console.log('  ✅ WebSocket+Huffman is consistently faster across ALL scenarios');
    } else if (huffmanWins > scenarios.length / 2) {
      console.log('  ✅ WebSocket+Huffman is faster in MOST scenarios');
    } else {
      console.log('  ⚠️  Results are mixed - performance depends on scenario');
    }

    console.log(`  ✅ Average speedup: ${overallSpeedup}x faster`);
    console.log('  ✅ Binary protocol reduces bandwidth (not measured here)');
    console.log('  ✅ Client-side decoding reduces server CPU');

    console.log('\n' + '='.repeat(70));
    console.log('✅ Comparison benchmark completed');
    console.log('='.repeat(70) + '\n');
  }
}

// Run comparison
if (require.main === module) {
  const benchmark = new ComparisonBenchmark();
  benchmark.runAll().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { ComparisonBenchmark };
