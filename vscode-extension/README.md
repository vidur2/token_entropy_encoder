# Huffman LLM VS Code Extension

## ⚠️ STATUS: NON-FUNCTIONAL

**This extension does not currently work due to command registration issues.** The extension installs but commands (`huffman-llm.generate`, `huffman-llm.generateInline`) are not recognized by VS Code, resulting in "command not found" errors.

**What works:**
- ✅ Benchmarks and tests (run via `npm run test:unit` and `npm run benchmark:compare`)
- ✅ Code compiles without errors
- ✅ WASM bundling and loading

**What doesn't work:**
- ❌ VS Code command registration/activation
- ❌ Extension functionality in VS Code
- ❌ Keyboard shortcuts

**For working examples,** see the `node-examples/` directory in the parent repository.

---

# Original Documentation (Below)

Stream LLM completions with Huffman compression for faster, more efficient code generation.

## Features

- **🚀 Fast Streaming**: 40-60% less bandwidth than JSON with Huffman compression
- **💻 Local LLM Support**: Works with any local LLM server (llama.cpp, ollama, vllm, etc.)
- **⚡ Real-time Display**: Tokens appear as they're generated, not after decoding
- **🔧 Configurable**: Adjust temperature, max tokens, and system prompts

## Architecture

```
VS Code Extension ←→ Huffman Proxy Server ←→ Local LLM Server
    (WebSocket)         (Port 3002)         (Port 8000)
    WASM Decoder        Huffman Encoder     Token Generator
```

The proxy server sits between VS Code and your LLM, encoding token streams with Huffman compression.

## Setup

### 1. Start Your Local LLM Server

Use any OpenAI-compatible local LLM server:

**llama.cpp:**
```bash
./server -m model.gguf --port 8000
```

**ollama:**
```bash
ollama serve
export LLM_ENDPOINT=http://localhost:11434/v1/chat/completions
```

**vllm:**
```bash
python -m vllm.entrypoints.openai.api_server --model meta-llama/Llama-2-7b-hf --port 8000
```

### 2. Start the Huffman Proxy Server

```bash
cd node-examples
npm install
node proxy_server.js
```

By default, it connects to `http://localhost:8000/v1/chat/completions`. Configure with environment variables:

```bash
export LLM_ENDPOINT=http://localhost:11434/v1/chat/completions
export LLM_MODEL=llama2
node proxy_server.js
```

### 3. Install the VS Code Extension

From the `vscode-extension/` directory:

```bash
npm install
npm run compile
```

Then press `F5` in VS Code to launch the Extension Development Host.

### 4. Configure the Extension

Open VS Code settings and search for "Huffman LLM":

- **Proxy URL**: `ws://localhost:3002` (default)
- **System Prompt**: Customize the LLM's behavior
- **Temperature**: 0.0-2.0 (default: 0.7)
- **Max Tokens**: Maximum generation length (default: 2048)

## Usage

### Command Palette

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "Huffman LLM"
3. Choose:
   - **Generate Completion**: Enter a prompt in an input box
   - **Generate at Cursor**: Continue code from current cursor position

### Keyboard Shortcut

Press `Cmd+Shift+G` (Mac) or `Ctrl+Shift+G` (Windows/Linux) to generate at cursor.

## Performance

Based on benchmark results:

| Metric | WS+Huffman | SSE+JSON | Improvement |
|--------|-----------|----------|-------------|
| Latency (1000 tokens) | 5ms | 7ms | **29% faster** |
| Bandwidth (1000 tokens) | 3.7 KB | 6.4 KB | **42% less** |
| Server CPU | ~30% | ~100% | **70% reduction** |
| Throughput | 200K tok/s | 143K tok/s | **40% higher** |

For vibecoding applications with frequent completions, this translates to:
- Faster perceived response time
- Lower server costs (offloaded decoding to clients)
- Better scaling for multiple concurrent users

## Troubleshooting

### "Failed to connect to proxy"
- Ensure proxy server is running: `node proxy_server.js`
- Check proxy URL in settings matches server port

### "Failed to load WASM decoder"
- Ensure you built the WASM module: `./build_wasm.sh`
- Check that `pkg/` directory exists in the project root

### "LLM server error"
- Verify your LLM server is running and accessible
- Check `LLM_ENDPOINT` environment variable
- Test with: `curl http://localhost:8000/v1/models`

### Slow generation
- Check LLM server performance (GPU availability)
- Reduce `maxTokens` in settings
- Ensure proxy server is on localhost (not remote)

## Development

**Run in development mode:**
```bash
npm run watch
```

**Package extension:**
```bash
npm install -g @vscode/vsce
vsce package
```

## TODO

- [ ] Add proper tokenizer (tiktoken, sentencepiece) to proxy server
- [ ] Support multiple concurrent requests
- [ ] Add streaming cancellation
- [ ] Bundle WASM module with extension
- [ ] Add telemetry for performance tracking
- [ ] Support streaming edits (not just insertions)
- [ ] Add configuration UI for LLM endpoints

## License

MIT
