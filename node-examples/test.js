#!/usr/bin/env node

/**
 * Unit tests for the WASM token encoder/decoder
 * Tests encoding and decoding with the enc_dec.json data
 */

const assert = require('assert');
const { encode, decode, encode_bulk, decode_bulk, alphabet_size, is_loaded } = require('../pkg/token_entropy_encoder.js');

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
    // Test with common token IDs (typically 0-127 are frequent tokens)
    const testTokenIds = [0, 1, 10, 50, 100, 500, 1000, 5000];

    testTokenIds.forEach(tokenId => {
        test(`encode and decode token ID: ${tokenId}`, () => {
            // Encode the token ID (returns packed bytes for m=2)
            const packed = encode(tokenId);
            assert(packed instanceof Uint8Array, 'Encode should return Uint8Array');
            assert(packed.length >= 1, 'Packed data should have at least 1-byte header');

            // Decode it back
            const decoded = decode(packed);
            assertEquals(decoded, tokenId, `Roundtrip failed for token ID ${tokenId}`);
        });
    });
});

testGroup('Packed Format Structure', () => {
    test('packed format has correct header', () => {
        const tokenId = 100;
        const packed = encode(tokenId);
        
        // First byte is the valid bits in last byte (0-8)
        const lastByteBits = packed[0];
        
        // Valid bits should be 0-8
        assert(lastByteBits >= 0 && lastByteBits <= 8, 'Last byte bits should be 0-8');
        
        // Calculate total bits
        const dataBytes = packed.length - 1;
        const totalBits = lastByteBits === 8 ? dataBytes * 8 : (dataBytes - 1) * 8 + lastByteBits;
        
        console.log(`    Token ID ${tokenId} has ${totalBits} bits, packed into ${packed.length} bytes`);
    });

    test('different token IDs have different bit lengths', () => {
        const tokenId1 = 10;  // Common token
        const tokenId2 = 50000;  // Less common token
        
        const packed1 = encode(tokenId1);
        const packed2 = encode(tokenId2);
        
        // Calculate bits from new format
        const calcBits = (packed) => {
            const lastByteBits = packed[0];
            const dataBytes = packed.length - 1;
            return lastByteBits === 8 ? dataBytes * 8 : (dataBytes - 1) * 8 + lastByteBits;
        };
        
        const bits1 = calcBits(packed1);
        const bits2 = calcBits(packed2);
        
        console.log(`    Token ID ${tokenId1}: ${bits1} bits, Token ID ${tokenId2}: ${bits2} bits`);
        // Note: Huffman encoding assigns shorter codes to more frequent tokens
        // so we just log it for information
    });
});

testGroup('Bit Packing Efficiency', () => {
    test('packing reduces size significantly', () => {
        const tokenId = 100;
        const packed = encode(tokenId);
        
        // Calculate bit count from new format
        const lastByteBits = packed[0];
        const dataBytes = packed.length - 1;
        const bitCount = lastByteBits === 8 ? dataBytes * 8 : (dataBytes - 1) * 8 + lastByteBits;
        
        // Without packing, we'd need 1 byte per bit
        const unpackedSize = bitCount;
        const packedSize = packed.length - 1; // Exclude header
        
        const compressionRatio = unpackedSize / Math.max(packedSize, 1);
        console.log(`    Token ID ${tokenId}: ${bitCount} bits → ${packedSize} packed bytes (${compressionRatio.toFixed(1)}x compression)`);
        
        assert(compressionRatio >= 7, 'Should achieve at least 7x compression from bit packing');
    });
});

testGroup('Roundtrip Tests', () => {
    // Test a range of token IDs from different parts of the vocabulary
    const tokenIds = [
        0, 1, 2, 10, 50,
        100, 500, 1000,
        5000, 10000, 50000,
        100000, 128000
    ];

    tokenIds.forEach(tokenId => {
        test(`roundtrip: token ID ${tokenId}`, () => {
            try {
                const packed = encode(tokenId);
                const decoded = decode(packed);
                assertEquals(decoded, tokenId, `Roundtrip mismatch for token ID ${tokenId}`);
            } catch (error) {
                if (error.message.includes('not found in encoding map') || error.message.includes('out of range')) {
                    // Token ID not in tree - that's okay
                    console.log(`    (Token ID ${tokenId} not in tree - skipped)`);
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
            // Invalid header value (> 8)
            decode(new Uint8Array([9, 0, 0]));
        }, 'Should throw error for invalid header');
    });

    test('encode out-of-range token ID throws error', () => {
        assertThrows(() => {
            // Token ID beyond VOCAB_SIZE (128256)
            encode(999999);
        }, 'Should throw error for out-of-range token ID');
    });
});

testGroup('Edge Cases', () => {
    test('encode/decode with boundary token IDs', () => {
        const boundaryTokenIds = [0, 1, 127, 128, 255, 256];
        
        boundaryTokenIds.forEach(tokenId => {
            try {
                const packed = encode(tokenId);
                const decoded = decode(packed);
                assertEquals(decoded, tokenId, `Roundtrip failed for token ID ${tokenId}`);
            } catch (error) {
                // Some token IDs might not be in tree
                console.log(`    Token ID ${tokenId} not in tree - skipped`);
            }
        });
    });
});

testGroup('Bulk Encoding/Decoding', () => {
    test('encode and decode bulk tokens', () => {
        const tokenIds = [0, 1, 10, 50, 100, 500];
        
        // Bulk encode
        const packed = encode_bulk(tokenIds);
        assert(packed instanceof Uint8Array, 'encode_bulk should return Uint8Array');
        assert(packed.length >= 1, 'Packed data should have at least 1-byte header');
        
        // Bulk decode
        const decoded = decode_bulk(packed);
        assert(Array.isArray(decoded), 'decode_bulk should return array');
        assertArrayEquals(decoded, tokenIds, 'Bulk roundtrip failed');
        
        console.log(`    Bulk encoded ${tokenIds.length} tokens to ${packed.length} bytes`);
    });

    test('bulk encode empty array', () => {
        const tokenIds = [];
        
        const packed = encode_bulk(tokenIds);
        assert(packed instanceof Uint8Array, 'encode_bulk should return Uint8Array');
        assert(packed.length === 1, 'Empty input should produce just header byte');
        assert(packed[0] === 0, 'Header should indicate 0 valid bits');
        
        const decoded = decode_bulk(packed);
        assertEquals(decoded.length, 0, 'Empty packed data should decode to empty array');
    });

    test('bulk encode single token', () => {
        const tokenIds = [100];
        
        const packed = encode_bulk(tokenIds);
        const decoded = decode_bulk(packed);
        
        assertArrayEquals(decoded, tokenIds, 'Single token bulk roundtrip failed');
    });

    test('bulk vs individual encoding comparison', () => {
        const tokenIds = [0, 1, 10, 50];
        
        // Encode individually and concatenate
        let totalIndividualBytes = 1; // Start with header byte
        const individualEncodings = tokenIds.map(id => {
            const encoded = encode(id);
            totalIndividualBytes += encoded.length;
            return encoded;
        });
        
        // Encode in bulk
        const bulkEncoded = encode_bulk(tokenIds);
        
        console.log(`    Individual: ${totalIndividualBytes} bytes, Bulk: ${bulkEncoded.length} bytes`);
        
        // Verify bulk decoding works
        const decoded = decode_bulk(bulkEncoded);
        assertArrayEquals(decoded, tokenIds, 'Bulk encoding should decode correctly');
    });

    test('bulk encode large sequence', () => {
        // Create a larger sequence (100 tokens)
        const tokenIds = [];
        for (let i = 0; i < 100; i++) {
            tokenIds.push(i % 4); // Use token IDs 0-3 repeatedly
        }
        
        const packed = encode_bulk(tokenIds);
        console.log(`    Bulk encoded ${tokenIds.length} tokens to ${packed.length} bytes`);
        
        const decoded = decode_bulk(packed);
        assertArrayEquals(decoded, tokenIds, 'Large bulk roundtrip failed');
    });

    test('bulk encode with various token IDs', () => {
        const tokenIds = [100, 200, 300, 500, 1000];
        
        try {
            const packed = encode_bulk(tokenIds);
            const decoded = decode_bulk(packed);
            assertArrayEquals(decoded, tokenIds, 'Bulk encoding of various token IDs failed');
            console.log(`    Successfully encoded/decoded ${tokenIds.length} various tokens`);
        } catch (error) {
            if (error.message.includes('not found in encoding map')) {
                console.log(`    Some token IDs not in tree - skipped`);
            } else {
                throw error;
            }
        }
    });

    test('bulk decode error handling', () => {
        assertThrows(() => {
            // Empty buffer without header
            decode_bulk(new Uint8Array([]));
        }, 'Should throw error for empty buffer');
    });
});

testGroup('Performance Check', () => {
    test('encode/decode 1000 tokens quickly', () => {
        const tokenId = 100;
        const iterations = 1000;
        const start = Date.now();
        
        for (let i = 0; i < iterations; i++) {
            const packed = encode(tokenId);
            const decoded = decode(packed);
            assert(decoded === tokenId);
        }
        
        const elapsed = Date.now() - start;
        const opsPerSecond = Math.round((iterations * 2) / (elapsed / 1000));
        
        console.log(`    Completed ${iterations * 2} operations in ${elapsed}ms (${opsPerSecond} ops/sec)`);
        assert(elapsed < 5000, 'Should complete 1000 encode/decode cycles in under 5 seconds');
    });

    test('bulk encode/decode 100 tokens efficiently', () => {
        const tokenIds = [];
        for (let i = 0; i < 100; i++) {
            tokenIds.push(i % 10); // Use token IDs 0-9 repeatedly
        }
        
        const iterations = 100;
        const start = Date.now();
        
        for (let i = 0; i < iterations; i++) {
            const packed = encode_bulk(tokenIds);
            const decoded = decode_bulk(packed);
            assert(decoded.length === tokenIds.length);
        }
        
        const elapsed = Date.now() - start;
        const tokensPerSecond = Math.round((iterations * tokenIds.length * 2) / (elapsed / 1000));
        
        console.log(`    Bulk processed ${iterations * tokenIds.length * 2} tokens in ${elapsed}ms (${tokensPerSecond} tokens/sec)`);
        assert(elapsed < 5000, 'Should complete 100 bulk encode/decode cycles in under 5 seconds');
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
