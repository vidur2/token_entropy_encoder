import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from json import dump
from dotenv import load_dotenv, set_key
from os import getenv
from os.path import abspath

load_dotenv()



model_id = getenv('MODEL_ID')
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(model_id)

# 1. Start with the BOS token
bos_token_id = tokenizer.bos_token_id  # 128000 for Llama 3
input_ids = torch.tensor([[bos_token_id]])

# 2. Get raw logits from the model
with torch.no_grad():
    outputs = model(input_ids)
    logits = outputs.logits[0, -1, :] # Shape: [vocab_size]

# 3. Convert logits to PMF (probabilities) using Softmax
pmf_tensor = torch.softmax(logits, dim=-1)
pmf_list = pmf_tensor.tolist()

data = {'pmf': pmf_list}

vocab = tokenizer.get_vocab()

id_to_token = [None] * len(vocab)
for token, id in vocab.items():
    id_to_token[id] = token

with open("vocab.json", "w", encoding="utf-8") as f:
    dump(id_to_token, f, ensure_ascii=False)

# Update .env file with absolute paths
env_file_path = '.env'
pmf_path = abspath('llama_pmf.json')
tokenizer_path = abspath('vocab.json')

set_key(env_file_path, 'LLAMA_PMF_PATH', pmf_path)
set_key(env_file_path, 'LLAMA_TOKENIZER_PATH', tokenizer_path)
set_key(env_file_path, 'LLAMA_VOCAB_SIZE', str(len(pmf_list)))

print(f"PMF saved to: {pmf_path}")
print(f"Tokenizer saved to: {tokenizer_path}")
print(f".env file updated with paths")

