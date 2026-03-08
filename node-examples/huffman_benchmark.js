/**
 * Performance Benchmarks for HuffmanClient
 * 
 * Measures:
 * - Connection latency
 * - Decoding throughput
 * - End-to-end latency
 * - Memory usage
 */

const { HuffmanClient } = require('./huffmanClient');
const { MockProxyServer } = require('./mockProxyServer');

const TEST_PORT = 3098;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

class BenchmarkRunner {
  constructor() {
    this.results = [];
    this.mockServer = new MockProxyServer({ port: TEST_PORT, simulateDelay: 0 });
  }

  async setup() {
    console.log('🔧 Setting up benchmark environment...\n');
    await this.mockServer.start();
  }

  async teardown() {
    console.log('\n🧹 Cleaning up benchmark environment...');
    await this.mockServer.stop();
  }

  async runBenchmark(name, iterations, benchmarkFn, unit = 'ms') {
    console.log(`\n📊 Running: ${name} (${iterations} iterations)`);

    const times = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await benchmarkFn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      times.push(duration);

      // Progress indicator
      if ((i + 1) % Math.max(1, Math.floor(iterations / 10)) === 0) {
        process.stdout.write('.');
      }
    }

    console.log('');

    const totalTime = times.reduce((sum, t) => sum + t, 0);
    const avgTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const result = {
      name,
      iterations,
      totalTime,
      avgTime,
      minTime,
      maxTime,
      unit
    };

    this.results.push(result);

    console.log(`   Avg: ${avgTime.toFixed(2)}${unit}`);
    console.log(`   Min: ${minTime.toFixed(2)}${unit}`);
    console.log(`   Max: ${maxTime.toFixed(2)}${unit}`);
  }

  async runAll() {
    await this.setup();

    console.log('⚡ HuffmanClient Performance Benchmarks\n');
    console.log('='.repeat(60));

    // Benchmark 1: Connection latency
    await this.runBenchmark(
      'Connection Latency',
      20,
      async () => {
        const client = new HuffmanClient(TEST_URL);
        await client.initialize();
        await client.connect();
        client.disconnect();
      },
      'ms'
    );

    // Benchmark 2: Small completion (100 tokens)
    await this.runBenchmark(
      'Small Completion (100 tokens)',
      50,
      async () => {
        const client = new HuffmanClient(TEST_URL);
        await client.initialize();
        await client.connect();

        await client.generate(
          { prompt: 'Test', tokenCount: 100 },
          {
            onToken: (text) => {},
            onComplete: () => {},
            onError: (err) => { throw err; }
          }
        );

        client.disconnect();
      },
      'ms'
    );

    // Benchmark 3: Medium completion (1000 tokens)
    await this.runBenchmark(
      'Medium Completion (1000 tokens)',
      30,
      async () => {
        const client = new HuffmanClient(TEST_URL);
        await client.initialize();
        await client.connect();

        await client.generate(
          { prompt: 'Test', tokenCount: 1000 },
          {
            onToken: (text) => {},
            onComplete: () => {},
            onError: (err) => { throw err; }
          }
        );

        client.disconnect();
      },
      'ms'
    );

    // Benchmark 4: Large completion (5000 tokens)
    await this.runBenchmark(
      'Large Completion (5000 tokens)',
      10,
      async () => {
        const client = new HuffmanClient(TEST_URL);
        await client.initialize();
        await client.connect();

        await client.generate(
          { prompt: 'Test', tokenCount: 5000 },
          {
            onToken: (text) => {},
            onComplete: () => {},
            onError: (err) => { throw err; }
          }
        );

        client.disconnect();
      },
      'ms'
    );

    // Benchmark 5: Decode-only throughput
    await this.runBenchmark(
      'Decode Throughput Test',
      100,
      async () => {
        const client = new HuffmanClient(TEST_URL);
        await client.initialize();
        await client.connect();

        await client.generate(
          { prompt: 'Test', tokenCount: 1000 },
          {
            onToken: (text) => {},
            onComplete: () => {},
            onError: (err) => { throw err; }
          }
        );

        client.disconnect();
      },
      'ms'
    );

    // Benchmark 6: Multiple sequential requests
    await this.runBenchmark(
      '5 Sequential Requests (100 tokens each)',
      20,
      async () => {
        const client = new HuffmanClient(TEST_URL);
        await client.initialize();
        await client.connect();

        for (let i = 0; i < 5; i++) {
          await client.generate(
            { prompt: `Test ${i}`, tokenCount: 100 },
            {
              onToken: (text) => {},
              onComplete: () => {},
              onError: (err) => { throw err; }
            }
          );
        }

        client.disconnect();
      },
      'ms'
    );

    // Benchmark 7: Connection reuse
    await this.runBenchmark(
      'Connection Reuse (10 requests)',
      20,
      async () => {
        const client = new HuffmanClient(TEST_URL);
        await client.initialize();
        await client.connect();

        for (let i = 0; i < 10; i++) {
          await client.generate(
            { prompt: `Test ${i}`, tokenCount: 50 },
            {
              onToken: (text) => {},
              onComplete: () => {},
              onError: (err) => { throw err; }
            }
          );
        }

        client.disconnect();
      },
      'ms'
    );

    await this.teardown();
    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('Benchmark Summary');
    console.log('='.repeat(60));

    // Calculate throughput where applicable
    this.results.forEach(result => {
      if (result.name.includes('tokens')) {
        const match = result.name.match(/\((\d+) tokens\)/);
        if (match) {
          const tokenCount = parseInt(match[1]);
          const tokensPerSecond = (tokenCount / result.avgTime) * 1000;
          result.throughput = tokensPerSecond;
        }
      }
    });

    console.log('\n📊 Performance Results:\n');

    // Table header
    console.log('Benchmark'.padEnd(40) + 'Avg Time'.padEnd(15) + 'Throughput');
    console.log('-'.repeat(70));

    this.results.forEach(result => {
      const name = result.name.padEnd(40);
      const avgTime = `${result.avgTime.toFixed(2)}${result.unit}`.padEnd(15);
      const throughput = result.throughput 
        ? `${Math.round(result.throughput).toLocaleString()} tok/s`
        : '-';
      
      console.log(name + avgTime + throughput);
    });

    console.log('\n💡 Key Insights:\n');

    const connectionLatency = this.results.find(r => r.name.includes('Connection'));
    if (connectionLatency) {
      console.log(`   • Connection latency: ${connectionLatency.avgTime.toFixed(2)}ms`);
    }

    const small = this.results.find(r => r.name.includes('100 tokens'));
    const medium = this.results.find(r => r.name.includes('1000 tokens'));
    const large = this.results.find(r => r.name.includes('5000 tokens'));

    if (small && medium) {
      console.log(`   • Small completions: ${small.avgTime.toFixed(2)}ms (${Math.round(small.throughput).toLocaleString()} tok/s)`);
      console.log(`   • Medium completions: ${medium.avgTime.toFixed(2)}ms (${Math.round(medium.throughput).toLocaleString()} tok/s)`);
    }

    if (large) {
      console.log(`   • Large completions: ${large.avgTime.toFixed(2)}ms (${Math.round(large.throughput).toLocaleString()} tok/s)`);
    }

    const sequential = this.results.find(r => r.name.includes('Sequential'));
    if (sequential) {
      console.log(`   • Sequential requests: ${sequential.avgTime.toFixed(2)}ms total`);
    }

    const reuse = this.results.find(r => r.name.includes('Reuse'));
    if (reuse) {
      console.log(`   • Connection reuse (10 requests): ${reuse.avgTime.toFixed(2)}ms total`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Benchmark completed');
    console.log('='.repeat(60) + '\n');
  }
}

// Run benchmark
if (require.main === module) {
  const benchmark = new BenchmarkRunner();
  benchmark.runAll().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { BenchmarkRunner };
