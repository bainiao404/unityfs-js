const utf8Decoder = new TextDecoder('utf-8')

export function decodeUTF8(buffer) {
    return utf8Decoder.decode(buffer)
}
