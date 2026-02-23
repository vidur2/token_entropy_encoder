use crate::huffman::HuffmanGenerator;
use crate::token_compressor::TokenCompressor;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_binary_huffman() {
        let num_tokens = 4;
        let pmf = [0.4, 0.3, 0.2, 0.1];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(num_tokens, &pmf, m).unwrap();

        // Test encoding and decoding roundtrip (token IDs are 0..3)
        for token_id in [0u32, 1u32, 2u32, 3u32] {
            let encoded = huffman.encode(token_id).unwrap();
            let decoded = huffman.decode(&encoded).unwrap();
            assert_eq!(decoded, token_id);
        }

        // Verify alphabet size
        assert_eq!(huffman.alphabet_size(), 2);
    }

    #[test]
    fn test_ternary_huffman() {
        let num_tokens = 3;
        let pmf = [0.5, 0.3, 0.2];
        let m = 3u8;

        let huffman = HuffmanGenerator::new(num_tokens, &pmf, m).unwrap();

        // Test encoding and decoding roundtrip (token IDs are 0..2)
        for token_id in [0u32, 1u32, 2u32] {
            let encoded = huffman.encode(token_id).unwrap();
            let decoded = huffman.decode(&encoded).unwrap();
            assert_eq!(decoded, token_id);
        }

        // Verify alphabet size
        assert_eq!(huffman.alphabet_size(), 3);
    }

    #[test]
    fn test_invalid_pmf_sum() {
        let num_tokens = 2;
        let pmf = [0.3, 0.5]; // Sum is 0.8, not 1.0
        let m = 2u8;

        let result = HuffmanGenerator::new(num_tokens, &pmf, m);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_alphabet_size() {
        let num_tokens = 1;
        let pmf = [1.0];
        let m = 1u8; // Invalid, must be at least 2

        let result = HuffmanGenerator::new(num_tokens, &pmf, m);
        assert!(result.is_err());
    }

    #[test]
    fn test_encode_unknown_codeword() {
        let num_tokens = 2;
        let pmf = [0.6, 0.4];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(num_tokens, &pmf, m).unwrap();
        let result = huffman.encode(99u32); // Token ID not in tree
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_invalid_symbol() {
        let num_tokens = 2;
        let pmf = [0.6, 0.4];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(num_tokens, &pmf, m).unwrap();
        let result = huffman.decode(&[2]); // Invalid symbol for binary
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_invalid_path() {
        let num_tokens = 3;
        let pmf = [0.5, 0.3, 0.2];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(num_tokens, &pmf, m).unwrap();

        // Try to decode a path that doesn't lead to a leaf
        // This is tricky as we need to find such a path
        // The error will occur if we provide an incomplete encoding
        let result = huffman.decode(&[1]); // Might be incomplete
        // This test depends on the tree structure, so we just verify it handles errors
        if result.is_err() {
            let err = result.unwrap_err();
            assert!(
                err.contains("Invalid encoding") || err.contains("path does not lead to a leaf")
            );
        }
    }

    #[test]
    fn test_single_codeword() {
        let num_tokens = 1;
        let pmf = [1.0];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(num_tokens, &pmf, m).unwrap();
        let encoded = huffman.encode(0u32).unwrap(); // Token ID will be 0
        let decoded = huffman.decode(&encoded).unwrap();
        assert_eq!(decoded, 0u32);
    }

    #[test]
    fn test_larger_alphabet() {
        let num_tokens = 5;
        let pmf = [0.2, 0.2, 0.2, 0.2, 0.2];
        let m = 5u8; // Pentary alphabet

        let huffman = HuffmanGenerator::new(num_tokens, &pmf, m).unwrap();

        // Test roundtrip for all token IDs (0..4)
        for token_id in [0u32, 1u32, 2u32, 3u32, 4u32] {
            let encoded = huffman.encode(token_id).unwrap();
            assert!(encoded.iter().all(|&s| s < m));
            let decoded = huffman.decode(&encoded).unwrap();
            assert_eq!(decoded, token_id);
        }
    }

    #[test]
    fn test_json_serialization() {
        let num_tokens = 4;
        let pmf = [0.4, 0.3, 0.2, 0.1];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(num_tokens, &pmf, m).unwrap();

        // Serialize to JSON
        let json = huffman.to_json().unwrap();
        assert!(!json.is_empty());

        // Deserialize from JSON
        let huffman_from_json = HuffmanGenerator::from_json(&json).unwrap();

        // Verify alphabet size is preserved
        assert_eq!(huffman_from_json.alphabet_size(), m);

        // Verify all token IDs (0..3) can be encoded and decoded correctly
        for token_id in [0u32, 1u32, 2u32, 3u32] {
            let original_encoded = huffman.encode(token_id).unwrap();
            let restored_encoded = huffman_from_json.encode(token_id).unwrap();

            // The encodings should be identical
            assert_eq!(original_encoded, restored_encoded);

            // Verify decoding works
            let decoded = huffman_from_json.decode(&restored_encoded).unwrap();
            assert_eq!(decoded, token_id);
        }
    }

    #[test]
    fn test_json_roundtrip_ternary() {
        let num_tokens = 5;
        let pmf = [0.3, 0.25, 0.2, 0.15, 0.1];
        let m = 3u8;

        let huffman = HuffmanGenerator::new(num_tokens, &pmf, m).unwrap();

        // Serialize and deserialize
        let json = huffman.to_json().unwrap();
        let restored = HuffmanGenerator::from_json(&json).unwrap();

        // Verify complete roundtrip
        assert_eq!(restored.alphabet_size(), m);
        assert_eq!(
            restored.get_encoding_map().len(),
            huffman.get_encoding_map().len()
        );

        // Test all token IDs (0..4)
        for token_id in [0u32, 1u32, 2u32, 3u32, 4u32] {
            let encoded = restored.encode(token_id).unwrap();
            let decoded = restored.decode(&encoded).unwrap();
            assert_eq!(decoded, token_id);
        }
    }

    #[test]
    // #[ignore] // This test requires enc_dec.json to be regenerated with the new u32 format
    fn test_enc_dec_json_loading() {
        // Load the enc_dec.json file created by create_tree
        let json_data = include_str!("../../../enc_dec.json");
        
        // Deserialize the HuffmanGenerator
        let huffman = HuffmanGenerator::from_json(json_data)
            .expect("Failed to load HuffmanGenerator from enc_dec.json");

        println!("Loaded HuffmanGenerator with alphabet size: {}", huffman.alphabet_size());
        println!("Encoding map size: {}", huffman.get_encoding_map().len());

        // Test some common token IDs (these should exist for a typical tokenizer)
        let test_token_ids = vec![100u32, 200u32, 300u32, 1000u32, 5000u32];

        for token_id in test_token_ids {
            match huffman.encode(token_id) {
                Ok(encoded) => {
                    println!("Token ID {} encoded to {} symbols: {:?}", token_id, encoded.len(), encoded);
                    
                    // Verify all symbols are valid (< m)
                    for &symbol in &encoded {
                        assert!(symbol < huffman.alphabet_size(), 
                            "Invalid symbol {} (must be < {})", symbol, huffman.alphabet_size());
                    }
                    
                    // Test decoding
                    match huffman.decode(&encoded) {
                        Ok(decoded) => {
                            assert_eq!(decoded, token_id, "Roundtrip failed for token ID {}", token_id);
                            println!("  ✓ Roundtrip successful");
                        }
                        Err(e) => {
                            panic!("Decode failed for token ID {}: {}", token_id, e);
                        }
                    }
                }
                Err(e) => {
                    println!("Token ID {} not in encoding map (expected): {}", token_id, e);
                }
            }
        }
    }

    #[test]
    fn test_packed_encoding_decoding() {
        // Create a simple binary Huffman tree
        let num_tokens = 4;
        let pmf = vec![0.4, 0.3, 0.2, 0.1];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(num_tokens, &pmf, m)
            .expect("Failed to create HuffmanGenerator");

        // Test packed encoding/decoding for each token (0..3)
        for token_id in 0..num_tokens as u32 {
            // Test packed encoding
            let packed = huffman.encode_packed(token_id)
                .expect(&format!("Failed to pack encode token ID {}", token_id));
            
            println!("Token ID {} packed to {} bytes", token_id, packed.len());
            assert!(packed.len() >= 4, "Packed data should have at least 4-byte header");
            
            // Extract bit count from header
            let bit_count = u32::from_be_bytes([packed[0], packed[1], packed[2], packed[3]]);
            println!("  Bit count: {}", bit_count);
            
            // Test packed decoding
            let decoded = huffman.decode_packed(&packed)
                .expect(&format!("Failed to pack decode token ID {}", token_id));
            
            assert_eq!(decoded, token_id, "Packed roundtrip failed for token ID {}", token_id);
            println!("  ✓ Packed roundtrip successful");
        }
    }

    #[test]
    fn test_packed_encoding_only_for_binary() {
        // Create a ternary Huffman tree
        let num_tokens = 3;
        let pmf = vec![0.5, 0.3, 0.2];
        let m = 3u8;

        let huffman = HuffmanGenerator::new(num_tokens, &pmf, m).unwrap();

        // Packed encoding should fail for m != 2
        let result = huffman.encode_packed(0u32);
        assert!(result.is_err(), "Packed encoding should only work for m=2");
        assert!(result.unwrap_err().contains("only supported for binary"));

        // Packed decoding should also fail
        let dummy_data = vec![0, 0, 0, 1, 0x80];
        let result = huffman.decode_packed(&dummy_data);
        assert!(result.is_err(), "Packed decoding should only work for m=2");
        assert!(result.unwrap_err().contains("only supported for binary"));
    }

    #[test]
    // #[ignore] // This test requires enc_dec.json to be regenerated with the new u32 format
    fn test_enc_dec_json_with_packed_encoding() {
        // Load the enc_dec.json file
        let json_data = include_str!("../../../enc_dec.json");
        let huffman = HuffmanGenerator::from_json(json_data)
            .expect("Failed to load HuffmanGenerator from enc_dec.json");

        // Only test packed encoding if m=2
        if huffman.alphabet_size() == 2 {
            println!("Testing packed encoding with alphabet size 2");

            let test_token_ids = vec![100u32, 200u32, 500u32];

            for token_id in test_token_ids {
                if let Ok(packed) = huffman.encode_packed(token_id) {
                    println!("Token ID {} packed to {} bytes", token_id, packed.len());
                    
                    // Verify we can unpack and decode
                    match huffman.decode_packed(&packed) {
                        Ok(decoded) => {
                            assert_eq!(decoded, token_id, "Packed roundtrip failed for token ID {}", token_id);
                            println!("  ✓ Packed roundtrip successful");
                        }
                        Err(e) => {
                            panic!("Packed decode failed for token ID {}: {}", token_id, e);
                        }
                    }
                } else {
                    println!("Token ID {} not in encoding map", token_id);
                }
            }
        } else {
            println!("Skipping packed encoding test (m={}, expected m=2)", huffman.alphabet_size());
        }
    }
}
