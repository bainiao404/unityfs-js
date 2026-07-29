/**
 * UnityJs Image (Texture2D / Sprite) Exporter Demo
 *
 * This example demonstrates how to use the UnityJs parsing engine to extract
 * Texture2D (textures) and Sprite (sprites/UI elements) assets from Unity bundles,
 * converting them into PNG images.
 *
 * Usage (Node.js):
 *   node exportImageDemo.js <path_to_unity_assetbundles_folder_or_file>
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
        console.log('  node exportImageDemo.js <path_to_unity_bundle_file_or_directory>')
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

    // 2. Scan and extract Texture2D & Sprite assets
    const outputDir = path.resolve(__dirname, './output/Images')
    console.log(`\n[Demo] Output directory: ${outputDir}`)
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }

    let textureCount = 0
    let spriteCount = 0

    for (const manager of managers) {
        const objectInfos = manager.getObjectInfos()

        // Before decoding Texture2Ds, check for companion files (.resS / .resource) in the bundle folder
        // and register them so streamed textures can decode correctly.
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

            if (className === 'Texture2D') {
                try {
                    console.log(`  Processing Texture2D: "${info.name}"...`)
                    // Export as ArrayBuffer (PNG format)
                    const fileInfo = await manager.exportFile(info, { type: 'arrayBuffer' })
                    if (fileInfo && fileInfo.data && fileInfo.data.raw) {
                        const targetPath = path.join(outputDir, `textures/${info.name}.png`)
                        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
                        fs.writeFileSync(targetPath, Buffer.from(fileInfo.data.raw))
                        console.log(`    √ Saved Texture2D to: textures/${info.name}.png`)
                        textureCount++
                    }
                } catch (e) {
                    console.error(`    ❌ Failed to export Texture2D "${info.name}":`, e.message)
                }
            } else if (className === 'Sprite') {
                try {
                    console.log(`  Processing Sprite: "${info.name}"...`)
                    // Export as ArrayBuffer (PNG format), optionally with transparent padding cropping
                    const fileInfo = await manager.exportFile(info, { type: 'arrayBuffer', cutting: true })
                    if (fileInfo && fileInfo.data && fileInfo.data.raw) {
                        const targetPath = path.join(outputDir, `sprites/${info.name}.png`)
                        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
                        fs.writeFileSync(targetPath, Buffer.from(fileInfo.data.raw))
                        console.log(`    √ Saved Sprite to: sprites/${info.name}.png`)
                        spriteCount++
                    }
                } catch (e) {
                    console.error(`    ❌ Failed to export Sprite "${info.name}":`, e.message)
                }
            }
        }
    }

    console.log(`\n[Demo] Export completed successfully! Total Texture2D: ${textureCount}, Sprite: ${spriteCount}`)
}

runDemo().catch((err) => {
    console.error('[Demo] Error running image export demo:', err)
})
