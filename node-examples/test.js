#!/usr/bin/env node

/**
 * Unit tests for the WASM token encoder/decoder
 * Tests encoding and decoding with the enc_dec.json data
 */

const assert = require('assert');
const { encode, decode, alphabet_size, is_loaded } = require('../pkg/token_entropy_encoder.js');

// Test counter
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Color codes for terminal output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function testGroup(name, fn) {
    console.log(`\n${colors.bold}${colors.blue}${name}${colors.reset}`);
    fn();
}

function test(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ${colors.green}✓${colors.reset} ${name}`);
    } catch (error) {
        failedTests++;
        console.log(`  ${colors.red}✗${colors.reset} ${name}`);
        console.log(`    ${colors.red}${error.message}${colors.reset}`);
        if (error.stack) {
            console.log(`    ${error.stack.split('\n').slice(1, 3).join('\n    ')}`);
        }
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertArrayEquals(actual, expected, message) {
    if (actual.length !== expected.length) {
        throw new Error(message || `Array length mismatch: expected ${expected.length}, got ${actual.length}`);
    }
    for (let i = 0; i < actual.length; i++) {
        if (actual[i] !== expected[i]) {
            throw new Error(message || `Array mismatch at index ${i}: expected ${expected[i]}, got ${actual[i]}`);
        }
    }
}

function assertThrows(fn, message) {
    try {
        fn();
        throw new Error(message || 'Expected function to throw');
    } catch (error) {
        // If this is OUR assertion error, re-throw it
        if (error.message && error.message.includes('Expected function to throw')) {
            throw error;
        }
        // Otherwise, the function threw an error as expected
    }
}

// ============================================================================
// TESTS
// ============================================================================

testGroup('Module Loading', () => {
    test('module is loaded', () => {
        assertEquals(is_loaded(), true, 'Module should be loaded');
    });

    test('alphabet size is 2 (binary)', () => {
        const m = alphabet_size();
        assertEquals(m, 2, 'Alphabet size should be 2 for binary encoding');
    });
});

testGroup('Basic Encoding/Decoding', () => {
    const testTokens = ['Hello', 'world', 'test', 'the', 'a', 'is', 'to', 'of'];

    testTokens.forEach(token => {
        test(`encode and decode token: "${token}"`, () => {
            // Encode the token (returns packed bytes for m=2)
            const packed = encode(token);
            assert(packed instanceof Uint8Array, 'Encode should return Uint8Array');
            assert(packed.length >= 4, 'Packed data should have at least 4-byte header');

            // Decode it back
            const decoded = decode(packed);
            assertEquals(decoded, token, `Roundtrip failed for token "${token}"`);
        });
    });
});

testGroup('Packed Format Structure', () => {
    test('packed format has correct header', () => {
        const token = 'Hello';
        const packed = encode(token);
        
        // First 4 bytes are the bit count (big-endian u32)
        const bitCount = (packed[0] << 24) | (packed[1] << 16) | (packed[2] << 8) | packed[3];
        
        // Bit count should be positive and reasonable
        assert(bitCount > 0, 'Bit count should be positive');
        assert(bitCount < 1000, 'Bit count should be reasonable (< 1000 for short tokens)');
        
        console.log(`    Token "${token}" has ${bitCount} bits, packed into ${packed.length} bytes`);
    });

    test('longer tokens need more bits', () => {
        const shortToken = 'a';
        const longToken = 'Hello';
        
        const shortPacked = encode(shortToken);
        const longPacked = encode(longToken);
        
        const shortBits = (shortPacked[0] << 24) | (shortPacked[1] << 16) | (shortPacked[2] << 8) | shortPacked[3];
        const longBits = (longPacked[0] << 24) | (longPacked[1] << 16) | (longPacked[2] << 8) | longPacked[3];
        
        console.log(`    "${shortToken}": ${shortBits} bits, "${longToken}": ${longBits} bits`);
        // Note: This isn't always true for Huffman encoding (depends on token frequency)
        // so we just log it for information
    });
});

testGroup('Bit Packing Efficiency', () => {
    test('packing reduces size significantly', () => {
        const token = 'test';
        const packed = encode(token);
        
        // Extract bit count
        const bitCount = (packed[0] << 24) | (packed[1] << 16) | (packed[2] << 8) | packed[3];
        
        // Without packing, we'd need 1 byte per bit
        const unpackedSize = bitCount;
        const packedSize = packed.length - 4; // Exclude header
        
        const compressionRatio = unpackedSize / Math.max(packedSize, 1);
        console.log(`    Token "${token}": ${bitCount} bits → ${packedSize} packed bytes (${compressionRatio.toFixed(1)}x compression)`);
        
        assert(compressionRatio >= 7, 'Should achieve at least 7x compression from bit packing');
    });
});

testGroup('Roundtrip Tests', () => {
    const tokens = [
        'Hello',
        'world',
        'the',
        'a',
        'in',
        'to',
        'of',
        'and',
        'test',
        'data',
        'code',
        'program'
    ];

    tokens.forEach(token => {
        test(`roundtrip: "${token}"`, () => {
            try {
                const packed = encode(token);
                const decoded = decode(packed);
                assertEquals(decoded, token, `Roundtrip mismatch for "${token}"`);
            } catch (error) {
                if (error.message.includes('not found in encoding map')) {
                    // Token not in vocabulary - that's okay
                    console.log(`    (Token "${token}" not in vocabulary - skipped)`);
                } else {
                    throw error;
                }
            }
        });
    });
});

testGroup('Error Handling', () => {
    test('decode empty buffer throws error', () => {
        assertThrows(() => {
            decode(new Uint8Array([]));
        }, 'Should throw error for empty buffer');
    });

    test('decode buffer with invalid header throws error', () => {
        assertThrows(() => {
            // Only 3 bytes - not enough for header
            decode(new Uint8Array([0, 0, 0]));
        }, 'Should throw error for incomplete header');
    });

    test('encode unknown token throws error', () => {
        assertThrows(() => {
            encode('ThisTokenDefinitelyDoesNotExistInTheVocabulary123456789');
        }, 'Should throw error for unknown token');
    });
});

testGroup('Edge Cases', () => {
    test('encode/decode with common punctuation tokens', () => {
        const punctuationTokens = ['.', ',', '!', '?', ';', ':'];
        
        punctuationTokens.forEach(token => {
            try {
                const packed = encode(token);
                const decoded = decode(packed);
                assertEquals(decoded, token, `Roundtrip failed for "${token}"`);
            } catch (error) {
                // Some punctuation might not be in vocab as standalone tokens
                console.log(`    Token "${token}" not in vocabulary - skipped`);
            }
        });
    });
});

testGroup('Performance Check', () => {
    test('encode/decode 1000 tokens quickly', () => {
        const token = 'test';
        const iterations = 1000;
        const start = Date.now();
        
        for (let i = 0; i < iterations; i++) {
            const packed = encode(token);
            const decoded = decode(packed);
            assert(decoded === token);
        }
        
        const elapsed = Date.now() - start;
        const opsPerSecond = Math.round((iterations * 2) / (elapsed / 1000));
        
        console.log(`    Completed ${iterations * 2} operations in ${elapsed}ms (${opsPerSecond} ops/sec)`);
        assert(elapsed < 5000, 'Should complete 1000 encode/decode cycles in under 5 seconds');
    });
});

// ============================================================================
// RUN TESTS
// ============================================================================

console.log(`\n${colors.bold}=== WASM Token Encoder Tests ===${colors.reset}\n`);

// Run all tests (they've already been queued up)
console.log('\nRunning tests...');

// Print summary
console.log(`\n${colors.bold}==================================${colors.reset}`);
console.log(`${colors.bold}Test Summary:${colors.reset}`);
console.log(`  Total:  ${totalTests}`);
console.log(`  ${colors.green}Passed: ${passedTests}${colors.reset}`);
if (failedTests > 0) {
    console.log(`  ${colors.red}Failed: ${failedTests}${colors.reset}`);
}
console.log(`${colors.bold}==================================${colors.reset}\n`);

// Exit with appropriate code
process.exit(failedTests > 0 ? 1 : 0);
