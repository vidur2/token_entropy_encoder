use std::{env, fs};

fn main() {
    // load .env at compile time
    dotenvy::dotenv().ok();

    let n: usize = env::var("LLAMA_VOCAB_SIZE")
        .expect("VOCAB_SIZE missing")
        .parse()
        .expect("VOCAB_SIZE must be usize");

    // let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let dest = "src/vocab_size.rs";

    fs::write(dest, format!("pub const VOCAB_SIZE: usize = {};\n", n)).unwrap();

    println!("cargo:rerun-if-changed=.env");
}
