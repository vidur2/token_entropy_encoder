use token_entropy_encoder::huffman::HuffmanGenerator;

fn main() -> Result<(), String> {
    println!("=== Binary Huffman Encoding (m=2) ===");

    // Example with binary alphabet
    let codewords = [
        "A".to_string(),
        "B".to_string(),
        "C".to_string(),
        "D".to_string(),
    ];

    let pmf = [0.4, 0.3, 0.2, 0.1];
    let m = 2u8; // binary

    let huffman = HuffmanGenerator::new(&codewords, &pmf, m)?;

    println!("Encoding map:");
    for (codeword, encoding) in huffman.get_encoding_map() {
        println!("  '{}' -> {:?}", codeword, encoding);
    }

    // Test encoding
    println!("\nEncoding tests:");
    for cw in ["A", "B", "C", "D"] {
        let encoded = huffman.encode(cw)?;
        println!("  encode('{}') = {:?}", cw, encoded);

        // Test decoding
        let decoded = huffman.decode(&encoded)?;
        println!("  decode({:?}) = '{}'", encoded, decoded);
        assert_eq!(decoded, cw);
    }

    println!("\n=== Ternary Huffman Encoding (m=3) ===");

    // Example with ternary alphabet
    let codewords_ternary = [
        "X".to_string(),
        "Y".to_string(),
        "Z".to_string(),
        "W".to_string(),
    ];

    let pmf_ternary = [0.4, 0.3, 0.2, 0.1];
    let m_ternary = 3u8; // ternary

    let huffman_ternary = HuffmanGenerator::new(&codewords_ternary, &pmf_ternary, m_ternary)?;

    println!("Encoding map:");
    for (codeword, encoding) in huffman_ternary.get_encoding_map() {
        println!("  '{}' -> {:?}", codeword, encoding);
    }

    // Test encoding and decoding
    println!("\nEncoding tests:");
    for cw in ["X", "Y", "Z", "W"] {
        let encoded = huffman_ternary.encode(cw)?;
        println!("  encode('{}') = {:?}", cw, encoded);

        let decoded = huffman_ternary.decode(&encoded)?;
        println!("  decode({:?}) = '{}'", encoded, decoded);
        assert_eq!(decoded, cw);
    }

    println!("\n✓ All tests passed!");

    Ok(())
}
