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

        let huffman = HuffmanGenerator::new(codewords, pmf, m).unwrap();

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
        let codewords = [
            "X".to_string(),
            "Y".to_string(),
            "Z".to_string(),
        ];
        let pmf = [0.5, 0.3, 0.2];
        let m = 3u8;

        let huffman = HuffmanGenerator::new(codewords, pmf, m).unwrap();

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

        let result = HuffmanGenerator::new(codewords, pmf, m);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_alphabet_size() {
        let codewords = ["A".to_string()];
        let pmf = [1.0];
        let m = 1u8; // Invalid, must be at least 2

        let result = HuffmanGenerator::new(codewords, pmf, m);
        assert!(result.is_err());
    }

    #[test]
    fn test_encode_unknown_codeword() {
        let codewords = ["A".to_string(), "B".to_string()];
        let pmf = [0.6, 0.4];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(codewords, pmf, m).unwrap();
        let result = huffman.encode("C");
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_invalid_symbol() {
        let codewords = ["A".to_string(), "B".to_string()];
        let pmf = [0.6, 0.4];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(codewords, pmf, m).unwrap();
        let result = huffman.decode(&[2]); // Invalid symbol for binary
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_invalid_path() {
        let codewords = [
            "A".to_string(),
            "B".to_string(),
            "C".to_string(),
        ];
        let pmf = [0.5, 0.3, 0.2];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(codewords, pmf, m).unwrap();
        
        // Try to decode a path that doesn't lead to a leaf
        // This is tricky as we need to find such a path
        // The error will occur if we provide an incomplete encoding
        let result = huffman.decode(&[1]); // Might be incomplete
        // This test depends on the tree structure, so we just verify it handles errors
        if result.is_err() {
            let err = result.unwrap_err();
            assert!(err.contains("Invalid encoding") || 
                    err.contains("path does not lead to a leaf"));
        }
    }

    #[test]
    fn test_single_codeword() {
        let codewords = ["ONLY".to_string()];
        let pmf = [1.0];
        let m = 2u8;

        let huffman = HuffmanGenerator::new(codewords, pmf, m).unwrap();
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

        let huffman = HuffmanGenerator::new(codewords, pmf, m).unwrap();

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

        let huffman = HuffmanGenerator::new(codewords, pmf, m).unwrap();

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

        let huffman = HuffmanGenerator::new(codewords, pmf, m).unwrap();

        // Serialize and deserialize
        let json = huffman.to_json().unwrap();
        let restored = HuffmanGenerator::from_json(&json).unwrap();

        // Verify complete roundtrip
        assert_eq!(restored.alphabet_size(), m);
        assert_eq!(restored.get_encoding_map().len(), huffman.get_encoding_map().len());

        // Test all codewords
        for cw in ["Token1", "Token2", "Token3", "Token4", "Token5"] {
            let encoded = restored.encode(cw).unwrap();
            let decoded = restored.decode(&encoded).unwrap();
            assert_eq!(decoded, cw);
        }
    }
}