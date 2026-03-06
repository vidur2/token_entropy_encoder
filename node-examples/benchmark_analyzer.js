#!/usr/bin/env node

/**
 * Benchmark Results Analyzer
 * 
 * Analyzes benchmark results and generates detailed reports
 * Can export to JSON, CSV, or Markdown
 */

const fs = require('fs');
const path = require('path');

class BenchmarkAnalyzer {
    constructor(results) {
        this.results = results;
    }

    // Calculate statistical metrics
    calculateStats(values) {
        if (values.length === 0) return null;

        const sorted = [...values].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        const mean = sum / sorted.length;
        
        const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sorted.length;
        const stdDev = Math.sqrt(variance);

        return {
            min: sorted[0],
            max: sorted[sorted.length - 1],
            mean,
            median: sorted[Math.floor(sorted.length / 2)],
            stdDev,
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
        };
    }

    // Analyze performance metrics
    analyzePerformance() {
        const wsTimes = [];
        const sseTimes = [];
        const wsBytes = [];
        const sseBytes = [];
        const wsThroughput = [];
        const sseThroughput = [];
        const wsLatency = [];
        const sseLatency = [];

        this.results.forEach(({ ws, sse }) => {
            if (ws.success) {
                wsTimes.push(ws.totalTime);
                wsBytes.push(ws.totalBytes);
                wsThroughput.push(ws.throughput);
                wsLatency.push(ws.firstByteLatency);
            }
            if (sse.success) {
                sseTimes.push(sse.totalTime);
                sseBytes.push(sse.totalBytes);
                sseThroughput.push(sse.throughput);
                sseLatency.push(sse.firstByteLatency);
            }
        });

        return {
            ws: {
                time: this.calculateStats(wsTimes),
                bytes: this.calculateStats(wsBytes),
                throughput: this.calculateStats(wsThroughput),
                latency: this.calculateStats(wsLatency),
            },
            sse: {
                time: this.calculateStats(sseTimes),
                bytes: this.calculateStats(sseBytes),
                throughput: this.calculateStats(sseThroughput),
                latency: this.calculateStats(sseLatency),
            },
        };
    }

    // Generate markdown report
    generateMarkdownReport() {
        const stats = this.analyzePerformance();

        let md = '# Benchmark Results: WS+Huffman vs SSE+JSON\n\n';
        md += `*Generated: ${new Date().toISOString()}*\n\n`;
        md += '---\n\n';

        // Executive Summary
        md += '## Executive Summary\n\n';
        
        const totalWsBytes = this.results.reduce((sum, r) => sum + r.ws.totalBytes, 0);
        const totalSseBytes = this.results.reduce((sum, r) => sum + r.sse.totalBytes, 0);
        const bandwidthSavings = ((totalSseBytes - totalWsBytes) / totalSseBytes * 100).toFixed(1);
        
        const wsWins = this.results.filter(r => r.ws.totalTime < r.sse.totalTime).length;
        const sseWins = this.results.length - wsWins;

        md += `- **Tests Run**: ${this.results.length}\n`;
        md += `- **Speed Winner**: ${wsWins > sseWins ? 'WS+Huffman' : 'SSE+JSON'} (${Math.max(wsWins, sseWins)}/${this.results.length} tests)\n`;
        md += `- **Bandwidth Savings**: ${bandwidthSavings}% (WS+Huffman vs SSE+JSON)\n`;
        md += `- **Total Data**: WS: ${totalWsBytes.toLocaleString()} bytes, SSE: ${totalSseBytes.toLocaleString()} bytes\n\n`;

        // Performance Statistics
        md += '## Performance Statistics\n\n';
        md += '### WebSocket + Huffman\n\n';
        md += this.formatStatsTable(stats.ws);
        
        md += '\n### Server-Sent Events + JSON\n\n';
        md += this.formatStatsTable(stats.sse);

        // Detailed Results
        md += '## Detailed Results\n\n';
        md += '| Test | Protocol | Time (ms) | Bytes | Throughput | Latency | Status |\n';
        md += '|------|----------|-----------|-------|------------|---------|--------|\n';

        this.results.forEach(({ config, ws, sse }) => {
            md += `| ${config.name} | WS+Huffman | ${ws.totalTime} | ${ws.totalBytes} | ${ws.throughput.toFixed(0)} tok/s | ${ws.firstByteLatency}ms | ${ws.success ? '✓' : '✗'} |\n`;
            md += `| | SSE+JSON | ${sse.totalTime} | ${sse.totalBytes} | ${sse.throughput.toFixed(0)} tok/s | ${sse.firstByteLatency}ms | ${sse.success ? '✓' : '✗'} |\n`;
        });

        md += '\n';

        // Compression Analysis
        md += '## Compression Analysis\n\n';
        md += '| Test | JSON Size | WS+Huffman | SSE+JSON | WS Ratio | WS Savings |\n';
        md += '|------|-----------|------------|----------|----------|------------|\n';

        this.results.forEach(({ config, ws, sse }) => {
            md += `| ${config.name} | ${ws.jsonSize} | ${ws.totalBytes} | ${sse.totalBytes} | ${ws.compressionRatio.toFixed(2)}x | ${((1 - 1/ws.compressionRatio) * 100).toFixed(1)}% |\n`;
        });

        md += '\n';

        // Scenarios Analysis
        md += '## Scenario Analysis\n\n';
        
        const scenarios = {
            'small': this.results.filter(r => r.config.tokenCount <= 100),
            'medium': this.results.filter(r => r.config.tokenCount > 100 && r.config.tokenCount <= 1000),
            'large': this.results.filter(r => r.config.tokenCount > 1000),
            'streaming': this.results.filter(r => r.config.chunkSize === 1 && r.config.delay > 0),
        };

        Object.entries(scenarios).forEach(([name, tests]) => {
            if (tests.length === 0) return;

            md += `### ${name.charAt(0).toUpperCase() + name.slice(1)} Payloads\n\n`;
            
            const avgWsTime = tests.reduce((sum, r) => sum + r.ws.totalTime, 0) / tests.length;
            const avgSseTime = tests.reduce((sum, r) => sum + r.sse.totalTime, 0) / tests.length;
            const avgWsBytes = tests.reduce((sum, r) => sum + r.ws.totalBytes, 0) / tests.length;
            const avgSseBytes = tests.reduce((sum, r) => sum + r.sse.totalBytes, 0) / tests.length;

            md += `- **Average Time**: WS: ${avgWsTime.toFixed(0)}ms, SSE: ${avgSseTime.toFixed(0)}ms\n`;
            md += `- **Average Size**: WS: ${avgWsBytes.toFixed(0)} bytes, SSE: ${avgSseBytes.toFixed(0)} bytes\n`;
            md += `- **Winner**: ${avgWsTime < avgSseTime ? 'WS+Huffman' : 'SSE+JSON'} (${Math.abs(avgWsTime - avgSseTime).toFixed(0)}ms faster)\n\n`;
        });

        // Recommendations
        md += '## Recommendations\n\n';
        
        if (wsWins > sseWins * 1.5) {
            md += '**WS+Huffman is recommended** for this workload:\n';
            md += `- Faster in ${wsWins}/${this.results.length} tests\n`;
            md += `- ${bandwidthSavings}% bandwidth savings\n`;
            md += '- Better for high-throughput, real-time applications\n';
        } else if (sseWins > wsWins * 1.5) {
            md += '**SSE+JSON is recommended** for this workload:\n';
            md += `- Faster in ${sseWins}/${this.results.length} tests\n`;
            md += '- Simpler implementation and debugging\n';
            md += '- Better browser compatibility\n';
        } else {
            md += '**Mixed results** - choose based on specific needs:\n';
            md += `- WS+Huffman: Better bandwidth efficiency (${bandwidthSavings}% savings)\n`;
            md += '- SSE+JSON: Simpler, better for one-way streaming\n';
            md += '- Consider latency requirements and infrastructure\n';
        }

        return md;
    }

    formatStatsTable(stats) {
        let table = '| Metric | Min | Mean | Median | Max | P95 | P99 | Std Dev |\n';
        table += '|--------|-----|------|--------|-----|-----|-----|----------|\n';

        const metrics = [
            { name: 'Time (ms)', data: stats.time },
            { name: 'Bytes', data: stats.bytes },
            { name: 'Throughput (tok/s)', data: stats.throughput },
            { name: 'Latency (ms)', data: stats.latency },
        ];

        metrics.forEach(({ name, data }) => {
            if (!data) {
                table += `| ${name} | - | - | - | - | - | - | - |\n`;
            } else {
                table += `| ${name} | ${data.min.toFixed(0)} | ${data.mean.toFixed(0)} | ${data.median.toFixed(0)} | ${data.max.toFixed(0)} | ${data.p95.toFixed(0)} | ${data.p99.toFixed(0)} | ${data.stdDev.toFixed(2)} |\n`;
            }
        });

        return table;
    }

    // Export to JSON
    exportJSON() {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            results: this.results,
            stats: this.analyzePerformance(),
        }, null, 2);
    }

    // Export to CSV
    exportCSV() {
        const headers = [
            'Test Name',
            'Token Count',
            'Pattern',
            'Chunk Size',
            'Protocol',
            'Total Time (ms)',
            'First Byte (ms)',
            'Total Bytes',
            'Chunks',
            'Throughput (tok/s)',
            'JSON Size',
            'Compression Ratio',
            'Success',
        ];

        let csv = headers.join(',') + '\n';

        this.results.forEach(({ config, ws, sse }) => {
            const wsRow = [
                config.name,
                config.tokenCount,
                config.pattern,
                config.chunkSize,
                'WS+Huffman',
                ws.totalTime,
                ws.firstByteLatency,
                ws.totalBytes,
                ws.chunksReceived,
                ws.throughput.toFixed(2),
                ws.jsonSize,
                ws.compressionRatio.toFixed(2),
                ws.success,
            ];
            csv += wsRow.join(',') + '\n';

            const sseRow = [
                config.name,
                config.tokenCount,
                config.pattern,
                config.chunkSize,
                'SSE+JSON',
                sse.totalTime,
                sse.firstByteLatency,
                sse.totalBytes,
                sse.chunksReceived,
                sse.throughput.toFixed(2),
                sse.jsonSize,
                sse.compressionRatio.toFixed(2),
                sse.success,
            ];
            csv += sseRow.join(',') + '\n';
        });

        return csv;
    }

    // Save reports
    saveReports(outputDir = './benchmark-results') {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        
        // Save Markdown
        const mdPath = path.join(outputDir, `benchmark-${timestamp}.md`);
        fs.writeFileSync(mdPath, this.generateMarkdownReport());
        console.log(`✓ Markdown report saved to: ${mdPath}`);

        // Save JSON
        const jsonPath = path.join(outputDir, `benchmark-${timestamp}.json`);
        fs.writeFileSync(jsonPath, this.exportJSON());
        console.log(`✓ JSON data saved to: ${jsonPath}`);

        // Save CSV
        const csvPath = path.join(outputDir, `benchmark-${timestamp}.csv`);
        fs.writeFileSync(csvPath, this.exportCSV());
        console.log(`✓ CSV data saved to: ${csvPath}`);

        return { mdPath, jsonPath, csvPath };
    }
}

// Main function to run analysis
async function analyzeResults(resultsFile) {
    console.log('\n=== Benchmark Results Analyzer ===\n');

    let results;
    
    if (resultsFile) {
        // Load from file
        const data = fs.readFileSync(resultsFile, 'utf8');
        const parsed = JSON.parse(data);
        results = parsed.results;
    } else {
        // Run benchmarks and analyze
        const { main } = require('./benchmark_client.js');
        console.log('No results file provided, running benchmarks...\n');
        
        // Intercept results from main
        // This is a simplified version - you might want to modify benchmark_client.js
        // to export results
        throw new Error('Please run benchmark_client.js first and pass the results file');
    }

    const analyzer = new BenchmarkAnalyzer(results);
    
    // Generate and display markdown report
    console.log('\n' + analyzer.generateMarkdownReport());
    
    // Save all reports
    const files = analyzer.saveReports();
    
    console.log('\n✓ Analysis complete!\n');
    
    return files;
}

// CLI
if (require.main === module) {
    const resultsFile = process.argv[2];
    
    analyzeResults(resultsFile).catch(error => {
        console.error('Error:', error.message);
        console.log('\nUsage: node benchmark_analyzer.js [results.json]');
        process.exit(1);
    });
}

module.exports = { BenchmarkAnalyzer, analyzeResults };
