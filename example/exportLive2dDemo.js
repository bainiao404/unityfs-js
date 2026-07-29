/**
 * UnityJs Live2D Model Exporter Demo
 *
 * This example demonstrates how to use the UnityJs parsing engine to programmatically
 * extract and reconstruct a Live2D model (including .moc3, textures, physics, and motions)
 * from Unity AssetBundle files.
 *
 * =========================================================================
 * 📋 FILES TO PREPARE:
 * =========================================================================
 * 1. Model Structure (Prefab/MonoBehaviour bundle):
 *    Contains the CubismModel MonoBehaviour hierarchy mapping the parameters, parts,
 *    and renderer configurations. It points to the `.moc3` data bytes.
 * 2. Textures (Texture2D bundle):
 *    Contains the Texture2D assets (images) used by the Live2D model.
 * 3. Animations (AnimationClip bundle):
 *    Contains one or more AnimationClips containing keyframes (curves) for the model parameters.
 *
 * =========================================================================
 * ⚙️ POSSIBLE SCENARIOS & USE CASES:
 * =========================================================================
 * Scenario A: Combined AssetBundle (Single File)
 *   - The game stores the prefab, texture, and animations all inside one single `.bundle` file.
 *   - Action: Pass the file path directly to the script:
 *     `node exportLive2dDemo.js C:/path/to/character.bundle`
 *
 * Scenario B: Split AssetBundles (Multiple Files - Common in Production)
 *   - The game separates the assets (e.g., `character_model.bundle` for prefab,
 *     `character_textures.bundle` for textures, `character_animations.bundle` for motion clips).
 *   - Action: Put all related bundle files in a single folder, and pass the folder path to the script:
 *     `node exportLive2dDemo.js C:/path/to/character_assets_folder`
 *   - Why: The script will load all bundles into memory, allowing the UnityJs manager to
 *     resolve cross-bundle references (such as resolving AnimationClip curves to GameObject parameter paths).
 *
 * =========================================================================
 * 🚀 Usage (Node.js):
 *   node exportLive2dDemo.js <path_to_unity_assetbundles_folder_or_file>
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { load } from '../index.js'
import { processLive2DModel } from '../exporters/live2dExporter.js'

// Resolve current directory for ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runDemo() {
    // 1. Specify the path to your Unity bundle files via command line arguments
    const inputPath = process.argv[2]

    if (!inputPath || !fs.existsSync(inputPath)) {
        console.error(`\nError: Please provide a valid path to a bundle file or directory containing bundles.`)
        console.log(`Provided path: ${inputPath || '(none)'}`)
        console.log('\nUsage:')
        console.log('  node exportLive2dDemo.js <path_to_unity_bundle_file_or_directory>')
        console.log('\nRequired Assets Structure:')
        console.log(
            '  - Pass a folder path if the model prefab, textures, and animation clips are split across multiple bundles.',
        )
        console.log('  - Pass a file path if all assets are packed in a single bundle.')
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

    // 2. Load bundles into UnityJs Active Managers
    const managers = []
    console.log(`[Demo] Loading ${bundleFiles.length} files into memory...`)
    for (const filePath of bundleFiles) {
        try {
            const fileData = fs.readFileSync(filePath)
            // load loads the binary buffer and returns an AssetManager instance
            const manager = await load(fileData.buffer)
            if (manager) {
                managers.push(manager)
                console.log(`  Loaded: ${path.basename(filePath)}`)
            }
        } catch (e) {
            console.warn(`  Failed to load ${path.basename(filePath)}:`, e.message)
        }
    }

    // 3. Search for CubismModel MonoBehaviour objects
    let cubismModelObjInfo = null
    let modelManager = null

    console.log('\n[Demo] Searching for CubismModel component across all loaded bundles...')
    for (const manager of managers) {
        const objectInfos = manager.getObjectInfos()
        for (const info of objectInfos) {
            if (info.getClassName() === 'MonoBehaviour') {
                const fields = info.assetFile.getObjectUsingTreeJSON(info)
                // Check if the MonoBehaviour fields represent a CubismModel
                if (fields && (fields._moc !== undefined || fields.m_Moc !== undefined)) {
                    cubismModelObjInfo = info
                    modelManager = manager
                    break
                }
            }
        }
        if (cubismModelObjInfo) break
    }

    if (!cubismModelObjInfo) {
        console.error('[Demo] Could not find any CubismModel MonoBehaviour asset in the provided bundles.')
        console.log('Ensure you are pointing the script to bundles that contain the Live2D CubismModel component.')
        return
    }

    console.log(`[Demo] Found CubismModel: "${cubismModelObjInfo.name}" (PathID: ${cubismModelObjInfo.pathID})`)

    // 4. Export the Live2D model (Moc, Textures, Physics, Motions, model3.json)
    console.log('[Demo] Processing and extracting Live2D model files...')
    const result = await processLive2DModel(cubismModelObjInfo, modelManager)

    // 5. Output structure
    const outputDir = path.resolve(__dirname, `./output/${result.name}`)
    console.log(`[Demo] Saving exported files to: ${outputDir}`)

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }

    // Write all files to disk
    for (const [filename, fileData] of Object.entries(result.files)) {
        const targetPath = path.join(outputDir, filename)
        const targetDir = path.dirname(targetPath)
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true })
        }

        if (typeof fileData === 'string') {
            fs.writeFileSync(targetPath, fileData, 'utf-8')
        } else {
            fs.writeFileSync(targetPath, Buffer.from(fileData))
        }
        console.log(`  √ Saved: ${filename}`)
    }

    console.log('\n[Demo] Live2D Model Export successfully completed!')
}

runDemo().catch((err) => {
    console.error('[Demo] Error running export demo:', err)
})
