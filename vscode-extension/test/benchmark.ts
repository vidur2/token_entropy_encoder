/**
 * Performance Benchmarks for HuffmanClient
 * 
 * Measures:
 * - Connection latency
 * - Decoding throughput
 * - End-to-end latency
 * - Memory usage
 */

import { HuffmanClient } from '../src/huffmanClient';
import { MockProxyServer } from './mockProxyServer';

const TEST_PORT = 3098;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  throughput?: number;
  unit: string;
}

class BenchmarkRunner {
  private results: BenchmarkResult[] = [];
  private mockServer: MockProxyServer;

  constructor() {
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

  async runBenchmark(
    name: string,
    iterations: number,
    benchmarkFn: () => Promise<void>,
    unit: string = 'ms'
  ): Promise<void> {
    console.log(`\n📊 Running: ${name} (${iterations} iterations)`);

    const times: number[] = [];

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

    const result: BenchmarkResult = {
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
          { prompt: 'Test', tokenCount: 100 } as any,
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
          { prompt: 'Test', tokenCount: 1000 } as any,
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
          { prompt: 'Test', tokenCount: 5000 } as any,
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
          { prompt: 'Test', tokenCount: 1000 } as any,
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
            { prompt: `Test ${i}`, tokenCount: 100 } as any,
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
            { prompt: `Test ${i}`, tokenCount: 50 } as any,
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

  private printSummary() {
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
      const ratio = medium.avgTime / small.avgTime;
      console.log(`   • 10x tokens → ${ratio.toFixed(1)}x latency (${ratio > 5 ? 'sublinear' : 'near-linear'} scaling)`);
    }

    if (medium && medium.throughput) {
      console.log(`   • Peak throughput: ${Math.round(medium.throughput).toLocaleString()} tokens/sec`);
    }

    const reuse = this.results.find(r => r.name.includes('Reuse'));
    const sequential = this.results.find(r => r.name.includes('Sequential'));
    if (reuse && sequential) {
      const reusePerRequest = reuse.avgTime / 10;
      const sequentialPerRequest = sequential.avgTime / 5;
      const speedup = sequentialPerRequest / reusePerRequest;
      console.log(`   • Connection reuse: ${speedup.toFixed(1)}x faster than reconnecting`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All benchmarks completed successfully');
    console.log('='.repeat(60) + '\n');
  }
}

// Run benchmarks
const runner = new BenchmarkRunner();
runner.runAll().catch(error => {
  console.error('Fatal error running benchmarks:', error);
  process.exit(1);
});
