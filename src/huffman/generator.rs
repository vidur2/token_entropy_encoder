use super::priority_node::PriorityNode;
use super::trie_node::TrieNode;
use crate::token_compressor::TokenCompressor;
use serde::{Deserialize, Serialize};
use std::collections::{BinaryHeap, HashSet};

#[cfg(not(target_arch = "wasm32"))]
// use crate::vocab_size::VOCAB_SIZE;
#[cfg(target_arch = "wasm32")]
const VOCAB_SIZE: usize = 128256;

// ============================================================================
// Bit I/O Utilities (zero-allocation)
// ============================================================================

/// Huffman code representation (optimized for binary, supports m-ary)
#[derive(Clone, Debug)]
enum Code {
    /// Binary code (m=2): packed as u64, MSB-first
    Binary { bits: u64, len: u8 },
    /// M-ary code (m>2): sequence of symbols
    Mary(Vec<u8>),
}

impl Code {
    fn new_binary(bits: u64, len: u8) -> Self {
        debug_assert!(len <= 64, "Code length must be <= 64 bits");
        Self::Binary { bits, len }
    }
    
    fn new_mary(symbols: Vec<u8>) -> Self {
        Self::Mary(symbols)
    }
    
    fn empty_binary() -> Self {
        Self::Binary { bits: 0, len: 0 }
    }
    
    fn empty_mary() -> Self {
        Self::Mary(Vec::new())
    }
    
    fn len(&self) -> u8 {
        match self {
            Code::Binary { len, .. } => *len,
            Code::Mary(v) => v.len() as u8,
        }
    }
    
    fn to_vec(&self) -> Vec<u8> {
        match self {
            Code::Binary { bits, len } => {
                let mut result = Vec::with_capacity(*len as usize);
                for i in (0..*len).rev() {
                    result.push(((*bits >> i) & 1) as u8);
                }
                result
            }
            Code::Mary(v) => v.clone(),
        }
    }
}

/// BitWriter - writes bits to a byte buffer with zero intermediate allocation
struct BitWriter {
    /// Output byte buffer
    buf: Vec<u8>,
    /// Current byte being written (accumulator)
    cur: u8,
    /// Number of bits written to current byte (0-7)
    nbits: u8,
}

impl BitWriter {
    /// Create a new BitWriter with estimated capacity
    fn new(capacity_bytes: usize) -> Self {
        Self {
            buf: Vec::with_capacity(capacity_bytes),
            cur: 0,
            nbits: 0,
        }
    }

    /// Write up to 64 bits (MSB-first)
    /// Bits are right-aligned: for a 3-bit code "101", pass bits=0b101, bit_len=3
    fn write_bits(&mut self, bits: u64, bit_len: u8) {
        if bit_len == 0 {
            return;
        }
        
        debug_assert!(bit_len <= 64, "Cannot write more than 64 bits at once");
        
        let mut remaining = bit_len;
        let bits_to_write = bits;
        
        while remaining > 0 {
            // How many bits can we write to current byte?
            let space_in_cur = 8 - self.nbits;
            let bits_this_iter = remaining.min(space_in_cur);
            
            // Extract the top bits_this_iter bits from bits_to_write
            let shift = remaining - bits_this_iter;
            let mask = (1u64 << bits_this_iter) - 1;
            let chunk = ((bits_to_write >> shift) & mask) as u8;
            
            // Write to current byte (MSB first means we shift left)
            self.cur |= chunk << (space_in_cur - bits_this_iter);
            self.nbits += bits_this_iter;
            
            // If current byte is full, flush it
            if self.nbits == 8 {
                self.buf.push(self.cur);
                self.cur = 0;
                self.nbits = 0;
            }
            
            remaining -= bits_this_iter;
        }
    }

    /// Finish writing and return the buffer (flush partial byte with 0-padding)
    fn finish(mut self) -> Vec<u8> {
        if self.nbits > 0 {
            self.buf.push(self.cur);
        }
        self.buf
    }
    
    /// Get the number of bits written
    fn len_bits(&self) -> usize {
        self.buf.len() * 8 + self.nbits as usize
    }
}

/// BitReader - reads bits from a byte buffer with zero allocation
struct BitReader<'a> {
    /// Input byte buffer
    data: &'a [u8],
    /// Current byte index
    byte_idx: usize,
    /// Current bit position within current byte (0-7, MSB=0)
    bit_idx: u8,
}

impl<'a> BitReader<'a> {
    /// Create a new BitReader
    fn new(data: &'a [u8]) -> Self {
        Self {
            data,
            byte_idx: 0,
            bit_idx: 0,
        }
    }

    /// Read a single bit (returns 0 or 1, or None if EOF)
    fn read_bit(&mut self) -> Option<u8> {
        if self.byte_idx >= self.data.len() {
            return None;
        }
        
        let byte = self.data[self.byte_idx];
        let bit = (byte >> (7 - self.bit_idx)) & 1;
        
        self.bit_idx += 1;
        if self.bit_idx == 8 {
            self.bit_idx = 0;
            self.byte_idx += 1;
        }
        
        Some(bit)
    }
    
    /// Check if there are more bits available
    fn has_bits(&self) -> bool {
        self.byte_idx < self.data.len()
    }
}

/// M-ary Huffman encoder/decoder
pub struct HuffmanGenerator {
    /// Root of the trie
    root: Option<Box<TrieNode>>,
    /// Alphabet size (m)
    m: u8,
    /// Encoding map: token_id -> Code (zero-allocation representation)
    /// Index is the token ID, value is the encoding
    encoding_map: Vec<Code>,
    /// Set of valid token IDs that are in the tree
    /// Used to distinguish between "not in tree" and "empty encoding"
    valid_tokens: std::collections::HashSet<u32>,
}

impl TokenCompressor for HuffmanGenerator {
    /// Encode a token ID to bytes
    ///
    /// For m=2 (binary alphabet), uses packed format with header.
    /// For other alphabets, returns raw alphabet symbols.
    ///
    /// # Arguments
    /// * `token_id` - The token ID to encode
    ///
    /// # Returns
    /// Encoded bytes (packed for m=2, raw symbols otherwise)
    fn encode(&self, token_id: u32) -> Result<Vec<u8>, String> {
        if self.m == 2 {
            self.encode_packed(token_id)
        } else {
            self.encode_raw(token_id)
        }
    }

    /// Decode bytes to a token ID
    ///
    /// For m=2 (binary alphabet), expects packed format with header.
    /// For other alphabets, expects raw alphabet symbols.
    ///
    /// # Arguments
    /// * `buffer` - Encoded bytes (packed for m=2, raw symbols otherwise)
    ///
    /// # Returns
    /// The decoded token ID
    fn decode(&self, buffer: &[u8]) -> Result<u32, String> {
        if self.m == 2 {
            self.decode_packed(buffer)
        } else {
            self.decode_raw(buffer)
        }
    }

    /// Encode multiple tokens to bytes
    ///
    /// For m=2 (binary alphabet), uses packed format with header.
    /// For other alphabets, returns raw alphabet symbols.
    ///
    /// # Arguments
    /// * `token_ids` - Slice of token IDs to encode
    ///
    /// # Returns
    /// Encoded bytes (packed for m=2, raw symbols otherwise)
    fn encode_bulk(&self, token_ids: &[u32]) -> Result<Vec<u8>, String> {
        // Special case: empty input always returns empty output
        if token_ids.is_empty() {
            return Ok(Vec::new());
        }
        
        if self.m == 2 {
            self.encode_bulk_packed(token_ids)
        } else {
            self.encode_bulk_raw(token_ids)
        }
    }

    /// Decode bytes to multiple token IDs
    ///
    /// For m=2 (binary alphabet), expects packed format with header.
    /// For other alphabets, expects raw alphabet symbols.
    ///
    /// # Arguments
    /// * `buffer` - Encoded bytes (packed for m=2, raw symbols otherwise)
    ///
    /// # Returns
    /// Vector of decoded token IDs
    fn decode_bulk(&self, buffer: &[u8]) -> Result<Vec<u32>, String> {
        // Special case: empty input always returns empty output
        if buffer.is_empty() {
            return Ok(Vec::new());
        }
        
        if self.m == 2 {
            self.decode_bulk_packed(buffer)
        } else {
            self.decode_bulk_raw(buffer)
        }
    }

    /// Calculate the weighted average code length using probabilities from the tree
    ///
    /// This calculates the expected code length: sum(p_i * length_i) for all tokens,
    /// using the probabilities stored in the tree's leaf nodes.
    ///
    /// # Returns
    /// The weighted average code length in bits/symbols
    fn average_code_length(&self) -> f64 {
        if self.root.is_none() {
            return 0.0;
        }

        let mut weighted_sum = 0.0;

        // Traverse the tree to find all leaf nodes and calculate weighted sum
        let mut stack = vec![(self.root.as_ref().unwrap().as_ref(), 0usize)];

        while let Some((node, depth)) = stack.pop() {
            if node.is_leaf() {
                if let Some(token_id) = node.codeword {
                    // Skip dummy nodes (u32::MAX)
                    if token_id != u32::MAX {
                        let code_length = self.encoding_map[token_id as usize].len();
                        weighted_sum += node.probability * code_length as f64;
                    }
                }
            } else {
                // Push children onto stack
                for child_opt in &node.children {
                    if let Some(child) = child_opt {
                        stack.push((child.as_ref(), depth + 1));
                    }
                }
            }
        }

        weighted_sum
    }
}

impl HuffmanGenerator {
    /// Encode a token ID to raw alphabet symbols (internal method)
    /// Used for non-binary alphabets and tests
    ///
    /// # Arguments
    /// * `token_id` - The token ID to encode
    ///
    /// # Returns
    /// A vector of alphabet symbols (0 to m-1) representing the encoding
    fn encode_raw(&self, token_id: u32) -> Result<Vec<u8>, String> {
        if !self.valid_tokens.contains(&token_id) {
            return Err(format!("Token ID {} not found in encoding map", token_id));
        }

        Ok(self.encoding_map[token_id as usize].to_vec())
    }

    /// Decode raw alphabet symbols to a token ID (internal method)
    /// Used for non-binary alphabets and tests
    ///
    /// # Arguments
    /// * `alphabet_seq` - Sequence of alphabet symbols (each in range 0 to m-1)
    ///
    /// # Returns
    /// The decoded token ID
    fn decode_raw(&self, alphabet_seq: &[u8]) -> Result<u32, String> {
        let root = self
            .root
            .as_ref()
            .ok_or_else(|| "Huffman tree not initialized".to_string())?;

        let mut current = root.as_ref();

        for &symbol in alphabet_seq {
            if symbol >= self.m {
                return Err(format!(
                    "Invalid alphabet symbol {} (must be < {})",
                    symbol, self.m
                ));
            }

            current = current.children[symbol as usize]
                .as_ref()
                .ok_or_else(|| format!("Invalid encoding: no child for symbol {}", symbol))?
                .as_ref();
        }

        if !current.is_leaf() {
            return Err("Invalid encoding: path does not lead to a leaf".to_string());
        }

        current
            .codeword
            .ok_or_else(|| "Reached leaf with no token ID".to_string())
    }

    /// Encode multiple tokens to raw alphabet symbols (internal method)
    /// Used for non-binary alphabets and tests
    ///
    /// # Arguments
    /// * `token_ids` - Slice of token IDs to encode
    ///
    /// # Returns
    /// A vector of alphabet symbols representing all encoded tokens
    fn encode_bulk_raw(&self, token_ids: &[u32]) -> Result<Vec<u8>, String> {
        let mut result = Vec::new();
        for &token_id in token_ids {
            let encoded = self.encode_raw(token_id)?;
            result.extend(encoded);
        }
        Ok(result)
    }

    /// Decode raw alphabet symbols to multiple token IDs (internal method)
    /// Used for non-binary alphabets and tests
    ///
    /// This decodes tokens sequentially from the symbol stream until all symbols are consumed.
    ///
    /// # Arguments
    /// * `alphabet_seq` - Sequence of alphabet symbols (each in range 0 to m-1)
    ///
    /// # Returns
    /// Vector of decoded token IDs
    fn decode_bulk_raw(&self, alphabet_seq: &[u8]) -> Result<Vec<u32>, String> {
        let root = self
            .root
            .as_ref()
            .ok_or_else(|| "Huffman tree not initialized".to_string())?;

        let mut result = Vec::new();
        let mut current = root.as_ref();

        for &symbol in alphabet_seq {
            if symbol >= self.m {
                return Err(format!(
                    "Invalid alphabet symbol {} (must be < {})",
                    symbol, self.m
                ));
            }

            current = current.children[symbol as usize]
                .as_ref()
                .ok_or_else(|| format!("Invalid encoding: no child for symbol {}", symbol))?
                .as_ref();

            // Check if we've reached a leaf (completed a token)
            if current.is_leaf() {
                let token_id = current
                    .codeword
                    .ok_or_else(|| "Reached leaf with no token ID".to_string())?;
                result.push(token_id);
                // Reset to root for next token
                current = root.as_ref();
            }
        }

        // Ensure we ended at the root (all tokens were complete)
        if !current.is_leaf() && current as *const _ != root.as_ref() as *const _ {
            return Err("Incomplete token at end of sequence".to_string());
        }

        Ok(result)
    }
}

impl HuffmanGenerator {
    /// Create a new HuffmanGenerator from number of tokens, their probabilities, and alphabet size
    ///
    /// Token IDs are generated as 0..(num_tokens-1)
    ///
    /// # Arguments
    /// * `num_tokens` - Number of tokens (generates token IDs 0..num_tokens-1)
    /// * `pmf` - Probability mass function for each token (must sum to ~1.0)
    /// * `m` - Alphabet size (2 for binary, 3 for ternary, etc.)
    ///
    /// # Returns
    /// A new HuffmanGenerator with the constructed trie and encoding map
    pub fn new(num_tokens: usize, pmf: &[f64], m: u8) -> Result<Self, String> {
        if num_tokens == 0 {
            return Err("Cannot create Huffman tree with zero tokens".to_string());
        }

        if num_tokens != pmf.len() {
            return Err("Number of tokens and PMF must have the same length".to_string());
        }

        if m < 2 {
            return Err("Alphabet size must be at least 2".to_string());
        }

        // Validate PMF
        let sum: f64 = pmf.iter().sum();
        if (sum - 1.0).abs() > 0.001 {
            return Err(format!("PMF must sum to 1.0, got {}", sum));
        }

        // Build the Huffman tree
        let root = Self::build_huffman_tree(num_tokens, pmf, m as usize);

        // Build encoding map as a fixed-size array of Codes
        let mut encoding_map = if m == 2 {
            vec![Code::empty_binary(); num_tokens]
        } else {
            vec![Code::empty_mary(); num_tokens]
        };
        let mut valid_tokens = HashSet::new();
        Self::build_encoding_map(&root, m, 0, 0, Vec::new(), &mut encoding_map, &mut valid_tokens);

        Ok(HuffmanGenerator {
            root: Some(root),
            m,
            encoding_map,
            valid_tokens,
        })
    }

    /// Build the m-ary Huffman tree using a priority queue
    fn build_huffman_tree(num_tokens: usize, pmf: &[f64], m: usize) -> Box<TrieNode> {
        let n = num_tokens;
        let mut heap = BinaryHeap::new();

        // Initialize heap with leaf nodes (token IDs from 0 to num_tokens-1)
        for (token_id, &prob) in (0..num_tokens as u32).zip(pmf.iter()) {
            let node = TrieNode::new_leaf(token_id, prob);
            heap.push(PriorityNode::new(node));
        }
        // For m-ary Huffman, we need to ensure we can combine m nodes at each step
        // If n % (m-1) != 1, we need to add dummy nodes with 0 probability
        // Use u32::MAX as the dummy token ID
        let mut node_count = n;
        while (node_count - 1) % (m - 1) != 0 {
            let dummy = TrieNode::new_leaf(u32::MAX, 0.0);
            heap.push(PriorityNode::new(dummy));
            node_count += 1;
        }

        // Build tree by combining m nodes at a time
        while heap.len() > 1 {
            let mut combined_prob = 0.0;
            let mut parent = TrieNode::new_internal(m, 0.0);

            // Extract m nodes with minimum probability
            for i in 0..m {
                if let Some(pnode) = heap.pop() {
                    combined_prob += pnode.node.probability;
                    parent.children[i] = Some(pnode.node);
                }
            }

            parent.probability = combined_prob;
            heap.push(PriorityNode::new(parent));
        }

        // Return the root
        heap.pop().unwrap().node
    }

    /// Get the alphabet size
    pub fn alphabet_size(&self) -> u8 {
        self.m
    }

    /// Build the encoding map (token_id -> Code) using explicit iteration
    /// For binary: builds codes as u64 bit patterns (MSB-first)
    /// For m-ary: builds codes as Vec<u8> symbol sequences
    fn build_encoding_map(
        node: &TrieNode,
        m: u8,
        current_bits: u64,
        current_len: u8,
        current_path: Vec<u8>,
        map: &mut Vec<Code>,
        valid_tokens: &mut HashSet<u32>,
    ) {
        // Use explicit stack to avoid stack overflow with large trees
        let mut stack: Vec<(&TrieNode, u64, u8, Vec<u8>)> = Vec::new();
        stack.push((node, current_bits, current_len, current_path));

        while let Some((current_node, bits, len, path)) = stack.pop() {
            if current_node.is_leaf() {
                if let Some(token_id) = current_node.codeword {
                    // Skip dummy nodes (u32::MAX)
                    if token_id != u32::MAX {
                        if m == 2 {
                            // Binary: use bit-packed representation
                            map[token_id as usize] = Code::new_binary(bits, len);
                        } else {
                            // M-ary: use symbol sequence
                            map[token_id as usize] = Code::new_mary(path);
                        }
                        valid_tokens.insert(token_id);
                    }
                }
            } else {
                // Push children onto stack in reverse order to maintain left-to-right traversal
                for (symbol, child_opt) in current_node.children.iter().enumerate().rev() {
                    if let Some(child) = child_opt {
                        if m == 2 {
                            // Binary: append bit to the code
                            let new_bits = (bits << 1) | (symbol as u64);
                            let new_len = len + 1;
                            debug_assert!(new_len <= 64, "Code length exceeded 64 bits!");
                            stack.push((child.as_ref(), new_bits, new_len, Vec::new()));
                        } else {
                            // M-ary: append symbol to the path
                            let mut new_path = path.clone();
                            new_path.push(symbol as u8);
                            stack.push((child.as_ref(), 0, 0, new_path));
                        }
                    }
                }
            }
        }
    }

    /// Get the encoding map (for debugging/inspection)
    /// Returns a vector of (Vec<u8> symbols) for backward compatibility with tests
    #[cfg(test)]
    pub fn get_encoding_map(&self) -> Vec<Vec<u8>> {
        self.encoding_map.iter().map(|code| code.to_vec()).collect()
    }

    /// Calculate the weighted average code length using a probability distribution
    ///
    /// This calculates the expected code length: sum(p_i * length_i) for all tokens
    /// Token IDs are assumed to be 0..(num_tokens-1)
    ///
    /// # Arguments
    /// * `num_tokens` - Number of tokens
    /// * `pmf` - Probability mass function for each token (must sum to ~1.0)
    ///
    /// # Returns
    /// The weighted average code length in bits/symbols
    pub fn weighted_average_code_length(
        &self,
        num_tokens: usize,
        pmf: &[f64],
    ) -> Result<f64, String> {
        if num_tokens != pmf.len() {
            return Err("Number of tokens and PMF must have the same length".to_string());
        }

        let sum: f64 = pmf.iter().sum();
        if (sum - 1.0).abs() > 0.01 {
            return Err(format!("PMF must sum to 1.0, got {}", sum));
        }

        let mut weighted_sum = 0.0;
        for (token_id, &probability) in (0..num_tokens as u32).zip(pmf.iter()) {
            if !self.valid_tokens.contains(&token_id) {
                return Err(format!("Token ID {} not found in tree", token_id));
            }
            let code_length = self.encoding_map[token_id as usize].len();
            weighted_sum += probability * code_length as f64;
        }

        Ok(weighted_sum)
    }

    /// Serialize the HuffmanGenerator to JSON
    ///
    /// # Returns
    /// A JSON string representation of the generator
    pub fn to_json(&self) -> Result<String, String> {
        #[derive(Serialize)]
        struct SerializableGenerator {
            root: Option<Box<TrieNode>>,
            size: usize,
            m: u8,
        }

        let serializable = SerializableGenerator {
            root: self.root.clone(),
            size: self.encoding_map.len(),
            m: self.m,
        };

        serde_json::to_string(&serializable)
            .map_err(|e| format!("Failed to serialize to JSON: {}", e))
    }

    /// Deserialize a HuffmanGenerator from JSON
    ///
    /// # Arguments
    /// * `json` - JSON string representation of the generator
    ///
    /// # Returns
    /// A reconstructed HuffmanGenerator
    pub fn from_json(json: &str) -> Result<Self, String> {
        #[derive(Deserialize)]
        struct SerializableGenerator {
            root: Option<Box<TrieNode>>,
            size: usize,
            m: u8,
        }

        let deserialized: SerializableGenerator = serde_json::from_str(json)
            .map_err(|e| format!("Failed to deserialize from JSON: {}", e))?;

        // Rebuild the encoding map from the tree
        let mut encoding_map = if deserialized.m == 2 {
            vec![Code::empty_binary(); deserialized.size]
        } else {
            vec![Code::empty_mary(); deserialized.size]
        };
        let mut valid_tokens = HashSet::new();
        if let Some(ref root) = deserialized.root {
            Self::build_encoding_map(root, deserialized.m, 0, 0, Vec::new(), &mut encoding_map, &mut valid_tokens);
        }

        Ok(HuffmanGenerator {
            root: deserialized.root,
            m: deserialized.m,
            encoding_map,
            valid_tokens,
        })
    }

    /// Encode a token to packed bytes (only for m=2, binary alphabet)
    ///
    /// This packs bits into bytes for efficient transmission using BitWriter (zero allocation).
    /// Format: [1 byte: valid bits in last byte (0-8, where 0 means empty)] [packed bits]
    ///
    /// # Arguments
    /// * `token_id` - The token ID to encode
    ///
    /// # Returns
    /// Packed byte array with 1-byte header
    pub fn encode_packed(&self, token_id: u32) -> Result<Vec<u8>, String> {
        if self.m != 2 {
            return Err(format!(
                "Packed encoding only supported for binary (m=2), got m={}",
                self.m
            ));
        }

        if !self.valid_tokens.contains(&token_id) {
            return Err(format!("Token ID {} not found in encoding map", token_id));
        }

        let code = &self.encoding_map[token_id as usize];

        // Handle empty encoding (0 bits)
        if code.len() == 0 {
            return Ok(vec![0]); // Header with 0 = no data bytes
        }

        // Use BitWriter for zero-allocation encoding
        match code {
            Code::Binary { bits, len } => {
                let capacity = (*len as usize + 7) / 8 + 1; // +1 for header
                let mut writer = BitWriter::new(capacity);
                
                writer.write_bits(*bits, *len);
                let mut packed = writer.finish();

                // Calculate how many valid bits are in the last byte (1-8)
                let last_byte_bits = if len % 8 == 0 { 8 } else { len % 8 };

                // Prepend header: [last_byte_bits] [data bytes]
                packed.insert(0, last_byte_bits);

                Ok(packed)
            }
            Code::Mary(_) => {
                Err("encode_packed called with non-binary code".to_string())
            }
        }
    }

    /// Decode packed bytes to a token ID (only for m=2, binary alphabet)
    ///
    /// This unpacks bits from bytes using BitReader (zero allocation) and decodes them.
    /// Expected format: [1 byte: valid bits in last byte (0-8, where 0 means empty)] [packed bits]
    ///
    /// # Arguments
    /// * `packed` - Packed byte array with 1-byte header
    ///
    /// # Returns
    /// The decoded token ID
    pub fn decode_packed(&self, packed: &[u8]) -> Result<u32, String> {
        if self.m != 2 {
            return Err(format!(
                "Packed decoding only supported for binary (m=2), got m={}",
                self.m
            ));
        }

        if packed.len() < 1 {
            return Err("Packed data too short: need at least 1 byte for header".to_string());
        }

        // Extract valid bits in last byte from first byte
        let last_byte_bits = packed[0] as usize;

        // Handle empty encoding (0 bits)
        if last_byte_bits == 0 {
            if packed.len() != 1 {
                return Err(
                    "Invalid packed data: header indicates 0 bits but has data bytes".to_string(),
                );
            }
            // Empty code - find token with empty encoding
            for (token_id, code) in self.encoding_map.iter().enumerate() {
                if code.len() == 0 && self.valid_tokens.contains(&(token_id as u32)) {
                    return Ok(token_id as u32);
                }
            }
            return Err("No token found with empty encoding".to_string());
        }

        if last_byte_bits > 8 {
            return Err(format!(
                "Invalid header: last_byte_bits must be 0-8, got {}",
                last_byte_bits
            ));
        }

        if packed.len() < 2 {
            return Err("Packed data too short: need at least 2 bytes (header + data)".to_string());
        }

        // Calculate total bit count
        let data_bytes = packed.len() - 1;
        let bit_count = if last_byte_bits == 8 {
            data_bytes * 8
        } else {
            (data_bytes - 1) * 8 + last_byte_bits
        };

        // Use BitReader to decode directly from packed bytes
        let root = self
            .root
            .as_ref()
            .ok_or_else(|| "Huffman tree not initialized".to_string())?;

        let mut reader = BitReader::new(&packed[1..]);
        let mut current = root.as_ref();
        let mut bits_read = 0;

        while bits_read < bit_count {
            let bit = reader
                .read_bit()
                .ok_or_else(|| "Unexpected end of bit stream".to_string())?;
            bits_read += 1;

            current = current.children[bit as usize]
                .as_ref()
                .ok_or_else(|| format!("Invalid encoding: no child for bit {}", bit))?
                .as_ref();

            if current.is_leaf() {
                let token_id = current
                    .codeword
                    .ok_or_else(|| "Reached leaf with no token ID".to_string())?;
                
                // We should have consumed exactly bit_count bits
                if bits_read == bit_count {
                    return Ok(token_id);
                } else {
                    return Err(format!(
                        "Token decoded but {} bits remaining",
                        bit_count - bits_read
                    ));
                }
            }
        }

        Err("Incomplete token at end of bit stream".to_string())
    }

    /// Encode multiple tokens to packed bytes (only for m=2, binary alphabet)
    ///
    /// This encodes all tokens using BitWriter for zero-allocation, single-pass encoding.
    /// Format: [1 byte: valid bits in last byte (0-8, where 0 means empty)] [packed bits for all tokens]
    ///
    /// # Arguments
    /// * `token_ids` - Slice of token IDs to encode
    ///
    /// # Returns
    /// Packed byte array with 1-byte header containing all encoded tokens
    pub fn encode_bulk_packed(&self, token_ids: &[u32]) -> Result<Vec<u8>, String> {
        if self.m != 2 {
            return Err(format!(
                "Packed encoding only supported for binary (m=2), got m={}",
                self.m
            ));
        }

        // Estimate capacity: average 16 bits per token (reasonable for LLM vocabs)
        let estimated_bits = token_ids.len() * 16;
        let capacity = (estimated_bits + 7) / 8 + 1; // +1 for header
        let mut writer = BitWriter::new(capacity);

        // Single pass: encode each token directly to bitstream
        for &token_id in token_ids {
            if !self.valid_tokens.contains(&token_id) {
                return Err(format!("Token ID {} not found in encoding map", token_id));
            }
            
            let code = &self.encoding_map[token_id as usize];
            match code {
                Code::Binary { bits, len } => {
                    writer.write_bits(*bits, *len);
                }
                Code::Mary(_) => {
                    return Err("encode_bulk_packed called with non-binary code".to_string());
                }
            }
        }

        let total_bits = writer.len_bits();

        // Finish and get packed bytes
        let mut packed = writer.finish();

        // Handle empty encoding (0 bits)
        if total_bits == 0 {
            return Ok(vec![0]); // Header with 0 = no data bytes
        }

        // Calculate how many valid bits are in the last byte (1-8)
        let last_byte_bits = if total_bits % 8 == 0 {
            8
        } else {
            total_bits % 8
        };

        // Prepend header: [last_byte_bits] [data bytes]
        packed.insert(0, last_byte_bits as u8);

        Ok(packed)
    }

    /// Decode packed bytes to multiple token IDs (only for m=2, binary alphabet)
    ///
    /// This uses BitReader to decode directly from packed bytes with zero intermediate allocation.
    /// Expected format: [1 byte: valid bits in last byte (0-8, where 0 means empty)] [packed bits]
    ///
    /// # Arguments
    /// * `packed` - Packed byte array with 1-byte header
    ///
    /// # Returns
    /// Vector of decoded token IDs
    pub fn decode_bulk_packed(&self, packed: &[u8]) -> Result<Vec<u32>, String> {
        if self.m != 2 {
            return Err(format!(
                "Packed decoding only supported for binary (m=2), got m={}",
                self.m
            ));
        }

        if packed.len() < 1 {
            return Err("Packed data too short: need at least 1 byte for header".to_string());
        }

        // Extract valid bits in last byte from first byte
        let last_byte_bits = packed[0] as usize;

        // Handle empty encoding (0 bits)
        if last_byte_bits == 0 {
            if packed.len() != 1 {
                return Err(
                    "Invalid packed data: header indicates 0 bits but has data bytes".to_string(),
                );
            }
            return Ok(Vec::new());
        }

        if last_byte_bits > 8 {
            return Err(format!(
                "Invalid header: last_byte_bits must be 0-8, got {}",
                last_byte_bits
            ));
        }

        if packed.len() < 2 {
            return Err("Packed data too short: need at least 2 bytes (header + data)".to_string());
        }

        // Calculate total bit count
        let data_bytes = packed.len() - 1;
        let bit_count = if last_byte_bits == 8 {
            data_bytes * 8
        } else {
            (data_bytes - 1) * 8 + last_byte_bits
        };

        // Use BitReader to decode directly from packed bytes (zero allocation)
        let root = self
            .root
            .as_ref()
            .ok_or_else(|| "Huffman tree not initialized".to_string())?;

        let mut reader = BitReader::new(&packed[1..]);
        let mut result = Vec::new();
        let mut current = root.as_ref();
        let mut bits_read = 0;

        // Decode tokens sequentially by walking the trie
        while bits_read < bit_count {
            let bit = reader
                .read_bit()
                .ok_or_else(|| "Unexpected end of bit stream".to_string())?;
            bits_read += 1;

            current = current.children[bit as usize]
                .as_ref()
                .ok_or_else(|| format!("Invalid encoding: no child for bit {}", bit))?
                .as_ref();

            // Check if we've reached a leaf (completed a token)
            if current.is_leaf() {
                let token_id = current
                    .codeword
                    .ok_or_else(|| "Reached leaf with no token ID".to_string())?;
                result.push(token_id);
                // Reset to root for next token
                current = root.as_ref();
            }
        }

        // Ensure we ended at the root (all tokens were complete)
        if !current.is_leaf() && current as *const _ != root.as_ref() as *const _ {
            return Err("Incomplete token at end of bit stream".to_string());
        }

        Ok(result)
    }
}
