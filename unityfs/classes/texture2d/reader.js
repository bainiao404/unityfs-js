import UPNG from '../../../vendor/upng/UPNG.js'
import { DecoderManager } from '../../../decoders/DecoderManager.js'

// Pre-multiplied alpha pre-calculation table
const INV_ALPHA_TABLE = new Float32Array(256)
for (let i = 1; i < 256; i++) INV_ALPHA_TABLE[i] = 255 / i

export async function decodeTexture2DRgba(texture, worker = false, assetFile, userOptions = {}) {
    if (texture.cachedRaw) {
        return texture.cachedRaw
    }
    if (texture.streamData && (!texture.data || texture.data.length === 0)) {
        const context = texture.reader?.assetFile?.context || assetFile?.context || assetFile
        if (context && typeof context.resolveResource === 'function') {
            texture.data = context.resolveResource(
                texture.streamData.path,
                texture.streamData.offset,
                texture.streamData.size,
            )
        } else if (assetFile && Array.isArray(assetFile.files)) {
            assetFile.files.forEach((f) => {
                if (f.type == 3 && texture.streamData.path.includes(f.node.path)) {
                    texture.data = f.data.subarray(
                        Number(texture.streamData.offset),
                        Number(texture.streamData.offset) + Number(texture.streamData.size),
                    )
                }
            })
        }
    }

    let textureFormat = texture.textureFormat
    if (!textureFormat) {
        console.warn('Unknown texture format')
        return null
    }

    const options = {
        worker,
        version: texture._version,
        ...userOptions
    }

    try {
        const flippedImageData = await DecoderManager.decodeTexture(
            texture.data,
            texture.width,
            texture.height,
            textureFormat,
            options,
        )
        texture.cachedRaw = flippedImageData
        return flippedImageData
    } catch (e) {
        console.error(`While decoding texture ${texture.name}:`, e)
        return null
    }
}

export function flipImageVertical(imageData, width, height) {
    const view = imageData instanceof Uint8Array ? imageData : new Uint8Array(imageData.buffer || imageData)
    const rowSize = width * 4
    const dest = new Uint8Array(view.length)
    for (let y = 0; y < height; y++) {
        const srcRowStart = y * rowSize
        const destRowStart = (height - 1 - y) * rowSize
        dest.set(view.subarray(srcRowStart, srcRowStart + rowSize), destRowStart)
    }
    return dest
}

export async function rgbaToPng(userConfig) {
    const {
        rgbaData: rawRgbaData,
        width,
        height,
        type = 'arrayBuffer',
        premultiplied = false,
        upng = false,
        name,
    } = userConfig

    const rgbaData = flipImageVertical(rawRgbaData, width, height)

    const rData = { data: null, width, height, name }

    if (type === 'rgbaArray') {
        rData.raw = rgbaData
        return rData
    }

    const useCanvas = !upng && typeof window !== 'undefined' && !!window.OffscreenCanvas

    let processedData = rgbaData
    if (premultiplied || (useCanvas && isPremultipliedAlpha(rgbaData))) {
        processedData = ensureStraightAlpha(rgbaData)
    }

    if (useCanvas) {
        const canvas = new OffscreenCanvas(width, height)
        const ctx = canvas.getContext('2d')
        const imgData = new ImageData(new Uint8ClampedArray(processedData.buffer || processedData), width, height)
        ctx.putImageData(imgData, 0, 0)

        switch (type) {
            case 'canvas':
                if (typeof document !== 'undefined') {
                    const realCanvas = document.createElement('canvas')
                    realCanvas.width = width
                    realCanvas.height = height
                    const realCtx = realCanvas.getContext('2d')
                    realCtx.drawImage(canvas, 0, 0)
                    rData.raw = realCanvas
                } else {
                    rData.raw = canvas
                }
                break
            case 'offscreenCanvas':
                rData.raw = canvas
                break
            case 'blob':
                rData.raw = await canvas.convertToBlob({ type: 'image/png' })
                break
            case 'blobURL': {
                const blob = await canvas.convertToBlob({ type: 'image/png' })
                rData.raw = URL.createObjectURL(blob)
                break
            }
            case 'arrayBuffer': {
                const ab = await canvas.convertToBlob({ type: 'image/png' })
                rData.raw = await ab.arrayBuffer()
                break
            }
            case 'dataURL': {
                const durlBlob = await canvas.convertToBlob({ type: 'image/png' })
                rData.raw = await blobToDataURL(durlBlob)
                break
            }
        }
    } else {
        const upngBuffer = UPNG.encode([processedData.buffer || processedData], width, height, 0)
        switch (type) {
            case 'arrayBuffer':
                rData.raw = upngBuffer
                break
            case 'blob':
                rData.raw = new Blob([upngBuffer], { type: 'image/png' })
                break
            case 'blobURL': {
                const blob = new Blob([upngBuffer], { type: 'image/png' })
                rData.raw = URL.createObjectURL(blob)
                break
            }
            case 'dataURL': {
                const blob = new Blob([upngBuffer], { type: 'image/png' })
                rData.raw = await blobToDataURL(blob)
                break
            }
        }
    }

    return rData
}

export function isPremultipliedAlpha(imageData, tolerance = 10) {
    const len = imageData.length
    const step = len > 100000 ? 32 : 4
    let hasTransparency = false

    for (let i = 0; i < len; i += step) {
        const alpha = imageData[i + 3]
        if (alpha < 255) {
            hasTransparency = true
        }

        const red = imageData[i]
        const green = imageData[i + 1]
        const blue = imageData[i + 2]
        const alphaTol = alpha + tolerance

        if (red > alphaTol || green > alphaTol || blue > alphaTol) {
            return false
        }
    }
    return hasTransparency
}

export function ensureStraightAlpha(rgbaArray) {
    const len = rgbaArray.length
    const data = new Uint8ClampedArray(len)
    data.set(rgbaArray)

    for (let i = 0; i < len; i += 4) {
        const a = data[i + 3]
        if (a > 0 && a < 255) {
            const invAlpha = INV_ALPHA_TABLE[a]
            data[i] = Math.min(255, data[i] * invAlpha)
            data[i + 1] = Math.min(255, data[i + 1] * invAlpha)
            data[i + 2] = Math.min(255, data[i + 2] * invAlpha)
        }
    }
    return data
}

export function blobToDataURL(blob) {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(blob)
    })
}
