/// Decoder for token IDs to UTF-8 strings using a decodepack binary format
///
/// The decodepack format:
/// - Header (32 bytes): magic, version, vocab_size, offsets_len, offsets_bytes, blob_bytes
/// - Offsets array: vocab_size + 1 u32 values (marks start position of each token's UTF-8 bytes)
/// - Blob: concatenated UTF-8 bytes for all tokens

const MAGIC: u32 = 0x314B5044; // 'DPK1'
const VERSION: u32 = 1;

fn read_u32_le(b: &[u8]) -> u32 {
    u32::from_le_bytes([b[0], b[1], b[2], b[3]])
}

pub struct Decoder {
    // Own the pack bytes in memory
    pack: Vec<u8>,
    vocab_size: u32,
    offsets_start: usize, // start of offsets array
    blob_start: usize,    // start of blob
    offsets_len: usize,   // vocab_size + 1
    blob_bytes: usize,
}

impl Decoder {
    /// Create a new empty Decoder
    pub fn new() -> Self {
        Decoder {
            pack: Vec::new(),
            vocab_size: 0,
            offsets_start: 0,
            blob_start: 0,
            offsets_len: 0,
            blob_bytes: 0,
        }
    }

    /// Initialize decoder with decodepack.bin bytes.
    /// Validates the header and stores the pack data in memory.
    pub fn init_decodepack(&mut self, pack_bytes: &[u8]) -> Result<(), String> {
        if pack_bytes.len() < 32 {
            return Err("decodepack too small".to_string());
        }
        let magic = read_u32_le(&pack_bytes[0..4]);
        let ver = read_u32_le(&pack_bytes[4..8]);
        if magic != MAGIC {
            return Err("bad magic".to_string());
        }
        if ver != VERSION {
            return Err("unsupported version".to_string());
        }
        let vocab_size = read_u32_le(&pack_bytes[8..12]);
        let offsets_len = read_u32_le(&pack_bytes[12..16]) as usize;
        let offsets_bytes = read_u32_le(&pack_bytes[16..20]) as usize;
        let blob_bytes = read_u32_le(&pack_bytes[20..24]) as usize;

        if offsets_len != (vocab_size as usize + 1) {
            return Err("offsets_len mismatch".to_string());
        }
        if offsets_bytes != offsets_len * 4 {
            return Err("offsets_bytes mismatch".to_string());
        }

        let offsets_start = 32;
        let blob_start = offsets_start + offsets_bytes;
        let total = blob_start + blob_bytes;
        if pack_bytes.len() < total {
            return Err("decodepack truncated".to_string());
        }

        // Copy pack into memory once.
        self.pack = pack_bytes[..total].to_vec();
        self.vocab_size = vocab_size;
        self.offsets_len = offsets_len;
        self.offsets_start = offsets_start;
        self.blob_start = blob_start;
        self.blob_bytes = blob_bytes;

        // Validate last offset
        let last_off = self.offset_at(vocab_size as usize)? as usize;
        if last_off != blob_bytes {
            // We expect offsets[vocab_size] == blob_bytes
            return Err("bad final offset".to_string());
        }

        Ok(())
    }

    /// Decode a chunk of token IDs (u32) into UTF-8 bytes.
    /// Returns a Vec<u8> containing the concatenated UTF-8 representation of all tokens.
    pub fn decode_ids(&self, ids: &[u32]) -> Result<Vec<u8>, String> {
        if self.pack.is_empty() {
            return Err("decoder not initialized".to_string());
        }

        // Heuristic reserve: ~4 bytes per token average
        let mut out = Vec::with_capacity(ids.len() * 4);

        for &tid in ids {
            let t = tid as usize;
            if t + 1 >= self.offsets_len {
                // unknown token id; you can skip or emit replacement
                continue;
            }
            let a = self.offset_at(t)? as usize;
            let b = self.offset_at(t + 1)? as usize;
            if b < a || b > self.blob_bytes {
                return Err("corrupt offsets".to_string());
            }
            let start = self.blob_start + a;
            let end = self.blob_start + b;
            out.extend_from_slice(&self.pack[start..end]);
        }

        Ok(out)
    }

    /// Read the offset at index i from the offsets array
    fn offset_at(&self, i: usize) -> Result<u32, String> {
        let p = self.offsets_start + i * 4;
        if p + 4 > self.pack.len() {
            return Err("offset read oob".to_string());
        }
        Ok(read_u32_le(&self.pack[p..p + 4]))
    }

    /// Get the vocabulary size
    pub fn vocab_size(&self) -> u32 {
        self.vocab_size
    }

    /// Check if decoder is initialized
    pub fn is_initialized(&self) -> bool {
        !self.pack.is_empty()
    }
}

impl Default for Decoder {
    fn default() -> Self {
        Self::new()
    }
}
