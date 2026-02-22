use super::priority_node::PriorityNode;
use super::trie_node::TrieNode;
use serde::{Deserialize, Serialize};
use std::collections::{BinaryHeap, HashSet};

#[cfg(not(target_arch = "wasm32"))]
// use crate::vocab_size::VOCAB_SIZE;

#[cfg(target_arch = "wasm32")]
const VOCAB_SIZE: usize = 128256;

/// M-ary Huffman encoder/decoder
pub struct HuffmanGenerator {
    /// Root of the trie
    root: Option<Box<TrieNode>>,
    /// Alphabet size (m)
    m: u8,
    /// Encoding map: token_id -> sequence of alphabet symbols
    /// Index is the token ID, value is the encoding
    encoding_map: Vec<Vec<u8>>,
    /// Set of valid token IDs that are in the tree
    /// Used to distinguish between "not in tree" and "empty encoding"
    valid_tokens: std::collections::HashSet<u32>,
}

impl HuffmanGenerator {
    /// Create a new HuffmanGenerator from token IDs, their probabilities, and alphabet size
    ///
    /// # Arguments
    /// * `token_ids` - Slice of token IDs (u32)
    /// * `pmf` - Probability mass function for each token (must sum to ~1.0)
    /// * `m` - Alphabet size (2 for binary, 3 for ternary, etc.)
    ///
    /// # Returns
    /// A new HuffmanGenerator with the constructed trie and encoding map
    pub fn new(
        token_ids: &[u32],
        pmf: &[f64],
        m: u8,
    ) -> Result<Self, String> {
        let n = token_ids.len();
        
        if n == 0 {
            return Err("Cannot create Huffman tree with zero tokens".to_string());
        }
        
        if n != pmf.len() {
            return Err("Token IDs and PMF must have the same length".to_string());
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
        let root = Self::build_huffman_tree(token_ids, pmf, m as usize);

        // Build encoding map as a fixed-size array
        let token_bound_size = token_ids.iter().max().unwrap();
        let mut encoding_map = vec![Vec::new(); (token_bound_size.clone() + 1) as usize];
        let mut valid_tokens = HashSet::new();
        Self::build_encoding_map(&root, &mut Vec::new(), &mut encoding_map, &mut valid_tokens);

        Ok(HuffmanGenerator {
            root: Some(root),
            m,
            encoding_map,
            valid_tokens,
        })
    }

    /// Build the m-ary Huffman tree using a priority queue
    fn build_huffman_tree(
        token_ids: &[u32],
        pmf: &[f64],
        m: usize,
    ) -> Box<TrieNode> {
        let n = token_ids.len();
        let mut heap = BinaryHeap::new();

        // Initialize heap with leaf nodes
        for (token_id, &prob) in token_ids.iter().zip(pmf.iter()) {
            let node = TrieNode::new_leaf(*token_id, prob);
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

    /// Build the encoding map (token_id -> alphabet sequence) using explicit iteration
    fn build_encoding_map(node: &TrieNode, _path: &mut Vec<u8>, map: &mut Vec<Vec<u8>>, valid_tokens: &mut HashSet<u32>) {
        // Use explicit stack to avoid stack overflow with large trees
        let mut stack: Vec<(&TrieNode, Vec<u8>)> = Vec::new();
        stack.push((node, Vec::new()));

        while let Some((current_node, current_path)) = stack.pop() {
            if current_node.is_leaf() {
                if let Some(token_id) = current_node.codeword {
                    // Skip dummy nodes (u32::MAX)
                    if token_id != u32::MAX {
                        map[token_id as usize] = current_path;
                        valid_tokens.insert(token_id);
                    }
                }
            } else {
                // Push children onto stack in reverse order to maintain left-to-right traversal
                for (symbol, child_opt) in current_node.children.iter().enumerate().rev() {
                    if let Some(child) = child_opt {
                        let mut new_path = current_path.clone();
                        new_path.push(symbol as u8);
                        stack.push((child.as_ref(), new_path));
                    }
                }
            }
        }
    }

    /// Encode a token ID into a sequence of alphabet symbols
    ///
    /// # Arguments
    /// * `token_id` - The token ID to encode
    ///
    /// # Returns
    /// A vector of alphabet symbols (0 to m-1) representing the encoding
    pub fn encode(&self, token_id: u32) -> Result<Vec<u8>, String> {
        let token_idx = token_id as usize;
        if token_idx >= self.encoding_map.len() {
        if !self.valid_tokens.contains(&token_id) {
            return Err(format!("Token ID {} not found in encoding map", token_id));
        }
        
            return Err(format!("Token ID {} is out of range (max: {})", token_id, self.encoding_map.len() - 1));
        }
        
        Ok(self.encoding_map[token_idx].clone())
    }

    /// Decode a sequence of alphabet symbols into a token ID
    ///
    /// # Arguments
    /// * `alphabet_seq` - Sequence of alphabet symbols (each in range 0 to m-1)
    ///
    /// # Returns
    /// The decoded token ID
    pub fn decode(&self, alphabet_seq: &[u8]) -> Result<u32, String> {
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

    /// Get the alphabet size
    pub fn alphabet_size(&self) -> u8 {
        self.m
    }

    /// Get the encoding map (for debugging/inspection)
    pub fn get_encoding_map(&self) -> &[Vec<u8>] {
        &self.encoding_map
    }

    /// Calculate the weighted average code length using probabilities from the tree
    /// 
    /// This calculates the expected code length: sum(p_i * length_i) for all tokens,
    /// using the probabilities stored in the tree's leaf nodes.
    /// 
    /// # Returns
    /// The weighted average code length in bits/symbols
    pub fn average_code_length(&self) -> f64 {
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

    /// Calculate the weighted average code length using a probability distribution
    /// 
    /// This calculates the expected code length: sum(p_i * length_i) for all tokens
    /// 
    /// # Arguments
    /// * `token_ids` - Slice of token IDs
    /// * `pmf` - Probability mass function for each token (must sum to ~1.0)
    /// 
    /// # Returns
    /// The weighted average code length in bits/symbols
    pub fn weighted_average_code_length(&self, token_ids: &[u32], pmf: &[f64]) -> Result<f64, String> {
        if token_ids.len() != pmf.len() {
            return Err("Token IDs and PMF must have the same length".to_string());
        }
        
        let sum: f64 = pmf.iter().sum();
        if (sum - 1.0).abs() > 0.01 {
            return Err(format!("PMF must sum to 1.0, got {}", sum));
        }
        
        let mut weighted_sum = 0.0;
        for (&token_id, &probability) in token_ids.iter().zip(pmf.iter()) {
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
        let mut encoding_map = vec![Vec::new(); deserialized.size];
        let mut valid_tokens = HashSet::new();
        if let Some(ref root) = deserialized.root {
            Self::build_encoding_map(root, &mut Vec::new(), &mut encoding_map, &mut valid_tokens);
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
    /// This packs bits into bytes for efficient transmission.
    /// Format: [4 bytes: bit count (big-endian)] [packed bits]
    ///
    /// # Arguments
    /// * `token_id` - The token ID to encode
    ///
    /// # Returns
    /// Packed byte array with bit count header
    pub fn encode_packed(&self, token_id: u32) -> Result<Vec<u8>, String> {
        if self.m != 2 {
            return Err(format!(
                "Packed encoding only supported for binary (m=2), got m={}",
                self.m
            ));
        }

        // Get the bit sequence
        let bits = self.encode(token_id)?;
        
        // Pack: [4 bytes: bit count] [packed bytes]
        let bit_count = bits.len() as u32;
        let mut packed = bit_count.to_be_bytes().to_vec();
        
        // Pack 8 bits into each byte (MSB first)
        for chunk in bits.chunks(8) {
            let mut byte = 0u8;
            for (i, &bit) in chunk.iter().enumerate() {
                if bit != 0 {
                    byte |= 1 << (7 - i);
                }
            }
            packed.push(byte);
        }
        
        Ok(packed)
    }

    /// Decode packed bytes to a token ID (only for m=2, binary alphabet)
    ///
    /// This unpacks bits from bytes and then decodes them.
    /// Expected format: [4 bytes: bit count (big-endian)] [packed bits]
    ///
    /// # Arguments
    /// * `packed` - Packed byte array with bit count header
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

        if packed.len() < 4 {
            return Err("Packed data too short: need at least 4 bytes for header".to_string());
        }

        // Extract bit count from first 4 bytes (big-endian)
        let bit_count = u32::from_be_bytes([packed[0], packed[1], packed[2], packed[3]]) as usize;
        
        // Unpack bits from remaining bytes
        let mut bits = Vec::with_capacity(bit_count);
        for &byte in &packed[4..] {
            for i in (0..8).rev() {
                bits.push((byte >> i) & 1);
                if bits.len() == bit_count {
                    break;
                }
            }
            if bits.len() == bit_count {
                break;
            }
        }

        if bits.len() != bit_count {
            return Err(format!(
                "Could not unpack {} bits from {} bytes",
                bit_count,
                packed.len() - 4
            ));
        }

        // Decode the unpacked bits
        self.decode(&bits)
    }

    /// Encode multiple tokens to packed bytes (only for m=2, binary alphabet)
    ///
    /// This encodes all tokens and packs their bits into bytes for efficient transmission.
    /// Format: [4 bytes: bit count (big-endian)] [packed bits for all tokens]
    ///
    /// # Arguments
    /// * `token_ids` - Slice of token IDs to encode
    ///
    /// # Returns
    /// Packed byte array with bit count header containing all encoded tokens
    pub fn encode_bulk_packed(&self, token_ids: &[u32]) -> Result<Vec<u8>, String> {
        if self.m != 2 {
            return Err(format!(
                "Packed encoding only supported for binary (m=2), got m={}",
                self.m
            ));
        }

        // Collect all bits from all tokens
        let mut all_bits = Vec::new();
        for &token_id in token_ids {
            let bits = self.encode(token_id)?;
            all_bits.extend(bits);
        }
        
        // Pack: [4 bytes: bit count] [packed bytes]
        let bit_count = all_bits.len() as u32;
        let mut packed = bit_count.to_be_bytes().to_vec();
        
        // Pack 8 bits into each byte (MSB first)
        for chunk in all_bits.chunks(8) {
            let mut byte = 0u8;
            for (i, &bit) in chunk.iter().enumerate() {
                if bit != 0 {
                    byte |= 1 << (7 - i);
                }
            }
            packed.push(byte);
        }
        
        Ok(packed)
    }

    /// Decode packed bytes to multiple token IDs (only for m=2, binary alphabet)
    ///
    /// This unpacks bits from bytes and decodes all tokens sequentially.
    /// Expected format: [4 bytes: bit count (big-endian)] [packed bits]
    ///
    /// # Arguments
    /// * `packed` - Packed byte array with bit count header
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

        if packed.len() < 4 {
            return Err("Packed data too short: need at least 4 bytes for header".to_string());
        }

        // Extract bit count from first 4 bytes (big-endian)
        let bit_count = u32::from_be_bytes([packed[0], packed[1], packed[2], packed[3]]) as usize;
        
        // Unpack bits from remaining bytes
        let mut bits = Vec::with_capacity(bit_count);
        for &byte in &packed[4..] {
            for i in (0..8).rev() {
                bits.push((byte >> i) & 1);
                if bits.len() == bit_count {
                    break;
                }
            }
            if bits.len() == bit_count {
                break;
            }
        }

        if bits.len() != bit_count {
            return Err(format!(
                "Could not unpack {} bits from {} bytes",
                bit_count,
                packed.len() - 4
            ));
        }

        // Decode all tokens from the bit stream
        self.decode_bulk(&bits)
    }

    /// Encode multiple tokens into a sequence of alphabet symbols
    ///
    /// # Arguments
    /// * `token_ids` - Slice of token IDs to encode
    ///
    /// # Returns
    /// A vector of alphabet symbols representing all encoded tokens
    pub fn encode_bulk(&self, token_ids: &[u32]) -> Result<Vec<u8>, String> {
        let mut result = Vec::new();
        for &token_id in token_ids {
            let encoded = self.encode(token_id)?;
            result.extend(encoded);
        }
        Ok(result)
    }

    /// Decode a sequence of alphabet symbols into multiple token IDs
    ///
    /// This decodes tokens sequentially from the symbol stream until all symbols are consumed.
    ///
    /// # Arguments
    /// * `alphabet_seq` - Sequence of alphabet symbols (each in range 0 to m-1)
    ///
    /// # Returns
    /// Vector of decoded token IDs
    pub fn decode_bulk(&self, alphabet_seq: &[u8]) -> Result<Vec<u32>, String> {
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