#!/usr/bin/env python3
"""
build_decode_pack.py

Build a decode-only pack for *any HuggingFace tokenizer*.

Outputs:
  - decodepack.bin
      [u32 vocab_size]
      [u32 offsets_len (= vocab_size+1)]
      [u32 offsets[offsets_len]]  little-endian
      [u8  blob[ offsets[vocab_size] ]]
  - decodepack.meta.json
      tokenizer_fingerprint, model_id, vocab_size, special_ids, etc.

Why this works:
  We generate per-token "piece bytes" in a tokenizer-family-agnostic way:
    - For each token id i:
        decode([i]) -> string
        encode that string -> ids
      If encode(decode([i])) == [i], we accept the UTF-8 bytes of decode([i])
      Else we treat token i as "non-atomic" and store a safe fallback:
        store the raw token string if available, else empty.
  In practice, for mainstream HF tokenizers, most tokens are atomic.

Note:
  This is for DISPLAY decoding on the client. It is NOT a general "re-encoding" pack.
"""

import argparse
import hashlib
import json
import os
from dataclasses import asdict, dataclass
from typing import List, Optional, Tuple

from transformers import AutoTokenizer


@dataclass
class Meta:
    model_id: str
    vocab_size: int
    tokenizer_class: str
    tokenizer_fingerprint: str
    bos_token_id: Optional[int]
    eos_token_id: Optional[int]
    pad_token_id: Optional[int]
    unk_token_id: Optional[int]
    special_token_ids: List[int]
    non_atomic_token_ids: List[int]


def u32le(x: int) -> bytes:
    return int(x).to_bytes(4, "little", signed=False)


# Magic and version constants to match Rust decoder
MAGIC = 0x314B5044  # 'DPK1'
VERSION = 1


def fingerprint_tokenizer(tok) -> str:
    """
    Fingerprint a tokenizer deterministically without needing all files:
    - uses vocab + special token ids + a few config fields.
    """
    h = hashlib.sha256()
    h.update(tok.__class__.__name__.encode("utf-8"))
    h.update(str(tok.vocab_size).encode("utf-8"))
    for k in ["bos_token_id", "eos_token_id", "pad_token_id", "unk_token_id"]:
        h.update(str(getattr(tok, k, None)).encode("utf-8"))

    # Vocab can be large; hash token->id mapping stably by iterating ids in order if possible.
    # tok.get_vocab() returns token->id dict. We'll invert to id->token and hash in order.
    vocab = tok.get_vocab()
    id_to_token = [None] * len(vocab)
    for t, i in vocab.items():
        if 0 <= i < len(id_to_token):
            id_to_token[i] = t
    for t in id_to_token:
        if t is None:
            h.update(b"\x00")
        else:
            h.update(t.encode("utf-8", errors="surrogatepass"))
            h.update(b"\x00")
    return h.hexdigest()


def try_get_special_ids(tok) -> List[int]:
    ids = set()
    for x in [tok.bos_token_id, tok.eos_token_id, tok.pad_token_id, tok.unk_token_id]:
        if x is not None:
            ids.add(int(x))
    # also include additional_special_tokens if present
    try:
        for t in getattr(tok, "additional_special_tokens", []) or []:
            tid = tok.convert_tokens_to_ids(t)
            if tid is not None and tid != tok.unk_token_id:
                ids.add(int(tid))
    except Exception:
        pass
    return sorted(ids)


def build_piece_bytes(tok, tid: int) -> Tuple[bytes, bool]:
    """
    Returns (piece_bytes, is_atomic).

    Atomic means: encode(decode([tid])) == [tid] under add_special_tokens=False.

    Why atomic matters:
    - If not atomic, decode([tid]) is not a stable per-token piece to concatenate.
      (This happens for some special/added tokens and a few tokenizer edge cases.)
    """
    s = tok.decode([tid], skip_special_tokens=False, clean_up_tokenization_spaces=False)

    # Encode the decoded string and see if it round-trips to the same single id
    enc = tok.encode(s, add_special_tokens=False)
    is_atomic = (len(enc) == 1 and enc[0] == tid)

    # Use UTF-8 bytes of decoded string for display (this handles Ġ/▁/bytefallback properly
    # as long as the tokenizer decode is correct).
    b = s.encode("utf-8", errors="strict")
    return b, is_atomic


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("model_id", help="HF model id or local path containing tokenizer files")
    ap.add_argument("--out_dir", default=".", help="output directory")
    ap.add_argument("--max_vocab", type=int, default=0, help="optional limit for testing (0 = full)")
    args = ap.parse_args()

    model_id = args.model_id
    out_dir = args.out_dir
    os.makedirs(out_dir, exist_ok=True)

    tok = AutoTokenizer.from_pretrained(model_id, use_fast=True)

    # Ensure pad token exists for some tokenizers (not required for decodepack, but good metadata)
    if tok.pad_token_id is None and tok.eos_token_id is not None:
        tok.pad_token = tok.eos_token

    vocab_size = int(tok.vocab_size)
    if args.max_vocab and args.max_vocab > 0:
        vocab_size = min(vocab_size, args.max_vocab)

    special_ids = try_get_special_ids(tok)
    non_atomic: List[int] = []

    # Build offsets + blob
    offsets: List[int] = [0]
    blob_parts: List[bytes] = []

    for tid in range(vocab_size):
        b, is_atomic = build_piece_bytes(tok, tid)
        if not is_atomic:
            non_atomic.append(tid)
            # Still store something displayable; the decode([tid]) bytes are fine for display.
            # We just mark it non-atomic for debugging/QA.
        blob_parts.append(b)
        offsets.append(offsets[-1] + len(b))

        if tid % 5000 == 0 and tid > 0:
            print(f"processed {tid}/{vocab_size}...")

    blob = b"".join(blob_parts)

    bin_path = os.path.join(out_dir, "decodepack.bin")
    meta_path = os.path.join(out_dir, "decodepack.meta.json")

    # Write binary format with proper header
    offsets_len = vocab_size + 1
    offsets_bytes = offsets_len * 4
    blob_bytes = len(blob)
    
    with open(bin_path, "wb") as f:
        # Header (32 bytes)
        f.write(u32le(MAGIC))           # 0-3: magic 'DPK1'
        f.write(u32le(VERSION))         # 4-7: version
        f.write(u32le(vocab_size))      # 8-11: vocab_size
        f.write(u32le(offsets_len))     # 12-15: offsets_len
        f.write(u32le(offsets_bytes))   # 16-19: offsets_bytes
        f.write(u32le(blob_bytes))      # 20-23: blob_bytes
        f.write(bytes(8))                # 24-31: reserved (padding)
        
        # Offsets array
        for off in offsets:
            f.write(u32le(off))
        
        # Blob
        f.write(blob)

    meta = Meta(
        model_id=model_id,
        vocab_size=vocab_size,
        tokenizer_class=tok.__class__.__name__,
        tokenizer_fingerprint=fingerprint_tokenizer(tok),
        bos_token_id=tok.bos_token_id,
        eos_token_id=tok.eos_token_id,
        pad_token_id=tok.pad_token_id,
        unk_token_id=getattr(tok, "unk_token_id", None),
        special_token_ids=special_ids,
        non_atomic_token_ids=non_atomic[:5000],  # cap in metadata to keep file reasonable
    )
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(asdict(meta), f, ensure_ascii=False, indent=2)

    print(f"Wrote: {bin_path}")
    print(f"Wrote: {meta_path}")
    print(f"blob bytes: {len(blob):,}")
    print(f"non-atomic tokens: {len(non_atomic)} (usually mostly specials/added tokens)")


if __name__ == "__main__":
    main()