use serde::{Deserialize, Serialize};

/// Node in the m-ary Huffman trie
#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct TrieNode {
    /// The codeword at this leaf node (None for internal nodes)
    pub(crate) codeword: Option<u32>,
    /// Child nodes indexed by alphabet symbol (0 to m-1)
    pub(crate) children: Vec<Option<Box<TrieNode>>>,
    /// Probability of this node (used during construction)
    pub(crate) probability: f64,
}

impl TrieNode {
    /// Create a new leaf node with a codeword
    pub(crate) fn new_leaf(codeword: u32, probability: f64) -> Self {
        TrieNode {
            codeword: Some(codeword),
            children: Vec::new(),
            probability,
        }
    }

    /// Create a new internal node with m children
    pub(crate) fn new_internal(m: usize, probability: f64) -> Self {
        TrieNode {
            codeword: None,
            children: vec![None; m],
            probability,
        }
    }

    /// Check if this is a leaf node
    pub(crate) fn is_leaf(&self) -> bool {
        self.codeword.is_some()
    }
}
