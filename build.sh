python scripts/get_pmf_from_llama.py $1
cargo build --release
./target/debug/create_tree
sh build_wasm.sh
