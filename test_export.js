import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { load } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportWithDecoder(decoderType, outputDir) {
    const bundlePath = path.resolve(__dirname, './logs/image_chr_s_assets_all_df698a7aa2f6986b36dac96e4fda0d01.bundle');
    
    console.log(`\n--- Starting Export using [${decoderType.toUpperCase()}] decoder ---`);
    const fileData = fs.readFileSync(bundlePath);
    const manager = await load(fileData.buffer);
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const objectInfos = manager.getObjectInfos();
    let successCount = 0;
    let failCount = 0;
    
    for (const info of objectInfos) {
        const className = info.getClassName();
        if (className === 'Texture2D') {
            try {
                // Pass the etcDecoder and dxtDecoder type (wasm or js) in the export options
                const fileInfo = await manager.exportFile(info, { 
                    type: 'arrayBuffer', 
                    etcDecoder: decoderType,
                    dxtDecoder: decoderType
                });
                
                if (fileInfo && fileInfo.data && fileInfo.data.raw) {
                    const targetPath = path.join(outputDir, `${info.name}.png`);
                    fs.writeFileSync(targetPath, Buffer.from(fileInfo.data.raw));
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                console.error(`  [ERROR] Failed to export Texture2D "${info.name}":`, e.message);
                failCount++;
            }
        }
    }
    
    console.log(`Finished [${decoderType.toUpperCase()}] export. Success: ${successCount}, Failed: ${failCount}`);
    return { successCount, failCount };
}

async function run() {
    const wasmOut = path.resolve(__dirname, './logs/exported_textures_wasm');
    const jsOut = path.resolve(__dirname, './logs/exported_textures_js');
    
    // 1. Run WASM-based export
    const wasmResult = await exportWithDecoder('wasm', wasmOut);
    
    // 2. Run JS-based export
    const jsResult = await exportWithDecoder('js', jsOut);
    
    console.log('\n--- Final Verification ---');
    console.log(`WASM Decoder Result - Success: ${wasmResult.successCount}, Failed: ${wasmResult.failCount}`);
    console.log(`JS Decoder Result   - Success: ${jsResult.successCount}, Failed: ${jsResult.failCount}`);
    
    // Check if the output matches
    const wasmFiles = fs.readdirSync(wasmOut);
    const jsFiles = fs.readdirSync(jsOut);
    
    console.log(`WASM exported files count: ${wasmFiles.length}`);
    console.log(`JS exported files count: ${jsFiles.length}`);
    
    if (wasmFiles.length === jsFiles.length) {
        console.log('√ Both decoders produced the same number of exported files.');
        
        let matchCount = 0;
        let mismatchCount = 0;
        for (const file of wasmFiles) {
            if (jsFiles.includes(file)) {
                const wasmBuf = fs.readFileSync(path.join(wasmOut, file));
                const jsBuf = fs.readFileSync(path.join(jsOut, file));
                if (wasmBuf.equals(jsBuf)) {
                    matchCount++;
                } else {
                    mismatchCount++;
                    if (mismatchCount <= 5) {
                        console.log(`Mismatch [${mismatchCount}]: ${file}. WASM size: ${wasmBuf.length}, JS size: ${jsBuf.length}`);
                    }
                }
            }
        }
        console.log(`Content verification - Identical: ${matchCount}, Different: ${mismatchCount}`);
        if (mismatchCount === 0) {
            console.log('√ Perfect pixel match! All outputs are byte-for-byte identical.');
        } else {
            console.error('❌ Content mismatch detected in some decoded textures.');
        }
    } else {
        console.error('❌ Mismatch in exported file counts between decoders.');
    }
}

run().catch(console.error);
