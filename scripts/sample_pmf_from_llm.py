import json
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from dotenv import load_dotenv, set_key
from os import getenv
from os.path import abspath
from sys import argv
from typing import List


def parse_args(argv_list: List[str]):
    model_id = None
    i = 1
    if len(argv_list) >= 2 and not argv_list[1].startswith("--"):
        model_id = argv_list[1]
        i = 2

    cfg = {
        "model_id": model_id,
        "prompt": None,
        "prompts_file": None,
        "samples": 200_000,         # total generated tokens to count
        "gen_len": 128,             # max_new_tokens per prompt
        "temperature": 0.8,
        "top_k": 0,
        "top_p": 1.0,
        "seed": 0,
        "device": (
            "cuda" if torch.cuda.is_available()
            else "mps" if torch.backends.mps.is_available()
            else "cpu"
        ),
        "dtype": "auto",            # auto|fp16|bf16|fp32
        "batch_size": 4,            # number of prompts to generate per batch
        "max_prompt_tokens": 256,
        "out": "sampled_pmf.json",
        "save_vocab": True,
        "drop_specials": True,
        "smooth_alpha": 0.001,      # add-alpha smoothing (0 disables)
        "smooth_eps": 1e-12,        # floor+renorm smoothing (0 disables)
    }

    def read_val():
        nonlocal i
        if i + 1 >= len(argv_list):
            raise ValueError(f"Missing value after {argv_list[i]}")
        v = argv_list[i + 1]
        i += 2
        return v

    while i < len(argv_list):
        a = argv_list[i]
        if a == "--prompt":
            cfg["prompt"] = read_val()
        elif a == "--prompts_file":
            cfg["prompts_file"] = read_val()
        elif a == "--samples":
            cfg["samples"] = int(read_val())
        elif a == "--gen_len":
            cfg["gen_len"] = int(read_val())
        elif a == "--temperature":
            cfg["temperature"] = float(read_val())
        elif a == "--top_k":
            cfg["top_k"] = int(read_val())
        elif a == "--top_p":
            cfg["top_p"] = float(read_val())
        elif a == "--seed":
            cfg["seed"] = int(read_val())
        elif a == "--device":
            cfg["device"] = read_val()
        elif a == "--dtype":
            cfg["dtype"] = read_val()
        elif a == "--batch_size":
            cfg["batch_size"] = int(read_val())
        elif a == "--max_prompt_tokens":
            cfg["max_prompt_tokens"] = int(read_val())
        elif a == "--out":
            cfg["out"] = read_val()
        elif a == "--no_vocab":
            cfg["save_vocab"] = False
            i += 1
        elif a == "--keep_specials":
            cfg["drop_specials"] = False
            i += 1
        elif a == "--smooth_alpha":
            cfg["smooth_alpha"] = float(read_val())
        elif a == "--smooth_eps":
            cfg["smooth_eps"] = float(read_val())
        else:
            raise ValueError(f"Unknown arg: {a}")

    return cfg


def pick_dtype(dtype_str: str, device: str):
    if dtype_str == "fp16":
        return torch.float16
    if dtype_str == "bf16":
        return torch.bfloat16
    if dtype_str == "fp32":
        return torch.float32
    # auto
    if device.startswith("cuda"):
        return torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    return torch.float32  # safest for mps/cpu


def load_prompts(cfg) -> List[str]:
    prompts: List[str] = []
    if cfg["prompts_file"]:
        with open(cfg["prompts_file"], "r", encoding="utf-8") as f:
            for line in f:
                s = line.strip()
                if s:
                    prompts.append(s)
    if cfg["prompt"]:
        prompts.append(cfg["prompt"])
    if not prompts:
        # better default than empty (avoids “first token after BOS” bias)
        prompts = [
            "Write a paragraph explaining a concept from computer science.",
            "Continue the following text naturally:\nToday I learned that",
            "Write a helpful answer to a user asking for debugging help.",
            "Summarize a news article in 5 sentences.",
        ]
    return prompts


@torch.no_grad()
def main():
    load_dotenv()
    cfg = parse_args(argv)

    if cfg["model_id"] is not None:
        set_key(".env", "MODEL_ID", cfg["model_id"])
        model_id = cfg["model_id"]
        print(f"Loading {model_id} from CLI args")
    else:
        model_id = getenv("MODEL_ID")
        if not model_id:
            raise RuntimeError("MODEL_ID not provided via CLI or .env")
        print(f"Loading {model_id} from env")

    device = cfg["device"]
    dtype = pick_dtype(cfg["dtype"], device)

    tokenizer = AutoTokenizer.from_pretrained(model_id, padding_side='left')
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token  # safe for inference

    model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=dtype)
    model.to(device).eval()

    V = model.config.vocab_size
    counts = torch.zeros(V, dtype=torch.int64)

    # Optional vocab dump
    vocab_path = None
    if cfg["save_vocab"]:
        vocab = tokenizer.get_vocab()
        id_to_token = [None] * len(vocab)
        for tok, tid in vocab.items():
            if 0 <= tid < len(id_to_token):
                id_to_token[tid] = tok
        vocab_path = abspath("vocab.json")
        with open(vocab_path, "w", encoding="utf-8") as f:
            json.dump(id_to_token, f, ensure_ascii=False)

    prompts = load_prompts(cfg)

    torch.manual_seed(cfg["seed"])
    if device.startswith("cuda"):
        torch.cuda.manual_seed_all(cfg["seed"])

    special_ids = set()
    if cfg["drop_specials"]:
        for x in [tokenizer.bos_token_id, tokenizer.eos_token_id, tokenizer.pad_token_id]:
            if x is not None:
                special_ids.add(int(x))

    total_to_count = int(cfg["samples"])
    gen_len = max(1, int(cfg["gen_len"]))
    batch_size = max(1, int(cfg["batch_size"]))

    counted = 0
    batch_idx = 0

    while counted < total_to_count:
        batch_prompts = [prompts[(batch_idx * batch_size + j) % len(prompts)] for j in range(batch_size)]
        batch_idx += 1

        enc = tokenizer(
            batch_prompts,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=int(cfg["max_prompt_tokens"]),
        )
        input_ids = enc["input_ids"].to(device)
        attn = enc["attention_mask"].to(device)

        # Generate continuations
        gen = model.generate(
            input_ids=input_ids,
            attention_mask=attn,
            do_sample=True,
            temperature=float(cfg["temperature"]),
            top_k=int(cfg["top_k"]) if int(cfg["top_k"]) > 0 else None,
            top_p=float(cfg["top_p"]),
            max_new_tokens=gen_len,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )

        # Count only the newly generated tokens (exclude the prompt prefix)
        prompt_lens = attn.sum(dim=1).tolist()
        for i in range(gen.size(0)):
            new_tokens = gen[i, prompt_lens[i]:].tolist()
            for tid in new_tokens:
                tid = int(tid)
                if tid in special_ids:
                    continue
                counts[tid] += 1
                counted += 1
                if counted >= total_to_count:
                    break
            if counted >= total_to_count:
                break

        if batch_idx % 10 == 0:
            print(f"counted {counted}/{total_to_count} tokens...")

    # Build smoothed PMF
    total = counts.sum().double()
    if total.item() == 0:
        raise RuntimeError("No tokens counted (maybe all were specials and you dropped specials?).")

    alpha = float(cfg["smooth_alpha"])
    eps = float(cfg["smooth_eps"])

    if alpha > 0.0:
        pmf_t = (counts.double() + alpha) / (total + alpha * V)
    else:
        pmf_t = counts.double() / total

    if eps > 0.0:
        pmf_t = torch.clamp(pmf_t, min=eps)
        pmf_t = pmf_t / pmf_t.sum()

    pmf = pmf_t.tolist()

    out_path = abspath(cfg["out"])
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "pmf": pmf,
                "counted": int(counts.sum().item()),
                "model_id": model_id,
                "gen_len": gen_len,
                "temperature": cfg["temperature"],
                "top_k": cfg["top_k"],
                "top_p": cfg["top_p"],
                "drop_specials": cfg["drop_specials"],
                "smooth_alpha": alpha,
                "smooth_eps": eps,
            },
            f,
        )

    set_key(".env", "LLAMA_PMF_PATH", out_path)
    if vocab_path:
        set_key(".env", "LLAMA_TOKENIZER_PATH", vocab_path)
    set_key(".env", "LLAMA_VOCAB_SIZE", str(len(pmf)))

    print(f"Saved PMF to: {out_path}")
    if vocab_path:
        print(f"Saved vocab to: {vocab_path}")


if __name__ == "__main__":
    main()