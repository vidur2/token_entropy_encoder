use token_entropy_encoder::huffman::HuffmanGenerator;

fn main() -> Result<(), String> {
    println!("=== Binary Huffman Encoding (m=2) ===");

    // Example with binary alphabet using token IDs
    let token_ids = [0u32, 1u32, 2u32, 3u32];

    let pmf = [0.4, 0.3, 0.2, 0.1];
    let m = 2u8; // binary

    let huffman = HuffmanGenerator::new(&token_ids, &pmf, m)?;

    println!("Encoding map:");
    for (token_id, encoding) in huffman.get_encoding_map().iter().enumerate() {
        if !encoding.is_empty() {
            println!("  Token ID {} -> {:?}", token_id, encoding);
        }
    }

    // Test encoding
    println!("\nEncoding tests:");
    for token_id in [0u32, 1u32, 2u32, 3u32] {
        let encoded = huffman.encode(token_id)?;
        println!("  encode({}) = {:?}", token_id, encoded);

        // Test decoding
        let decoded = huffman.decode(&encoded)?;
        println!("  decode({:?}) = {}", encoded, decoded);
        assert_eq!(decoded, token_id);
    }

    println!("\n=== Ternary Huffman Encoding (m=3) ===");

    // Example with ternary alphabet
    let token_ids_ternary = [10u32, 20u32, 30u32, 40u32];

    let pmf_ternary = [0.4, 0.3, 0.2, 0.1];
    let m_ternary = 3u8; // ternary

    let huffman_ternary = HuffmanGenerator::new(&token_ids_ternary, &pmf_ternary, m_ternary)?;

    println!("Encoding map:");
    for (token_id, encoding) in huffman_ternary.get_encoding_map().iter().enumerate() {
        if !encoding.is_empty() {
            println!("  Token ID {} -> {:?}", token_id, encoding);
        }
    }

    // Test encoding and decoding
    println!("\nEncoding tests:");
    for token_id in [10u32, 20u32, 30u32, 40u32] {
        let encoded = huffman_ternary.encode(token_id)?;
        println!("  encode({}) = {:?}", token_id, encoded);

        let decoded = huffman_ternary.decode(&encoded)?;
        println!("  decode({:?}) = {}", encoded, decoded);
        assert_eq!(decoded, token_id);
    }

    println!("\n✓ All tests passed!");

    Ok(())
}
