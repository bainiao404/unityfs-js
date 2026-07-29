/**
 * UnityJs Audio (AudioClip) Exporter Demo
 *
 * This example demonstrates how to use the UnityJs parsing engine to extract
 * AudioClip assets (sound effects, music, voices) from Unity bundles,
 * converting them into standard audio files (.wav, .ogg, or .mp3).
 *
 * Usage (Node.js):
 *   node exportAudioDemo.js <path_to_unity_assetbundles_folder_or_file>
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { load } from '../index.js'

// Resolve current directory for ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runDemo() {
    const inputPath = process.argv[2]

    if (!inputPath || !fs.existsSync(inputPath)) {
        console.error(`\nError: Please provide a valid path to a bundle file or directory containing bundles.`)
        console.log(`Provided path: ${inputPath || '(none)'}`)
        console.log('\nUsage:')
        console.log('  node exportAudioDemo.js <path_to_unity_bundle_file_or_directory>')
        return
    }

    console.log(`[Demo] Scanning for Unity bundles in: ${inputPath}`)

    // Resolve all files in input path
    let bundleFiles = []
    if (fs.statSync(inputPath).isDirectory()) {
        bundleFiles = fs
            .readdirSync(inputPath)
            .filter((f) => f.endsWith('.bundle') || f.endsWith('.assets') || !path.extname(f))
            .map((f) => path.join(inputPath, f))
    } else {
        bundleFiles = [inputPath]
    }

    if (bundleFiles.length === 0) {
        console.log('[Demo] No bundle files found to process.')
        return
    }

    // 1. Load bundles into UnityJs Active Managers
    const managers = []
    console.log(`[Demo] Loading ${bundleFiles.length} files...`)
    for (const filePath of bundleFiles) {
        try {
            const fileData = fs.readFileSync(filePath)
            const manager = await load(fileData.buffer)
            if (manager) {
                managers.push(manager)
                console.log(`  Loaded: ${path.basename(filePath)}`)
            }
        } catch (e) {
            console.warn(`  Failed to load ${path.basename(filePath)}:`, e.message)
        }
    }

    // 2. Scan and extract AudioClip assets
    const outputDir = path.resolve(__dirname, './output/Audio')
    console.log(`\n[Demo] Output directory: ${outputDir}`)
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }

    let audioCount = 0

    for (const manager of managers) {
        const objectInfos = manager.getObjectInfos()

        // Before decoding, check for companion files (.resS / .resource) in the bundle folder
        // and register them so streamed audio files can decode correctly.
        for (const assetFile of manager.assetFiles) {
            const assetsPath = assetFile.name
            if (assetsPath && assetsPath.toLowerCase().endsWith('.assets')) {
                const companionResS = assetsPath + '.resS'
                const companionResource = assetsPath + '.resource'
                ;[companionResS, companionResource].forEach((cand) => {
                    const fullCandPath = path.join(path.dirname(inputPath), path.basename(cand))
                    if (fs.existsSync(fullCandPath)) {
                        const companionData = fs.readFileSync(fullCandPath)
                        manager.registerResourceFile(path.basename(cand), new Uint8Array(companionData.buffer))
                        console.log(`  Registered companion resource file: ${path.basename(cand)}`)
                    }
                })
            }
        }

        for (const info of objectInfos) {
            const className = info.getClassName()

            if (className === 'AudioClip') {
                try {
                    console.log(`  Processing AudioClip: "${info.name}"...`)
                    // Export as ArrayBuffer
                    const fileInfo = await manager.exportFile(info, { type: 'arrayBuffer' })
                    if (fileInfo && fileInfo.data && fileInfo.data.raw) {
                        const ext = fileInfo.fileType || 'wav'
                        const targetPath = path.join(outputDir, `${info.name}.${ext}`)
                        fs.writeFileSync(targetPath, Buffer.from(fileInfo.data.raw))
                        console.log(`    √ Saved AudioClip to: ${info.name}.${ext}`)
                        audioCount++
                    }
                } catch (e) {
                    console.error(`    ❌ Failed to export AudioClip "${info.name}":`, e.message)
                }
            }
        }
    }

    console.log(`\n[Demo] Export completed successfully! Total AudioClip: ${audioCount}`)
}

runDemo().catch((err) => {
    console.error('[Demo] Error running audio export demo:', err)
})
