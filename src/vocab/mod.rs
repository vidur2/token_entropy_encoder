use tokenizers::Tokenizer;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
struct PmfData {
    pmf: Vec<f64>,
}

pub fn get_vocab(tokenizer_json_path: String) -> Vec<String> {
    let tokenizer = Tokenizer::from_file(tokenizer_json_path).unwrap();
    let vocab = tokenizer.get_vocab(true);

    let mut id_to_token = vec![String::new(); vocab.len()];

    for (token, id) in vocab {
        id_to_token[id as usize] = token;
    }

    return id_to_token;
}

/// Load PMF from a JSON file with structure: {"pmf": [0.1, 0.2, ...]}
pub fn load_pmf_from_json(json_path: &str) -> Result<Vec<f64>, String> {
    let file_content = fs::read_to_string(json_path)
        .map_err(|e| format!("Failed to read file {}: {}", json_path, e))?;
    
    let pmf_data: PmfData = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
    Ok(pmf_data.pmf)
}