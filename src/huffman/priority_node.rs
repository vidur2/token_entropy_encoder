use std::cmp::Ordering;
use super::trie_node::TrieNode;

/// Wrapper for priority queue ordering (min-heap based on probability)
#[derive(Clone)]
pub(crate) struct PriorityNode {
    pub(crate) node: Box<TrieNode>,
}

impl PriorityNode {
    pub(crate) fn new(node: TrieNode) -> Self {
        PriorityNode {
            node: Box::new(node),
        }
    }
}

impl PartialEq for PriorityNode {
    fn eq(&self, other: &Self) -> bool {
        self.node.probability == other.node.probability
    }
}

impl Eq for PriorityNode {}

impl PartialOrd for PriorityNode {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PriorityNode {
    fn cmp(&self, other: &Self) -> Ordering {
        // Reverse ordering for min-heap
        other.node.probability.partial_cmp(&self.node.probability)
            .unwrap_or(Ordering::Equal)
    }
}
