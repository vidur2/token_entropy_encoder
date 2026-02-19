use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
struct PmfData {
    pmf: Vec<f64>,
}


pub fn get_vocab(tokenizer_json_path: String) -> Vec<String> {
    // Read the JSON file
    let file_content = fs::read_to_string(tokenizer_json_path).unwrap();
    let id_to_token: Vec<String> = serde_json::from_str(&file_content).unwrap();
    return id_to_token;
}

/// Load PMF from a JSON file with structure: {"pmf": [0.1, 0.2, ...]}
pub fn load_pmf_from_json(json_path: &str) -> Result<Vec<f64>, String> {
    let file_content = fs::read_to_string(json_path)
        .map_err(|e| format!("Failed to read file {}: {}", json_path, e))?;

    let pmf_data: PmfData =
        serde_json::from_str(&file_content).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(pmf_data.pmf)
}
