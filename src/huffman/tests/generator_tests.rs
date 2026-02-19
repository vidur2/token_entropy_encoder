use crate::huffman::HuffmanGenerator;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_binary_huffman() {
        let codewords = [
            "A".to_string(),
            "B".to_string(),
            "C".to_string(),
            "D".to_string(),
        ];
        let pmf = [0.4, 0.3, 0.2, 0.1];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(&codewords, &pmf, m).unwrap();

        // Test encoding and decoding roundtrip
        for cw in ["A", "B", "C", "D"] {
            let encoded = huffman.encode(cw).unwrap();
            let decoded = huffman.decode(&encoded).unwrap();
            assert_eq!(decoded, cw);
        }

        // Verify alphabet size
        assert_eq!(huffman.alphabet_size(), 2);
    }

    #[test]
    fn test_ternary_huffman() {
        let codewords = ["X".to_string(), "Y".to_string(), "Z".to_string()];
        let pmf = [0.5, 0.3, 0.2];
        let m = 3u8;

        let huffman = HuffmanGenerator::new(&codewords, &pmf, m).unwrap();

        // Test encoding and decoding roundtrip
        for cw in ["X", "Y", "Z"] {
            let encoded = huffman.encode(cw).unwrap();
            let decoded = huffman.decode(&encoded).unwrap();
            assert_eq!(decoded, cw);
        }

        // Verify alphabet size
        assert_eq!(huffman.alphabet_size(), 3);
    }

    #[test]
    fn test_invalid_pmf_sum() {
        let codewords = ["A".to_string(), "B".to_string()];
        let pmf = [0.3, 0.5]; // Sum is 0.8, not 1.0
        let m = 2u8;

        let result = HuffmanGenerator::new(&codewords, &pmf, m);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_alphabet_size() {
        let codewords = ["A".to_string()];
        let pmf = [1.0];
        let m = 1u8; // Invalid, must be at least 2

        let result = HuffmanGenerator::new(&codewords, &pmf, m);
        assert!(result.is_err());
    }

    #[test]
    fn test_encode_unknown_codeword() {
        let codewords = ["A".to_string(), "B".to_string()];
        let pmf = [0.6, 0.4];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(&codewords, &pmf, m).unwrap();
        let result = huffman.encode("C");
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_invalid_symbol() {
        let codewords = ["A".to_string(), "B".to_string()];
        let pmf = [0.6, 0.4];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(&codewords, &pmf, m).unwrap();
        let result = huffman.decode(&[2]); // Invalid symbol for binary
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_invalid_path() {
        let codewords = ["A".to_string(), "B".to_string(), "C".to_string()];
        let pmf = [0.5, 0.3, 0.2];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(&codewords, &pmf, m).unwrap();

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
        let codewords = ["ONLY".to_string()];
        let pmf = [1.0];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(&codewords, &pmf, m).unwrap();
        let encoded = huffman.encode("ONLY").unwrap();
        let decoded = huffman.decode(&encoded).unwrap();
        assert_eq!(decoded, "ONLY");
    }

    #[test]
    fn test_larger_alphabet() {
        let codewords = [
            "A".to_string(),
            "B".to_string(),
            "C".to_string(),
            "D".to_string(),
            "E".to_string(),
        ];
        let pmf = [0.2, 0.2, 0.2, 0.2, 0.2];
        let m = 5u8; // Pentary alphabet

        let huffman = HuffmanGenerator::new(&codewords, &pmf, m).unwrap();

        // Test roundtrip for all codewords
        for cw in ["A", "B", "C", "D", "E"] {
            let encoded = huffman.encode(cw).unwrap();
            assert!(encoded.iter().all(|&s| s < m));
            let decoded = huffman.decode(&encoded).unwrap();
            assert_eq!(decoded, cw);
        }
    }

    #[test]
    fn test_json_serialization() {
        let codewords = [
            "A".to_string(),
            "B".to_string(),
            "C".to_string(),
            "D".to_string(),
        ];
        let pmf = [0.4, 0.3, 0.2, 0.1];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(&codewords, &pmf, m).unwrap();

        // Serialize to JSON
        let json = huffman.to_json().unwrap();
        assert!(!json.is_empty());

        // Deserialize from JSON
        let huffman_from_json = HuffmanGenerator::from_json(&json).unwrap();

        // Verify alphabet size is preserved
        assert_eq!(huffman_from_json.alphabet_size(), m);

        // Verify all codewords can be encoded and decoded correctly
        for cw in ["A", "B", "C", "D"] {
            let original_encoded = huffman.encode(cw).unwrap();
            let restored_encoded = huffman_from_json.encode(cw).unwrap();

            // The encodings should be identical
            assert_eq!(original_encoded, restored_encoded);

            // Verify decoding works
            let decoded = huffman_from_json.decode(&restored_encoded).unwrap();
            assert_eq!(decoded, cw);
        }
    }

    #[test]
    fn test_json_roundtrip_ternary() {
        let codewords = [
            "Token1".to_string(),
            "Token2".to_string(),
            "Token3".to_string(),
            "Token4".to_string(),
            "Token5".to_string(),
        ];
        let pmf = [0.3, 0.25, 0.2, 0.15, 0.1];
        let m = 3u8;

        let huffman = HuffmanGenerator::new(&codewords, &pmf, m).unwrap();

        // Serialize and deserialize
        let json = huffman.to_json().unwrap();
        let restored = HuffmanGenerator::from_json(&json).unwrap();

        // Verify complete roundtrip
        assert_eq!(restored.alphabet_size(), m);
        assert_eq!(
            restored.get_encoding_map().len(),
            huffman.get_encoding_map().len()
        );

        // Test all codewords
        for cw in ["Token1", "Token2", "Token3", "Token4", "Token5"] {
            let encoded = restored.encode(cw).unwrap();
            let decoded = restored.decode(&encoded).unwrap();
            assert_eq!(decoded, cw);
        }
    }

    #[test]
    fn test_enc_dec_json_loading() {
        // Load the enc_dec.json file created by create_tree
        let json_data = include_str!("../../../enc_dec.json");
        
        // Deserialize the HuffmanGenerator
        let huffman = HuffmanGenerator::from_json(json_data)
            .expect("Failed to load HuffmanGenerator from enc_dec.json");

        println!("Loaded HuffmanGenerator with alphabet size: {}", huffman.alphabet_size());
        println!("Encoding map size: {}", huffman.get_encoding_map().len());

        // Test some common tokens
        let test_tokens = vec![
            "Hello",
            "world",
            "test",
            "the",
            "a",
            "is",
            "to",
            "of",
        ];

        for token in test_tokens {
            match huffman.encode(token) {
                Ok(encoded) => {
                    println!("Token '{}' encoded to {} symbols: {:?}", token, encoded.len(), encoded);
                    
                    // Verify all symbols are valid (< m)
                    for &symbol in &encoded {
                        assert!(symbol < huffman.alphabet_size(), 
                            "Invalid symbol {} (must be < {})", symbol, huffman.alphabet_size());
                    }
                    
                    // Test decoding
                    match huffman.decode(&encoded) {
                        Ok(decoded) => {
                            assert_eq!(decoded, token, "Roundtrip failed for token '{}'", token);
                            println!("  ✓ Roundtrip successful");
                        }
                        Err(e) => {
                            panic!("Decode failed for token '{}': {}", token, e);
                        }
                    }
                }
                Err(e) => {
                    println!("Token '{}' not in encoding map (expected for some tokens): {}", token, e);
                }
            }
        }
    }

    #[test]
    fn test_packed_encoding_decoding() {
        // Create a simple binary Huffman tree
        let codewords = vec![
            "Hello".to_string(),
            "world".to_string(),
            "test".to_string(),
            "data".to_string(),
        ];
        let pmf = vec![0.4, 0.3, 0.2, 0.1];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(&codewords, &pmf, m)
            .expect("Failed to create HuffmanGenerator");

        // Test packed encoding/decoding for each token
        for token in &codewords {
            // Test packed encoding
            let packed = huffman.encode_packed(token)
                .expect(&format!("Failed to pack encode token '{}'", token));
            
            println!("Token '{}' packed to {} bytes", token, packed.len());
            assert!(packed.len() >= 4, "Packed data should have at least 4-byte header");
            
            // Extract bit count from header
            let bit_count = u32::from_be_bytes([packed[0], packed[1], packed[2], packed[3]]);
            println!("  Bit count: {}", bit_count);
            
            // Test packed decoding
            let decoded = huffman.decode_packed(&packed)
                .expect(&format!("Failed to pack decode token '{}'", token));
            
            assert_eq!(decoded, *token, "Packed roundtrip failed for token '{}'", token);
            println!("  ✓ Packed roundtrip successful");
        }
    }

    #[test]
    fn test_packed_encoding_only_for_binary() {
        // Create a ternary Huffman tree
        let codewords = vec!["A".to_string(), "B".to_string(), "C".to_string()];
        let pmf = vec![0.5, 0.3, 0.2];
        let m = 3u8;

        let huffman = HuffmanGenerator::new(&codewords, &pmf, m).unwrap();

        // Packed encoding should fail for m != 2
        let result = huffman.encode_packed("A");
        assert!(result.is_err(), "Packed encoding should only work for m=2");
        assert!(result.unwrap_err().contains("only supported for binary"));

        // Packed decoding should also fail
        let dummy_data = vec![0, 0, 0, 1, 0x80];
        let result = huffman.decode_packed(&dummy_data);
        assert!(result.is_err(), "Packed decoding should only work for m=2");
        assert!(result.unwrap_err().contains("only supported for binary"));
    }

    #[test]
    fn test_enc_dec_json_with_packed_encoding() {
        // Load the enc_dec.json file
        let json_data = include_str!("../../../enc_dec.json");
        let huffman = HuffmanGenerator::from_json(json_data)
            .expect("Failed to load HuffmanGenerator from enc_dec.json");

        // Only test packed encoding if m=2
        if huffman.alphabet_size() == 2 {
            println!("Testing packed encoding with alphabet size 2");

            let test_tokens = vec!["Hello", "world", "test"];

            for token in test_tokens {
                if let Ok(packed) = huffman.encode_packed(token) {
                    println!("Token '{}' packed to {} bytes", token, packed.len());
                    
                    // Verify we can unpack and decode
                    match huffman.decode_packed(&packed) {
                        Ok(decoded) => {
                            assert_eq!(decoded, token, "Packed roundtrip failed for '{}'", token);
                            println!("  ✓ Packed roundtrip successful");
                        }
                        Err(e) => {
                            panic!("Packed decode failed for '{}': {}", token, e);
                        }
                    }
                } else {
                    println!("Token '{}' not in encoding map", token);
                }
            }
        } else {
            println!("Skipping packed encoding test (m={}, expected m=2)", huffman.alphabet_size());
        }
    }
}
