use token_entropy_encoder::{
    huffman::HuffmanGenerator,
    vocab::{get_vocab, load_pmf_from_json},
};

use dotenvy::dotenv;
use std::env;
use std::fs;

fn main() {
    dotenv().ok();

    let tokenizer_json_path = env::var("LLAMA_TOKENIZER_PATH").unwrap();
    let json_path = env::var("LLAMA_PMF_PATH").unwrap();
    let vocab = get_vocab(tokenizer_json_path);
    let pmf = load_pmf_from_json(json_path.as_str()).unwrap();
    let json = HuffmanGenerator::new(&vocab, &pmf, 2)
        .unwrap()
        .to_json()
        .unwrap();
    fs::write("enc_dec.json", json.as_str()).unwrap();
}
