/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const alphabet_size: () => number;
export const decode: (a: number, b: number) => [number, number, number];
export const decode_bulk: (a: number, b: number) => [number, number, number, number];
export const encode: (a: number) => [number, number, number, number];
export const encode_bulk: (a: number, b: number) => [number, number, number, number];
export const is_loaded: () => number;
export const average_code_length: () => number;
export const init: () => void;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __externref_table_dealloc: (a: number) => void;
export const __externref_drop_slice: (a: number, b: number) => void;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_start: () => void;
