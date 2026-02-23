/* @ts-self-types="./token_entropy_encoder.d.ts" */

/**
 * Get the alphabet size of the Huffman encoder
 * @returns {number}
 */
function alphabet_size() {
    const ret = wasm.alphabet_size();
    return ret;
}
exports.alphabet_size = alphabet_size;

/**
 * Get the weighted average code length using probabilities from the tree
 *
 * Returns the expected code length: sum(p_i * length_i) for all tokens
 * @returns {number}
 */
function average_code_length() {
    const ret = wasm.average_code_length();
    return ret;
}
exports.average_code_length = average_code_length;

/**
 * Decode a buffer of bytes into a token ID
 *
 * For m=2 (binary), expects packed format: [1 byte: valid bits in last byte (0-8)] [packed bits]
 * For other alphabets, expects raw alphabet symbols.
 *
 * # Arguments
 * * `buffer` - A byte array containing encoded data
 *
 * # Returns
 * The decoded token ID, or an error message
 * @param {Uint8Array} buffer
 * @returns {number}
 */
function decode(buffer) {
    const ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return ret[0] >>> 0;
}
exports.decode = decode;

/**
 * Decode a buffer of bytes into multiple token IDs
 *
 * For m=2 (binary), expects packed format: [1 byte: valid bits in last byte (0-8)] [packed bits]
 * For other alphabets, expects raw alphabet symbols.
 * Decodes all tokens sequentially from the buffer.
 *
 * # Arguments
 * * `buffer` - A byte array containing encoded data
 *
 * # Returns
 * An array of decoded token IDs, or an error message
 * @param {Uint8Array} buffer
 * @returns {any[]}
 */
function decode_bulk(buffer) {
    const ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_bulk(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}
exports.decode_bulk = decode_bulk;

/**
 * Encode a token ID into bytes
 *
 * For m=2 (binary), returns packed format: [1 byte: valid bits in last byte (0-8)] [packed bits]
 * For other alphabets, returns raw alphabet symbols.
 *
 * # Arguments
 * * `token_id` - The token ID to encode
 *
 * # Returns
 * A byte array (packed if m=2, or raw symbols otherwise)
 * @param {number} token_id
 * @returns {Uint8Array}
 */
function encode(token_id) {
    const ret = wasm.encode(token_id);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
}
exports.encode = encode;

/**
 * Encode multiple tokens into packed bytes
 *
 * For m=2 (binary), returns format: [1 byte: valid bits in last byte (0-8)] [packed bits for all tokens]
 *
 * # Arguments
 * * `tokens` - Array of token IDs to encode
 *
 * # Returns
 * A byte array containing all encoded tokens (packed if m=2, or raw symbols otherwise)
 * @param {any[]} tokens
 * @returns {Uint8Array}
 */
function encode_bulk(tokens) {
    const ptr0 = passArrayJsValueToWasm0(tokens, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.encode_bulk(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}
exports.encode_bulk = encode_bulk;

/**
 * Initialize the WASM module and load the HuffmanGenerator
 * This is called automatically when the module is loaded
 */
function init() {
    wasm.init();
}
exports.init = init;

/**
 * Check if the HuffmanGenerator is loaded
 * @returns {boolean}
 */
function is_loaded() {
    const ret = wasm.is_loaded();
    return ret !== 0;
}
exports.is_loaded = is_loaded;

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_number_get_8ff4255516ccad3e: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./token_entropy_encoder_bg.js": import0,
    };
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
function decodeText(ptr, len) {
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

const wasmPath = `${__dirname}/token_entropy_encoder_bg.wasm`;
const wasmBytes = require('fs').readFileSync(wasmPath);
const wasmModule = new WebAssembly.Module(wasmBytes);
const wasm = new WebAssembly.Instance(wasmModule, __wbg_get_imports()).exports;
wasm.__wbindgen_start();
