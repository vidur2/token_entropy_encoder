pub trait TokenCompressor {
    fn encode(&self, token_id: u32) -> Result<Vec<u8>, String>;
    fn decode(&self, buffer: &[u8]) -> Result<u32, String>;
    fn encode_bulk(&self, tokens: &[u32]) -> Result<Vec<u8>, String>;
    fn decode_bulk(&self, buffer: &[u8]) -> Result<Vec<u32>, String>;
    fn average_code_length(&self) -> f64;
}