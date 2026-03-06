#!/bin/bash

# Benchmark Runner for WS+Huffman vs SSE+JSON
# This script automates the process of running comprehensive benchmarks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     Token Entropy Encoder: End-to-End Benchmark Suite        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if dependencies are installed
echo "Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Dependencies not found. Installing...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies OK${NC}"
fi

# Check if WASM module is built
if [ ! -f "../pkg/token_entropy_encoder.js" ]; then
    echo -e "${RED}✗ WASM module not found!${NC}"
    echo "Please build the WASM module first:"
    echo "  cd .."
    echo "  ./build_wasm.sh"
    exit 1
fi
echo -e "${GREEN}✓ WASM module found${NC}"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Parse command line arguments
MODE="${1:-full}"
OUTPUT_DIR="benchmark-results"

case "$MODE" in
    "server")
        echo "Starting benchmark server only..."
        echo "Server will run on http://localhost:3001"
        echo ""
        echo "In another terminal, run:"
        echo "  cd node-examples"
        echo "  npm run benchmark:client"
        echo ""
        node benchmark_server.js
        ;;
    
    "client")
        echo "Running benchmark client..."
        echo "Make sure the server is running in another terminal!"
        echo ""
        sleep 1
        node benchmark_client.js
        ;;
    
    "analyze")
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please provide a results file${NC}"
            echo "Usage: $0 analyze <results-file.json>"
            exit 1
        fi
        node benchmark_analyzer.js "$2"
        ;;
    
    "full")
        echo "Running full benchmark suite..."
        echo ""
        
        # Create results directory
        mkdir -p "$OUTPUT_DIR"
        
        # Start server in background
        echo "Starting server..."
        node benchmark_server.js > "$OUTPUT_DIR/server.log" 2>&1 &
        SERVER_PID=$!
        
        # Wait for server to start
        echo "Waiting for server to initialize..."
        sleep 2
        
        # Check if server is running
        if ! kill -0 $SERVER_PID 2>/dev/null; then
            echo -e "${RED}✗ Server failed to start${NC}"
            echo "Check $OUTPUT_DIR/server.log for details"
            exit 1
        fi
        
        # Verify server is responding
        if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
            echo -e "${RED}✗ Server is not responding${NC}"
            kill $SERVER_PID 2>/dev/null || true
            exit 1
        fi
        
        echo -e "${GREEN}✓ Server started (PID: $SERVER_PID)${NC}"
        echo ""
        
        # Run benchmarks
        echo "Running benchmarks..."
        echo ""
        node benchmark_client.js | tee "$OUTPUT_DIR/benchmark-output.log"
        
        # Stop server
        echo ""
        echo "Stopping server..."
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
        echo -e "${GREEN}✓ Server stopped${NC}"
        
        echo ""
        echo "════════════════════════════════════════════════════════════════"
        echo ""
        echo -e "${GREEN}✓ Benchmark suite complete!${NC}"
        echo ""
        echo "Results saved to: $OUTPUT_DIR/"
        echo ""
        
        # List generated files
        if [ -d "$OUTPUT_DIR" ]; then
            echo "Generated files:"
            ls -lh "$OUTPUT_DIR/"
        fi
        ;;
    
    "quick")
        echo "Running quick benchmark (limited scenarios)..."
        echo ""
        
        # Start server in background
        echo "Starting server..."
        node benchmark_server.js > /dev/null 2>&1 &
        SERVER_PID=$!
        
        sleep 2
        
        if ! kill -0 $SERVER_PID 2>/dev/null; then
            echo -e "${RED}✗ Server failed to start${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✓ Server started${NC}"
        echo ""
        
        # Run a subset of benchmarks
        echo "Running quick benchmarks..."
        # You could create a benchmark_client_quick.js or pass a flag
        node benchmark_client.js
        
        echo ""
        echo "Stopping server..."
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
        echo -e "${GREEN}✓ Done${NC}"
        ;;
    
    "help"|"-h"|"--help")
        echo "Usage: $0 [mode]"
        echo ""
        echo "Modes:"
        echo "  full     - Run complete benchmark suite (default)"
        echo "  server   - Start benchmark server only"
        echo "  client   - Run benchmark client (requires server running)"
        echo "  quick    - Run quick benchmark with limited scenarios"
        echo "  analyze  - Analyze existing results file"
        echo "  help     - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                              # Run full suite"
        echo "  $0 server                       # Start server"
        echo "  $0 client                       # Run client"
        echo "  $0 analyze results.json         # Analyze results"
        echo ""
        exit 0
        ;;
    
    *)
        echo -e "${RED}Unknown mode: $MODE${NC}"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac

echo ""
