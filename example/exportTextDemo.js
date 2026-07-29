/**
 * UnityJs TextAsset & Mesh (3D Models) Exporter Demo
 *
 * This example demonstrates how to use the UnityJs parsing engine to extract
 * TextAsset (text/JSON files) and Mesh (3D mesh data) assets from Unity bundles,
 * converting them into standard text (.txt/.json) and standard OBJ (.obj) 3D files.
 *
 * Usage (Node.js):
 *   node exportTextDemo.js <path_to_unity_assetbundles_folder_or_file>
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
        console.log('  node exportTextDemo.js <path_to_unity_bundle_file_or_directory>')
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

    // 2. Scan and extract TextAsset and Mesh assets
    const outputDir = path.resolve(__dirname, './output/TextAndMesh')
    console.log(`\n[Demo] Output directory: ${outputDir}`)
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }

    let textCount = 0
    let meshCount = 0

    for (const manager of managers) {
        const objectInfos = manager.getObjectInfos()

        for (const info of objectInfos) {
            const className = info.getClassName()

            if (className === 'TextAsset') {
                try {
                    console.log(`  Processing TextAsset: "${info.name}"...`)
                    // Export as text
                    const fileInfo = await manager.exportFile(info, { type: 'text' })
                    if (fileInfo && fileInfo.data && fileInfo.data.raw !== undefined) {
                        const targetPath = path.join(outputDir, `text/${info.name}.txt`)
                        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
                        fs.writeFileSync(targetPath, fileInfo.data.raw, 'utf-8')
                        console.log(`    √ Saved TextAsset to: text/${info.name}.txt`)
                        textCount++
                    }
                } catch (e) {
                    console.error(`    ❌ Failed to export TextAsset "${info.name}":`, e.message)
                }
            } else if (className === 'Mesh') {
                try {
                    console.log(`  Processing Mesh: "${info.name}"...`)
                    // Export as text (standard OBJ layout)
                    const fileInfo = await manager.exportFile(info, { type: 'text' })
                    if (fileInfo && fileInfo.data && fileInfo.data.raw !== undefined) {
                        const targetPath = path.join(outputDir, `mesh/${info.name}.obj`)
                        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
                        fs.writeFileSync(targetPath, fileInfo.data.raw, 'utf-8')
                        console.log(`    √ Saved Mesh to: mesh/${info.name}.obj`)
                        meshCount++
                    }
                } catch (e) {
                    console.error(`    ❌ Failed to export Mesh "${info.name}":`, e.message)
                }
            }
        }
    }

    console.log(`\n[Demo] Export completed successfully! Total TextAsset: ${textCount}, Mesh: ${meshCount}`)
}

runDemo().catch((err) => {
    console.error('[Demo] Error running text/mesh export demo:', err)
})
