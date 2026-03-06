use std::{env, fs};

fn main() {
    // load .env at compile time
    dotenvy::dotenv().ok();

    // Pass DECODEPACK_PATH to rustc if available (needed for wasm.rs include_bytes!)
    if let Ok(decodepack_path) = env::var("DECODEPACK_PATH") {
        println!("cargo:rustc-env=DECODEPACK_PATH={}", decodepack_path);
    }

    // Skip build script for WASM target
    let target = env::var("TARGET").unwrap_or_default();
    if target.contains("wasm32") {
        // For WASM, just create a dummy vocab_size.rs
        // let dest = "src/vocab_size.rs";
        // fs::write(dest, "pub const VOCAB_SIZE: usize = 0;\n").unwrap();
        return;
    }

    let n: usize = env::var("LLAMA_VOCAB_SIZE")
        .expect("VOCAB_SIZE missing")
        .parse()
        .expect("VOCAB_SIZE must be usize");

    // let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let dest = "src/vocab_size.rs";

    fs::write(dest, format!("pub const VOCAB_SIZE: usize = {};\n", n)).unwrap();

    println!("cargo:rerun-if-changed=.env");
}
