#!/usr/bin/env python3
"""
Visualize the probability mass function (PMF) from llama_pmf.json
"""

import json
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path

def load_pmf(pmf_path='llama_pmf.json'):
    """Load the PMF data from JSON file"""
    with open(pmf_path, 'r') as f:
        data = json.load(f)
    return np.array(data['pmf'])

def load_vocab(vocab_path='vocab.json'):
    """Load the vocabulary mapping"""
    with open(vocab_path, 'r', encoding='utf-8') as f:
        vocab = json.load(f)
    return vocab

def calculate_entropy(pmf):
    """Calculate Shannon entropy of the PMF"""
    # Filter out zero probabilities to avoid log(0)
    pmf_filtered = pmf[pmf > 0]
    entropy = -np.sum(pmf_filtered * np.log2(pmf_filtered))
    return entropy

def visualize_pmf(pmf_path='llama_pmf.json', vocab_path='vocab.json', save_plots=True):
    """Create comprehensive visualizations of the PMF"""
    
    # Load data
    print("Loading PMF data...")
    pmf = load_pmf(pmf_path)
    
    try:
        vocab = load_vocab(vocab_path)
    except FileNotFoundError:
        print(f"Warning: {vocab_path} not found, proceeding without token labels")
        vocab = None
    
    # Calculate statistics
    print("\n=== PMF Statistics ===")
    print(f"Vocabulary size: {len(pmf)}")
    print(f"Sum of probabilities: {pmf.sum():.6f}")
    print(f"Shannon entropy: {calculate_entropy(pmf):.4f} bits")
    print(f"Perplexity: {2**calculate_entropy(pmf):.4f}")
    print(f"Min probability: {pmf.min():.2e}")
    print(f"Max probability: {pmf.max():.6f}")
    print(f"Mean probability: {pmf.mean():.6f}")
    print(f"Median probability: {np.median(pmf):.2e}")
    
    # Find top tokens
    top_k = 20
    top_indices = np.argsort(pmf)[-top_k:][::-1]
    
    print(f"\n=== Top {top_k} Most Probable Tokens ===")
    for i, idx in enumerate(top_indices, 1):
        token = vocab[idx] if vocab else f"token_{idx}"
        # Escape special characters for display
        token_display = repr(token) if vocab else token
        print(f"{i:2d}. {token_display:20s} (id={idx:6d}): {pmf[idx]:.6f}")
    
    # Create visualizations
    fig = plt.figure(figsize=(16, 10))
    
    # 1. Full PMF histogram (log scale)
    ax1 = plt.subplot(2, 3, 1)
    ax1.hist(pmf, bins=100, edgecolor='black', alpha=0.7)
    ax1.set_xlabel('Probability')
    ax1.set_ylabel('Count')
    ax1.set_title('Distribution of Token Probabilities')
    ax1.set_yscale('log')
    ax1.grid(True, alpha=0.3)
    
    # 2. Sorted probabilities (log scale)
    ax2 = plt.subplot(2, 3, 2)
    sorted_pmf = np.sort(pmf)[::-1]
    ax2.plot(sorted_pmf, linewidth=1)
    ax2.set_xlabel('Token Rank')
    ax2.set_ylabel('Probability')
    ax2.set_title('Sorted Token Probabilities')
    ax2.set_yscale('log')
    ax2.grid(True, alpha=0.3)
    
    # 3. Top K tokens bar chart
    ax3 = plt.subplot(2, 3, 3)
    top_k_display = 15
    top_idx = top_indices[:top_k_display]
    top_probs = pmf[top_idx]
    labels = [repr(vocab[i])[:15] if vocab else f"{i}" for i in top_idx]
    
    bars = ax3.bar(range(len(top_probs)), top_probs, edgecolor='black')
    ax3.set_xlabel('Token')
    ax3.set_ylabel('Probability')
    ax3.set_title(f'Top {top_k_display} Most Probable Tokens')
    ax3.set_xticks(range(len(top_probs)))
    ax3.set_xticklabels(labels, rotation=45, ha='right', fontsize=8)
    ax3.grid(True, alpha=0.3, axis='y')
    
    # Color gradient for bars
    colors = plt.cm.viridis(np.linspace(0.3, 0.9, len(bars)))
    for bar, color in zip(bars, colors):
        bar.set_color(color)
    
    # 4. Cumulative distribution
    ax4 = plt.subplot(2, 3, 4)
    cumsum = np.cumsum(sorted_pmf)
    ax4.plot(cumsum, linewidth=2)
    ax4.axhline(y=0.5, color='r', linestyle='--', label='50%')
    ax4.axhline(y=0.9, color='g', linestyle='--', label='90%')
    ax4.axhline(y=0.99, color='b', linestyle='--', label='99%')
    ax4.set_xlabel('Number of Top Tokens')
    ax4.set_ylabel('Cumulative Probability')
    ax4.set_title('Cumulative Distribution')
    ax4.legend()
    ax4.grid(True, alpha=0.3)
    
    # Find how many tokens account for various percentages
    for threshold in [0.5, 0.9, 0.99]:
        n_tokens = np.argmax(cumsum >= threshold) + 1
        print(f"Top {n_tokens} tokens account for {threshold*100:.0f}% of probability mass")
    
    # 5. Log-log plot (Zipf's law check)
    ax5 = plt.subplot(2, 3, 5)
    ranks = np.arange(1, len(sorted_pmf) + 1)
    ax5.loglog(ranks, sorted_pmf, linewidth=1)
    ax5.set_xlabel('Rank (log scale)')
    ax5.set_ylabel('Probability (log scale)')
    ax5.set_title("Zipf's Law Distribution")
    ax5.grid(True, alpha=0.3)
    
    # 6. Probability ranges
    ax6 = plt.subplot(2, 3, 6)
    ranges = [
        (1e-6, 1e-5, '1e-6 to 1e-5'),
        (1e-5, 1e-4, '1e-5 to 1e-4'),
        (1e-4, 1e-3, '1e-4 to 1e-3'),
        (1e-3, 1e-2, '1e-3 to 1e-2'),
        (1e-2, 1e-1, '1e-2 to 1e-1'),
        (1e-1, 1.0, '1e-1 to 1.0'),
    ]
    
    counts = []
    labels_ranges = []
    for low, high, label in ranges:
        count = np.sum((pmf >= low) & (pmf < high))
        counts.append(count)
        labels_ranges.append(label)
    
    ax6.bar(range(len(counts)), counts, edgecolor='black')
    ax6.set_xlabel('Probability Range')
    ax6.set_ylabel('Number of Tokens')
    ax6.set_title('Token Distribution by Probability Range')
    ax6.set_xticks(range(len(counts)))
    ax6.set_xticklabels(labels_ranges, rotation=45, ha='right')
    ax6.grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    
    if save_plots:
        output_path = Path(__file__).parent.parent / 'pmf_visualization.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        print(f"\nPlot saved to: {output_path}")
    
    plt.show()

if __name__ == '__main__':
    import sys
    
    # Get file paths from command line or use defaults
    pmf_path = sys.argv[1] if len(sys.argv) > 1 else '../llama_pmf.json'
    vocab_path = sys.argv[2] if len(sys.argv) > 2 else '../vocab.json'
    
    # Change to script directory for relative paths
    script_dir = Path(__file__).parent
    pmf_full = (script_dir / pmf_path).resolve()
    vocab_full = (script_dir / vocab_path).resolve()
    
    print(f"PMF file: {pmf_full}")
    print(f"Vocab file: {vocab_full}")
    
    visualize_pmf(str(pmf_full), str(vocab_full))
