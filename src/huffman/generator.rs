use super::priority_node::PriorityNode;
use super::trie_node::TrieNode;
use serde::{Deserialize, Serialize};
use std::collections::{BinaryHeap, HashMap};

/// M-ary Huffman encoder/decoder
pub struct HuffmanGenerator {
    /// Root of the trie
    root: Option<Box<TrieNode>>,
    /// Alphabet size (m)
    m: u8,
    /// Encoding map: codeword -> sequence of alphabet symbols
    encoding_map: HashMap<String, Vec<u8>>,
}

impl HuffmanGenerator {
    /// Create a new HuffmanGenerator from codewords, their probabilities, and alphabet size
    ///
    /// # Arguments
    /// * `codewords` - Slice of codeword strings
    /// * `pmf` - Probability mass function for each codeword (must sum to ~1.0)
    /// * `m` - Alphabet size (2 for binary, 3 for ternary, etc.)
    ///
    /// # Returns
    /// A new HuffmanGenerator with the constructed trie and encoding map
    pub fn new(
        codewords: &[String],
        pmf: &[f64],
        m: u8,
    ) -> Result<Self, String> {
        let n = codewords.len();
        
        if n == 0 {
            return Err("Cannot create Huffman tree with zero codewords".to_string());
        }
        
        if n != pmf.len() {
            return Err("Codewords and PMF must have the same length".to_string());
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
        let root = Self::build_huffman_tree(codewords, pmf, m as usize);

        // Build encoding map
        let mut encoding_map = HashMap::new();
        Self::build_encoding_map(&root, &mut Vec::new(), &mut encoding_map);

        Ok(HuffmanGenerator {
            root: Some(root),
            m,
            encoding_map,
        })
    }

    /// Build the m-ary Huffman tree using a priority queue
    fn build_huffman_tree(
        codewords: &[String],
        pmf: &[f64],
        m: usize,
    ) -> Box<TrieNode> {
        let n = codewords.len();
        let mut heap = BinaryHeap::new();

        // Initialize heap with leaf nodes
        for (codeword, &prob) in codewords.iter().zip(pmf.iter()) {
            let node = TrieNode::new_leaf(codeword.clone(), prob);
            heap.push(PriorityNode::new(node));
        }
        // For m-ary Huffman, we need to ensure we can combine m nodes at each step
        // If n % (m-1) != 1, we need to add dummy nodes with 0 probability
        let mut node_count = n;
        while (node_count - 1) % (m - 1) != 0 {
            let dummy = TrieNode::new_leaf(String::new(), 0.0);
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

    /// Build the encoding map (codeword -> alphabet sequence) using explicit iteration
    fn build_encoding_map(node: &TrieNode, _path: &mut Vec<u8>, map: &mut HashMap<String, Vec<u8>>) {
        // Use explicit stack to avoid stack overflow with large trees
        let mut stack: Vec<(&TrieNode, Vec<u8>)> = Vec::new();
        stack.push((node, Vec::new()));

        while let Some((current_node, current_path)) = stack.pop() {
            if current_node.is_leaf() {
                if let Some(ref codeword) = current_node.codeword {
                    if !codeword.is_empty() {
                        // Skip dummy nodes
                        map.insert(codeword.clone(), current_path);
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

    /// Encode a codeword into a sequence of alphabet symbols
    ///
    /// # Arguments
    /// * `codeword` - The codeword to encode
    ///
    /// # Returns
    /// A vector of alphabet symbols (0 to m-1) representing the encoding
    pub fn encode(&self, codeword: &str) -> Result<Vec<u8>, String> {
        self.encoding_map
            .get(codeword)
            .cloned()
            .ok_or_else(|| format!("Codeword '{}' not found in encoding map", codeword))
    }

    /// Decode a sequence of alphabet symbols into a codeword
    ///
    /// # Arguments
    /// * `alphabet_seq` - Sequence of alphabet symbols (each in range 0 to m-1)
    ///
    /// # Returns
    /// The decoded codeword
    pub fn decode(&self, alphabet_seq: &[u8]) -> Result<String, String> {
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
            .clone()
            .ok_or_else(|| "Reached leaf with no codeword".to_string())
    }

    /// Get the alphabet size
    pub fn alphabet_size(&self) -> u8 {
        self.m
    }

    /// Get the encoding map (for debugging/inspection)
    pub fn get_encoding_map(&self) -> &HashMap<String, Vec<u8>> {
        &self.encoding_map
    }

    /// Serialize the HuffmanGenerator to JSON
    ///
    /// # Returns
    /// A JSON string representation of the generator
    pub fn to_json(&self) -> Result<String, String> {
        #[derive(Serialize)]
        struct SerializableGenerator {
            root: Option<Box<TrieNode>>,
            m: u8,
        }

        let serializable = SerializableGenerator {
            root: self.root.clone(),
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
            m: u8,
        }

        let deserialized: SerializableGenerator = serde_json::from_str(json)
            .map_err(|e| format!("Failed to deserialize from JSON: {}", e))?;

        // Rebuild the encoding map from the tree
        let mut encoding_map = HashMap::new();
        if let Some(ref root) = deserialized.root {
            Self::build_encoding_map(root, &mut Vec::new(), &mut encoding_map);
        }

        Ok(HuffmanGenerator {
            root: deserialized.root,
            m: deserialized.m,
            encoding_map,
        })
    }
}
