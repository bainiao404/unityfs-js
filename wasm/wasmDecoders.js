import { LZ4_WASM_BASE64, LZMA_WASM_BASE64 } from './wasmBase64.js'

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64) {
    if (typeof atob === 'function') {
        const binaryString = atob(base64)
        const len = binaryString.length
        const bytes = new Uint8Array(len)
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i)
        }
        return bytes
    } else if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(base64, 'base64'))
    }
    throw new Error('atob or Buffer is required to decode base64 WASM')
}

// 1. Initialize LZ4 WASM
let lz4Instance = null
try {
    const lz4Bytes = base64ToUint8Array(LZ4_WASM_BASE64)
    const lz4Module = new WebAssembly.Module(lz4Bytes)
    lz4Instance = new WebAssembly.Instance(lz4Module)
} catch (err) {
    console.warn('[unityfs-js] Failed to compile LZ4 WebAssembly:', err)
}

// Memory growth helper for LZ4
function growLz4MemoryTo(instance, byteLength) {
    const exports = instance.exports
    const needed = exports.getLinearMemoryOffset() + byteLength
    const pageCountBefore = exports.memory.buffer.byteLength >>> 16
    const pageCountAfter = (needed + 65535) >>> 16
    if (pageCountAfter > pageCountBefore) {
        exports.memory.grow(pageCountAfter - pageCountBefore)
    }
    return exports.memory.buffer
}

export const lz4BlockWASM = lz4Instance
    ? {
          decodeBlock(input, inputOffset, outputSize) {
              if (input instanceof ArrayBuffer) {
                  input = new Uint8Array(input)
              }
              const inputSize = input.byteLength
              const exports = lz4Instance.exports
              const mem0 = exports.getLinearMemoryOffset()
              const memBuffer = growLz4MemoryTo(lz4Instance, inputSize + outputSize)

              const inputArea = new Uint8Array(memBuffer, mem0, inputSize)
              inputArea.set(input)

              const decodedSize = exports.lz4BlockDecode(mem0 + inputOffset, inputSize - inputOffset, mem0 + inputSize)
              if (decodedSize === 0) {
                  return null
              }
              return new Uint8Array(memBuffer, mem0 + inputSize, decodedSize)
          },
      }
    : null

// 2. Initialize LZMA WASM
let lzmaInstance = null
try {
    const lzmaBytes = base64ToUint8Array(LZMA_WASM_BASE64)
    const lzmaModule = new WebAssembly.Module(lzmaBytes)
    lzmaInstance = new WebAssembly.Instance(lzmaModule)
} catch (err) {
    console.warn('[unityfs-js] Failed to compile LZMA WebAssembly:', err)
}

// Memory growth helper for LZMA
function growLzmaMemoryTo(instance, byteLength) {
    const exports = instance.exports
    const needed = exports.getLinearMemoryOffset() + byteLength
    const pageCountBefore = exports.memory.buffer.byteLength >>> 16
    const pageCountAfter = (needed + 65535) >>> 16
    if (pageCountAfter > pageCountBefore) {
        exports.memory.grow(pageCountAfter - pageCountBefore)
    }
    return exports.memory.buffer
}

export const lzmaBlockWASM = lzmaInstance
    ? {
          decodeBlock(input, outputSize) {
              if (input instanceof ArrayBuffer) {
                  input = new Uint8Array(input)
              }
              const inputSize = input.byteLength
              const exports = lzmaInstance.exports
              const mem0 = exports.getLinearMemoryOffset()
              const memBuffer = growLzmaMemoryTo(lzmaInstance, inputSize + outputSize)

              const inputArea = new Uint8Array(memBuffer, mem0, inputSize)
              inputArea.set(input)

              const decodedSize = exports.lzmaBlockDecode(mem0, inputSize, mem0 + inputSize, outputSize)
              if (decodedSize === 0) {
                  return null
              }
              return new Uint8Array(memBuffer, mem0 + inputSize, decodedSize)
          },
      }
    : null
