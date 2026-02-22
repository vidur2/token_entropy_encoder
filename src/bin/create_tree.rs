use token_entropy_encoder::{
    huffman::HuffmanGenerator,
    vocab::load_pmf_from_json,
    vocab_size::VOCAB_SIZE,
};

use dotenvy::dotenv;
use std::env;
use std::fs;

fn main() {
    dotenv().ok();

    let json_path = env::var("LLAMA_PMF_PATH").unwrap();
    let pmf = load_pmf_from_json(json_path.as_str()).unwrap();

    if pmf.len() != VOCAB_SIZE {
        panic!("pmf length ({}) must match VOCAB_SIZE ({})", pmf.len(), VOCAB_SIZE);
    }

    // Create token IDs from 0 to VOCAB_SIZE-1
    let token_ids: Vec<u32> = (0..VOCAB_SIZE as u32).collect();
    
    let json = HuffmanGenerator::new(&token_ids, &pmf, 2)
        .unwrap()
        .to_json()
        .unwrap();
    fs::write("enc_dec.json", json.as_str()).unwrap();
    
    println!("Successfully created enc_dec.json with {} token IDs", VOCAB_SIZE);
}
