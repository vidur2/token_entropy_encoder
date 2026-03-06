/**
 * Unit Tests for HuffmanClient
 */

import { HuffmanClient } from '../src/huffmanClient';
import { MockProxyServer } from './mockProxyServer';

const TEST_PORT = 3099;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

class TestRunner {
  private results: TestResult[] = [];
  private mockServer: MockProxyServer;

  constructor() {
    this.mockServer = new MockProxyServer({ port: TEST_PORT });
  }

  async setup() {
    console.log('🔧 Setting up test environment...');
    await this.mockServer.start();
  }

  async teardown() {
    console.log('🧹 Cleaning up test environment...');
    await this.mockServer.stop();
  }

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    try {
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({ name, passed: true, duration });
      console.log(`✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.results.push({ name, passed: false, error: errorMsg, duration });
      console.log(`❌ ${name} (${duration}ms)`);
      console.log(`   Error: ${errorMsg}`);
    }
  }

  async runAll() {
    await this.setup();

    console.log('\n🧪 Running HuffmanClient Tests\n');

    // Test 1: Initialization
    await this.runTest('Client initialization', async () => {
      const client = new HuffmanClient(TEST_URL);
      await client.initialize();
      if (!client) throw new Error('Failed to create client');
    });

    // Test 2: Connection
    await this.runTest('Connect to proxy server', async () => {
      const client = new HuffmanClient(TEST_URL);
      await client.initialize();
      await client.connect();
      if (!client.ready) throw new Error('Client not ready after connection');
      client.disconnect();
    });

    // Test 3: Disconnect
    await this.runTest('Disconnect from server', async () => {
      const client = new HuffmanClient(TEST_URL);
      await client.initialize();
      await client.connect();
      client.disconnect();
      if (client.ready) throw new Error('Client still ready after disconnect');
    });

    // Test 4: Generate small completion
    await this.runTest('Generate small completion (100 tokens)', async () => {
      const client = new HuffmanClient(TEST_URL);
      await client.initialize();
      await client.connect();

      let tokenCount = 0;
      let completed = false;

      await client.generate(
        { prompt: 'Test prompt', tokenCount: 100 } as any,
        {
          onToken: (text) => { tokenCount++; },
          onComplete: () => { completed = true; },
          onError: (err) => { throw err; }
        }
      );

      if (!completed) throw new Error('Generation did not complete');
      if (tokenCount === 0) throw new Error('No tokens received');

      client.disconnect();
    });

    // Test 5: Generate medium completion
    await this.runTest('Generate medium completion (1000 tokens)', async () => {
      const client = new HuffmanClient(TEST_URL);
      await client.initialize();
      await client.connect();

      let tokenCount = 0;
      let completed = false;

      await client.generate(
        { prompt: 'Test prompt', tokenCount: 1000 } as any,
        {
          onToken: (text) => { tokenCount++; },
          onComplete: () => { completed = true; },
          onError: (err) => { throw err; }
        }
      );

      if (!completed) throw new Error('Generation did not complete');
      if (tokenCount === 0) throw new Error('No tokens received');

      client.disconnect();
    });

    // Test 6: Error handling
    await this.runTest('Handle server error', async () => {
      const client = new HuffmanClient(TEST_URL);
      await client.initialize();
      await client.connect();

      let errorReceived = false;

      try {
        await client.generate(
          { prompt: 'Test prompt', simulateError: true } as any,
          {
            onToken: (text) => {},
            onComplete: () => {},
            onError: (err) => { errorReceived = true; }
          }
        );
      } catch (error) {
        errorReceived = true;
      }

      if (!errorReceived) throw new Error('Error not handled properly');

      client.disconnect();
    });

    // Test 7: Multiple sequential requests
    await this.runTest('Multiple sequential requests', async () => {
      const client = new HuffmanClient(TEST_URL);
      await client.initialize();
      await client.connect();

      for (let i = 0; i < 3; i++) {
        let completed = false;

        await client.generate(
          { prompt: `Test prompt ${i}`, tokenCount: 50 } as any,
          {
            onToken: (text) => {},
            onComplete: () => { completed = true; },
            onError: (err) => { throw err; }
          }
        );

        if (!completed) throw new Error(`Request ${i} did not complete`);
      }

      client.disconnect();
    });

    // Test 8: Token callback accuracy
    await this.runTest('Token callback receives text', async () => {
      const client = new HuffmanClient(TEST_URL);
      await client.initialize();
      await client.connect();

      let receivedText = '';

      await client.generate(
        { prompt: 'Test prompt', tokenCount: 100 } as any,
        {
          onToken: (text) => { 
            receivedText += text;
            if (typeof text !== 'string') {
              throw new Error('Token is not a string');
            }
          },
          onComplete: () => {},
          onError: (err) => { throw err; }
        }
      );

      if (receivedText.length === 0) {
        throw new Error('No text received in callbacks');
      }

      client.disconnect();
    });

    await this.teardown();
    this.printSummary();
  }

  private printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const totalDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);

    console.log(`\nTotal Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Average Duration: ${Math.round(totalDuration / total)}ms`);

    if (failed > 0) {
      console.log('\nFailed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.name}`);
          console.log(`    ${r.error}`);
        });
    }

    console.log('\n' + '='.repeat(60));

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Run tests
const runner = new TestRunner();
runner.runAll().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
